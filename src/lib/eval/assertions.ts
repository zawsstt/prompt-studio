// ── Deterministic assertion evaluation ──
// `llm-rubric` needs a model call, so it lives in runner.ts and returns null here.

import type { Assertion, AssertionResult, AssertionType } from '../../types';

export const ASSERTION_LABELS: Record<AssertionType, string> = {
  contains: '包含',
  'not-contains': '不包含',
  regex: '正则匹配',
  equals: '完全等于',
  'json-valid': '合法 JSON',
  'max-latency': '耗时上限',
  'llm-rubric': 'AI 评分',
};

export const ASSERTION_HINTS: Record<AssertionType, string> = {
  contains: '输出中必须出现的文本',
  'not-contains': '输出中不得出现的文本（如模糊词）',
  regex: 'JavaScript 正则，如 ^\\s*结论[:：]',
  equals: '与输出逐字相等（已去首尾空白）',
  'json-valid': '合法 JSON；可逗号分隔必填字段路径，如 data.answer,tags',
  'max-latency': '允许的最长耗时，单位毫秒，如 8000',
  'llm-rubric': '评分标准（自然语言），模型给出 0-1 分',
};

function pass(a: Assertion, detail: string, score?: number): AssertionResult {
  return { assertionId: a.id, type: a.type, passed: true, detail, score };
}

function fail(a: Assertion, detail: string, score?: number): AssertionResult {
  return { assertionId: a.id, type: a.type, passed: false, detail, score };
}

const preview = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Pick a value out of a nested object by dotted path. */
function readPath(obj: unknown, path: string): { ok: boolean; value?: unknown } {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return { ok: false };
    if (!(seg in (cur as Record<string, unknown>))) return { ok: false };
    cur = (cur as Record<string, unknown>)[seg];
  }
  return { ok: true, value: cur };
}

/** Returns a result for deterministic assertions, or null when the assertion needs a model. */
export function evaluateAssertion(
  a: Assertion,
  ctx: { output: string; durationMs: number }
): AssertionResult | null {
  const { output, durationMs } = ctx;
  const value = a.value ?? '';

  switch (a.type) {
    case 'contains':
      return output.includes(value)
        ? pass(a, `已包含「${preview(value)}」`)
        : fail(a, `未找到「${preview(value)}」`);

    case 'not-contains':
      return output.includes(value)
        ? fail(a, `出现了不该有的「${preview(value)}」`)
        : pass(a, `未出现「${preview(value)}」`);

    case 'regex': {
      try {
        const re = new RegExp(value, 'm');
        const m = output.match(re);
        return m ? pass(a, `匹配到「${preview(m[0], 40)}」`) : fail(a, `未匹配 /${preview(value, 40)}/`);
      } catch {
        return fail(a, `正则表达式无效：${preview(value, 40)}`);
      }
    }

    case 'equals':
      return output.trim() === value.trim()
        ? pass(a, '完全一致')
        : fail(a, `期望「${preview(value)}」，实际「${preview(output.trim())}」`);

    case 'json-valid': {
      const parsed = extractJson(output);
      if (parsed === undefined) return fail(a, '输出中找不到可解析的 JSON');
      const required = value.split(',').map(s => s.trim()).filter(Boolean);
      const missing = required.filter(path => !readPath(parsed, path).ok);
      if (missing.length > 0) return fail(a, `缺少字段：${missing.join('、')}`);
      return pass(a, required.length ? `JSON 合法，${required.length} 个字段齐全` : 'JSON 合法');
    }

    case 'max-latency': {
      const limit = Number(value);
      if (!Number.isFinite(limit) || limit <= 0) return fail(a, '耗时上限配置无效');
      return durationMs <= limit
        ? pass(a, `${durationMs}ms ≤ ${limit}ms`)
        : fail(a, `${durationMs}ms 超出 ${limit}ms`);
    }

    case 'llm-rubric':
      return null;
  }
}

/** Parse JSON from a model response, tolerating code fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], trimmed];
  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      // try the outermost braces below
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}
