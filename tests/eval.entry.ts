// 评测引擎回归测试（Node 直跑，esbuild 转译；fetch 打桩，无需真实 API Key）
//
//   npx esbuild tests/eval.entry.ts --bundle --format=esm --platform=node \
//     --external:yaml --outfile=tests/_eval.mjs && node tests/_eval.mjs
//
// 覆盖：变量渲染、配置解析（YAML/JSON）、7 类断言、并发 runner、流式拼接、
//       评分调用、HTTP 错误透传、token/成本估算、回归基线（P1-2 / P1-2b）。

import { runEval } from '../src/lib/eval/runner';
import { parseEvalConfig, exampleEvalConfig, stringifyEvalConfig } from '../src/lib/eval/config';
import { evaluateAssertion } from '../src/lib/eval/assertions';
import { extractVariables, renderTemplate, scaffoldVars } from '../src/lib/eval/variables';
import {
  scoreRun, buildScoreCurve, diffRuns, locateRegression, pickBaselineRun,
} from '../src/lib/eval/baseline';
import { datasetHash, caseContentKey } from '../src/lib/eval/dataset';
import { getTemplate } from '../src/data/providers';
import type { Assertion, CaseResult, ChangeBlock, EvalCase, EvalRun } from '../src/types';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra); }
};

// ---------- Variables ----------
console.log('\n[1] variables');
ok('extractVariables 保序去重',
  JSON.stringify(extractVariables('{{a}} {{b}} {{a}}')) === '["a","b"]');
const rendered = renderTemplate('角色：{{role}}，目标：{{ goal }}，缺失：{{x}}', { role: '客服', goal: '退款' });
ok('renderTemplate 替换已知变量', rendered.text.includes('客服') && rendered.text.includes('退款'));
ok('renderTemplate 报告缺失变量', rendered.missing.length === 1 && rendered.missing[0] === 'x');
ok('scaffoldVars 保留已有值',
  scaffoldVars('{{a}} {{b}}', { a: 'keep' }).a === 'keep' && scaffoldVars('{{a}} {{b}}').b === '');

// ---------- Config ----------
console.log('\n[2] config');
const parsed = parseEvalConfig(exampleEvalConfig());
ok('示例配置可解析', !!parsed.config, parsed.error ?? '');
const cases = parsed.config?.cases ?? [];
ok('示例含 2 个用例', cases.length === 2, `got ${cases.length}`);
ok('首个用例含 4 条断言', cases[0]?.asserts.length === 4, `got ${cases[0]?.asserts.length}`);
ok('rubric 阈值被解析', cases[1]?.asserts[1]?.threshold === 0.7);

const jsonCfg = JSON.stringify({
  promptRole: 'user',
  cases: [{ name: 'j', input: 'hi', vars: { a: 1 }, assert: [{ type: 'contains', value: 'x' }] }],
});
const parsedJson = parseEvalConfig(jsonCfg);
ok('JSON 配置同样支持', parsedJson.config?.promptRole === 'user' && parsedJson.config?.cases[0].vars.a === '1');
ok('非法配置返回错误', !parseEvalConfig('foo: bar').config);
ok('导出可回环解析', !!parseEvalConfig(stringifyEvalConfig('system', cases)).config);

// ---------- Assertions ----------
console.log('\n[3] assertions');
const mk = (type: Assertion['type'], value: string, threshold?: number): Assertion => ({ id: 'a', type, value, threshold });
const out = '结论：7 个工作日内到账。';
ok('contains 命中', evaluateAssertion(mk('contains', '工作日'), { output: out, durationMs: 100 })?.passed === true);
ok('contains 未命中', evaluateAssertion(mk('contains', '大概'), { output: out, durationMs: 100 })?.passed === false);
ok('not-contains 通过', evaluateAssertion(mk('not-contains', '大概'), { output: out, durationMs: 100 })?.passed === true);
ok('not-contains 拦截', evaluateAssertion(mk('not-contains', '工作日'), { output: out, durationMs: 100 })?.passed === false);
ok('regex 命中', evaluateAssertion(mk('regex', '^结论[:：]'), { output: out, durationMs: 100 })?.passed === true);
ok('regex 非法不崩溃', evaluateAssertion(mk('regex', '('), { output: out, durationMs: 100 })?.passed === false);
ok('equals 精确匹配', evaluateAssertion(mk('equals', '结论：7 个工作日内到账。'), { output: out, durationMs: 1 })?.passed === true);
ok('json-valid 通过', evaluateAssertion(mk('json-valid', 'answer'), { output: '{"answer":"x"}', durationMs: 10 })?.passed === true);
ok('json-valid 缺字段失败', evaluateAssertion(mk('json-valid', 'answer,meta'), { output: '{"answer":"x"}', durationMs: 10 })?.passed === false);
ok('json-valid 容忍代码围栏',
  evaluateAssertion(mk('json-valid', 'a'), { output: '```json\n{"a":1}\n```', durationMs: 10 })?.passed === true);
ok('max-latency 通过', evaluateAssertion(mk('max-latency', '500'), { output: out, durationMs: 300 })?.passed === true);
ok('max-latency 超时', evaluateAssertion(mk('max-latency', '100'), { output: out, durationMs: 300 })?.passed === false);
ok('llm-rubric 交由 runner 处理', evaluateAssertion(mk('llm-rubric', 'x'), { output: out, durationMs: 1 }) === null);

// ---------- Runner (stubbed streaming API) ----------
console.log('\n[4] runner');
const sse = (chunks: string[]) =>
  new ReadableStream({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`));
      }
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

let callCount = 0;
globalThis.fetch = (async (_url: unknown, init: { body?: string }) => {
  callCount++;
  const body = String(init?.body ?? '');
  if (body.includes('评测员')) return new Response(sse(['{"score":0.9,"reason":"符合标准"}']), { status: 200 });
  if (body.includes('触发失败')) return new Response('unauthorized', { status: 401 });
  return new Response(sse(['7 个工作日', '内到账。']), { status: 200 });
}) as unknown as typeof fetch;

const template = getTemplate('deepseek');
if (!template) throw new Error('deepseek template missing');

const testCases: EvalCase[] = [
  { id: 'c1', name: '正常通过', input: '退款多久到账？', vars: {}, asserts: [mk('contains', '工作日'), mk('not-contains', '大概')] },
  { id: 'c2', name: '含评分', input: '退款多久到账？', vars: {}, asserts: [mk('llm-rubric', '先给结论', 0.7)] },
  { id: 'c3', name: '请求失败', input: '触发失败', vars: {}, asserts: [mk('contains', 'x')] },
  { id: 'c4', name: '无断言', input: '退款多久到账？', vars: {}, asserts: [] },
];

const results = await runEval({
  template: '你是客服助手，回答要直接。',
  promptRole: 'system',
  cases: testCases,
  target: { providerId: 'deepseek', template, apiKey: 'test-key', model: 'deepseek-chat' },
  concurrency: 3,
});

const byId = Object.fromEntries(results.map(r => [r.caseId, r]));
ok('返回全部用例结果', results.length === 4, `got ${results.length}`);
ok('确定性断言用例通过', byId.c1?.passed === true);
ok('流式分片被正确拼接', byId.c1?.output === '7 个工作日内到账。', byId.c1?.output);
ok('评分断言写入分数', byId.c2?.assertions[0]?.score === 0.9 && byId.c2.passed === true);
ok('HTTP 错误透传到用例', !!byId.c3?.error && byId.c3.passed === false, byId.c3?.error ?? '');
ok('无断言用例不判失败', byId.c4?.passed === true && byId.c4.assertions.length === 0);
ok('tokens 有估算值', (byId.c1?.tokensEst ?? 0) > 0);
ok('成本有估算值', (byId.c1?.costEst ?? 0) > 0);
ok('共发起 4 次推理 + 1 次评分', callCount === 5, `calls=${callCount}`);

// ---------- Regression baseline (P1-2) ----------
console.log('\n[5] baseline');

const caseOf = (
  caseId: string,
  caseName: string,
  passed: boolean,
  assertions: CaseResult['assertions'] = []
): CaseResult => ({
  caseId, caseName, output: passed ? 'ok' : 'bad', assertions, passed,
  durationMs: 10, tokensEst: 1, costEst: 0,
});

const failed = (id: string, type: Assertion['type'], detail: string): CaseResult['assertions'][number] => ({
  assertionId: id, type, passed: false, detail,
});

const mkRun = (over: Partial<EvalRun> & Pick<EvalRun, 'id' | 'createdAt'>): EvalRun => ({
  docId: 'doc', docName: 'doc.md', providerId: 'deepseek', modelName: 'deepseek-chat',
  promptRole: 'system', promptSnapshot: '', durationMs: 1,
  total: over.cases?.length ?? 0,
  passed: over.cases?.filter(c => c.passed).length ?? 0,
  cases: [],
  ...over,
});

const mkBlock = (over: Partial<ChangeBlock> & Pick<ChangeBlock, 'id' | 'oldSnippet' | 'newSnippet'>): ChangeBlock => ({
  type: 'replaced', oldStartLine: 1, oldEndLine: 1, newStartLine: 1, newEndLine: 1,
  accepted: true, ...over,
});

ok('scoreRun 按通过率折算', scoreRun({ passed: 1, total: 4 }) === 25 && scoreRun({ passed: 0, total: 0 }) === 0);

const versions = [
  { id: 'v1', label: 'v1', versionNumber: 1 },
  { id: 'v2', label: 'v2', versionNumber: 2 },
  { id: 'v3', label: 'v3', versionNumber: 3 },
];
const runV1Old = mkRun({ id: 'r1', createdAt: 100, versionId: 'v1', versionLabel: 'v1', cases: [caseOf('a', 'A', true), caseOf('b', 'B', false)] });
const runV1New = mkRun({ id: 'r2', createdAt: 200, versionId: 'v1', versionLabel: 'v1', cases: [caseOf('a', 'A', true), caseOf('b', 'B', true)] });
const runV2 = mkRun({ id: 'r3', createdAt: 300, versionId: 'v2', versionLabel: 'v2', cases: [caseOf('a', 'A', true), caseOf('b', 'B', true)] });
const runBare = mkRun({ id: 'r4', createdAt: 400, versionLabel: '未版本化', cases: [caseOf('a', 'A', false)] });

const curve = buildScoreCurve([runV1Old, runV1New, runV2, runBare], versions);
ok('分数曲线按版本升序，只含有运行的版本',
  curve.map(p => p.versionLabel).join(',') === 'v1,v2,未版本化', curve.map(p => p.versionLabel).join(','));
ok('同一版本取最近一次运行', curve[0].score === 100 && curve[0].runCount === 2, `score=${curve[0].score}`);
ok('曲线带与上一点的差值', curve[1].delta === 0 && curve[2].delta === -100, `d1=${curve[1].delta} d2=${curve[2].delta}`);

const beforeRun = mkRun({
  id: 'before', createdAt: 10,
  cases: [caseOf('a', 'A', true), caseOf('b', 'B', false), caseOf('c', 'C', true)],
});
const afterRun = mkRun({
  id: 'after', createdAt: 20,
  cases: [
    caseOf('a', 'A', false, [
      failed('as1', 'contains', '未找到「工作日」'),
      failed('as2', 'not-contains', '出现了不该有的「大概」'),
    ]),
    caseOf('b', 'B', true),
    caseOf('x', 'X', true),
  ],
});
const diff = diffRuns(beforeRun, afterRun);
ok('识别退化用例', diff.regressed.length === 1 && diff.regressed[0].caseName === 'A');
ok('识别修复用例', diff.fixed.length === 1 && diff.fixed[0].caseName === 'B');
ok('识别新增/移除用例', diff.added.length === 1 && diff.removed.length === 1);
ok('分数差按通过率算', diff.scoreBefore === 67 && diff.scoreAfter === 67, `${diff.scoreBefore}→${diff.scoreAfter}`);

const renamedBefore = mkRun({
  id: 'old', createdAt: 1, cases: [caseOf('old-1', '同名用例', true)],
});
const renamedAfter = mkRun({
  id: 'new', createdAt: 2, cases: [caseOf('new-1', '同名用例', false, [failed('x', 'contains', '未找到「工作日」')])],
});
ok('用例 id 变了按名称匹配（重新导入配置不误报）',
  diffRuns(renamedBefore, renamedAfter).regressed.length === 1);

const versionWithBlocks = {
  changeBlocks: [
    mkBlock({
      id: 'b1', oldSnippet: '回答要包含「7 个工作日」的说明', newSnippet: '回答要简洁，先给结论',
      explanation: { why: '精简冗余表述', how: '删掉时长描述', effect: '更短' },
    }),
    mkBlock({ id: 'b2', oldSnippet: '避免使用模糊词', newSnippet: '语气自然一点' }),
    mkBlock({ id: 'b3', oldSnippet: '旧文本', newSnippet: '不得出现「大概」', accepted: false }),
  ],
};
const regressedDelta = diff.regressed[0];
const located = locateRegression(regressedDelta, versionWithBlocks, [
  {
    id: 'a', name: 'A', input: '退款多久到账？', vars: {},
    asserts: [
      { id: 'as1', type: 'contains', value: '工作日' },
      { id: 'as2', type: 'not-contains', value: '大概' },
    ],
  },
]);
ok('定位到删除字面量的变更块', located[0]?.block.id === 'b1', located[0]?.block.id ?? 'none');
ok('定位结果带命中依据', (located[0]?.signals.length ?? 0) > 0);
ok('识别禁止性表述被删除', located.some(l => l.signals.includes('删除了禁止性表述')));
ok('被拒绝的变更块不参与定位', !located.some(l => l.block.id === 'b3'));
ok('无相关变更时返回空数组', locateRegression(regressedDelta, {
  changeBlocks: [mkBlock({ id: 'z', oldSnippet: '排版换行', newSnippet: '排版权重重排' })],
}, []).length === 0);

ok('基线优先取上一个有记录的版本',
  pickBaselineRun([runV1Old, runV1New, runV2], runV2, versions)?.id === 'r2');
ok('未版本化运行回退到更早的运行',
  pickBaselineRun([runV1New, runBare], runBare, versions)?.id === 'r2');
ok('只有一次运行时没有基线', pickBaselineRun([runV2], runV2, versions) === null);

// ---------- Dataset snapshot (P1-2b) ----------
console.log('\n[6] dataset snapshot');

const dsCase = (id: string, name: string, input: string, asserts: Assertion[]): EvalCase => ({
  id, name, input, vars: {}, asserts,
});
const dsA = dsCase('ds-a', '明确结论', '退款多久到账？', [{ id: 'a1', type: 'contains', value: '工作日' }]);
const dsB = dsCase('ds-b', '结构化输出', '用 JSON 返回', [{ id: 'b1', type: 'json-valid', value: 'answer' }]);
const dsC = dsCase('ds-c', '语气一致', '介绍一下服务', [{ id: 'c1', type: 'llm-rubric', value: '语气专业', threshold: 0.7 }]);

ok('数据集指纹与用例顺序无关', datasetHash([dsA, dsB]) === datasetHash([dsB, dsA]));
ok('改名/改 id 不改变数据集指纹',
  datasetHash([dsA, dsB]) === datasetHash([{ ...dsA, id: 'other', name: '改个名' }, dsB]));
ok('改输入/断言/变量会改变指纹',
  datasetHash([dsA]) !== datasetHash([{ ...dsA, input: '换个问题' }]) &&
  datasetHash([dsA]) !== datasetHash([{ ...dsA, asserts: [{ id: 'a1', type: 'contains', value: '到账' }] }]) &&
  datasetHash([dsA]) !== datasetHash([{ ...dsA, vars: { topic: '退款' } }]));
ok('变量顺序不影响内容键',
  caseContentKey({ input: 'x', vars: { a: '1', b: '2' }, asserts: [] }) ===
  caseContentKey({ input: 'x', vars: { b: '2', a: '1' }, asserts: [] }));
ok('rubric 默认阈值参与指纹',
  datasetHash([{ ...dsC, asserts: [{ id: 'c1', type: 'llm-rubric', value: '语气专业' }] }]) ===
  datasetHash([dsC]));

const dsBeforeRun = mkRun({
  id: 'ds-before', createdAt: 10,
  cases: [caseOf('ds-a', '明确结论', true), caseOf('ds-b', '结构化输出', false)],
  dataset: [dsA, dsB],
});
const dsAfterAdded = mkRun({
  id: 'ds-after-added', createdAt: 20,
  cases: [
    caseOf('ds-a', '明确结论', false, [failed('a1', 'contains', '未找到「工作日」')]),
    caseOf('ds-b', '结构化输出', true),
    caseOf('ds-c', '语气一致', true),
  ],
  dataset: [dsA, dsB, dsC],
});
const dsDiff = diffRuns(dsBeforeRun, dsAfterAdded);
ok('识别用例集变化', dsDiff.datasetKnown && !dsDiff.sameDataset);
ok('新增用例不计入共同口径', dsDiff.added.length === 1 && dsDiff.comparableCount === 2);
ok('共同用例分数单独计算',
  dsDiff.comparableBefore === 50 && dsDiff.comparableAfter === 50 && dsDiff.comparableDelta === 0,
  `${dsDiff.comparableBefore}→${dsDiff.comparableAfter} (${dsDiff.comparableDelta})`);
ok('整体分数仍按全部用例算', dsDiff.scoreBefore === 50 && dsDiff.scoreAfter === 67, `${dsDiff.scoreBefore}→${dsDiff.scoreAfter}`);

const dsBChanged = { ...dsB, asserts: [{ id: 'b1', type: 'json-valid' as const, value: 'answer,meta' }] };
const dsAfterChanged = mkRun({
  id: 'ds-after-changed', createdAt: 30,
  cases: [caseOf('ds-a', '明确结论', true), caseOf('ds-b', '结构化输出', true)],
  dataset: [dsA, dsBChanged],
});
const dsChangedDiff = diffRuns(dsBeforeRun, dsAfterChanged);
ok('用例内容被改过 → changed 而非 fixed', dsChangedDiff.changed.length === 1 && dsChangedDiff.fixed.length === 0);
ok('changed 带出修改字段', dsChangedDiff.changed[0]?.changedFields?.includes('断言') === true);
ok('changed 不参与共同口径', dsChangedDiff.comparableCount === 1);

const dsAfterRename = mkRun({
  id: 'ds-after-rename', createdAt: 40,
  cases: [caseOf('ds-a', '明确结论', true), caseOf('ds-b', '结构化输出', false)],
  dataset: [{ ...dsA, name: '明确结论（新名）' }, dsB],
});
const dsRenameDiff = diffRuns(dsBeforeRun, dsAfterRename);
ok('只改用例名不算新用例集', dsRenameDiff.sameDataset && dsRenameDiff.added.length === 0 && dsRenameDiff.removed.length === 0);
ok('旧运行无快照时 datasetKnown=false', diff.datasetKnown === false);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
