// ── Eval runner: executes cases against the prompt under test ──

import { sendMessage } from '../api/adapter';
import { estimateTokens } from '../diff';
import { estimateCost } from '../crypto';
import { evaluateAssertion, extractJson } from './assertions';
import { renderTemplate } from './variables';
import type { Assertion, AssertionResult, CaseResult, EvalCase, ProviderTemplate } from '../../types';

export interface EvalTarget {
  providerId: string;
  template: ProviderTemplate;
  apiKey: string;
  model: string;
}

export interface RunEvalOptions {
  /** Prompt under test, with optional {{vars}} */
  template: string;
  promptRole: 'system' | 'user';
  cases: EvalCase[];
  target: EvalTarget;
  signal?: AbortSignal;
  concurrency?: number;
  onCaseDone?: (result: CaseResult) => void;
}

const JUDGE_SYSTEM = `你是一个严格的提示词评测员。你会收到：评分标准、用户输入、以及被评测模型的回答。
请只输出一个 JSON 对象，不要任何解释文字：
{"score": 0 到 1 之间的小数, "reason": "不超过 40 字的中文理由"}
评分要严格：明显不满足标准给 0.3 以下，部分满足给 0.5 左右，完全满足给 0.9 以上。`;

/** One non-streaming-ish completion: accumulate streamed tokens into a string. */
function complete(
  target: EvalTarget,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  systemPrompt: string | undefined,
  signal?: AbortSignal
): Promise<{ text: string; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    let text = '';

    void sendMessage({
      template: target.template,
      apiKey: target.apiKey,
      model: target.model,
      messages,
      systemPrompt,
      signal,
      callbacks: {
        onToken: token => { text += token; },
        onReasoning: () => { /* reasoning is not scored */ },
        onDone: finalText => {
          resolve({ text: finalText || text, durationMs: Math.round(performance.now() - started) });
        },
        onError: error => reject(error),
      },
    }).catch(reject);
  });
}

async function judgeWithRubric(
  assertion: Assertion,
  ctx: { input: string; output: string },
  target: EvalTarget,
  signal?: AbortSignal
): Promise<AssertionResult> {
  const threshold = assertion.threshold ?? 0.7;
  const userContent = [
    `评分标准：${assertion.value}`,
    `用户输入：${ctx.input || '（无）'}`,
    `模型回答：${ctx.output}`,
  ].join('\n\n');

  try {
    const { text } = await complete(
      target,
      [{ role: 'user', content: userContent }],
      JUDGE_SYSTEM,
      signal
    );
    const parsed = extractJson(text) as { score?: unknown; reason?: unknown } | undefined;
    const score = typeof parsed?.score === 'number' ? parsed.score : Number(parsed?.score);
    if (!Number.isFinite(score)) {
      return {
        assertionId: assertion.id,
        type: 'llm-rubric',
        passed: false,
        detail: `评分结果无法解析：${text.slice(0, 80)}`,
      };
    }
    const reason = typeof parsed?.reason === 'string' ? parsed.reason : '';
    return {
      assertionId: assertion.id,
      type: 'llm-rubric',
      passed: score >= threshold,
      score,
      detail: `${score.toFixed(2)} ${score >= threshold ? '≥' : '<'} ${threshold}${reason ? ` · ${reason}` : ''}`,
    };
  } catch (e) {
    return {
      assertionId: assertion.id,
      type: 'llm-rubric',
      passed: false,
      detail: `评分调用失败：${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

async function runCase(
  c: EvalCase,
  opts: RunEvalOptions
): Promise<CaseResult> {
  const { template, promptRole, target, signal } = opts;
  const rendered = renderTemplate(template, c.vars);

  const systemPrompt = promptRole === 'system' ? rendered.text : undefined;
  const userContent = promptRole === 'system'
    ? (c.input || '请按上述角色与规则作答。')
    : [rendered.text, c.input].filter(Boolean).join('\n\n');

  const started = performance.now();
  let output = '';
  let error: string | undefined;
  let durationMs = 0;

  try {
    const res = await complete(
      target,
      [{ role: 'user', content: userContent }],
      systemPrompt,
      signal
    );
    output = res.text;
    durationMs = res.durationMs;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw e;
    }
    error = e instanceof Error ? e.message : String(e);
    durationMs = Math.round(performance.now() - started);
  }

  const assertions: AssertionResult[] = [];
  if (!error) {
    for (const a of c.asserts) {
      const deterministic = evaluateAssertion(a, { output, durationMs });
      if (deterministic) {
        assertions.push(deterministic);
      } else {
        assertions.push(await judgeWithRubric(a, { input: c.input, output }, target, signal));
      }
    }
  }

  // 无断言的用例只校验「模型是否正常返回」，不因缺少断言而判失败
  const passed = !error && assertions.every(a => a.passed);
  const inputTokens = estimateTokens(systemPrompt ?? '') + estimateTokens(userContent);
  const outputTokens = estimateTokens(output);

  return {
    caseId: c.id,
    caseName: c.name,
    output,
    error,
    assertions,
    passed,
    durationMs,
    tokensEst: inputTokens + outputTokens,
    costEst: estimateCost(target.model, inputTokens, outputTokens),
  };
}

/** Run all cases with a small concurrency pool; throws on abort. */
export async function runEval(opts: RunEvalOptions): Promise<CaseResult[]> {
  const { cases, concurrency = 3, onCaseDone, signal } = opts;
  const results: CaseResult[] = new Array(cases.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const index = cursor++;
      if (index >= cases.length) return;
      const result = await runCase(cases[index], opts);
      results[index] = result;
      onCaseDone?.(result);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, cases.length)) }, worker);
  await Promise.all(workers);
  return results;
}
