// ── Eval dataset snapshot (P1-2b) ──
//
// 为什么要有这一层：
// 运行记录只存「用例结果」不够——用例本身被改过之后，两次运行的分数就不可比了。
// 这里把「测什么」抽成内容指纹：
// - 不包含 id / 名称 / 描述（不改变语义，重新导入或改名不应误判为新用例集）；
// - 包含输入、变量（排序后）、断言（类型/值/阈值）；
// - 数据集指纹 = 各用例指纹按顺序拼接后再哈希，用来判断两次运行是否同一套用例。
//
// 哈希用 FNV-1a 32 位（同步、无依赖、8 位十六进制）。本地比对够用，
// 不作为安全哈希使用。

import type { Assertion, EvalCase } from '../../types';

function assertionTuple(a: Assertion): unknown[] {
  const threshold = a.type === 'llm-rubric' ? (a.threshold ?? 0.7) : null;
  return [a.type, a.value, threshold];
}

function canonicalVars(vars: Record<string, string>): [string, string][] {
  return Object.keys(vars)
    .sort()
    .map(key => [key, vars[key] ?? '']);
}

/** 用例内容键：只包含决定「测什么」的字段。 */
export function caseContentKey(c: Pick<EvalCase, 'input' | 'vars' | 'asserts'>): string {
  return JSON.stringify({
    input: c.input,
    vars: canonicalVars(c.vars),
    asserts: c.asserts.map(assertionTuple),
  });
}

export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function caseSignature(c: Pick<EvalCase, 'input' | 'vars' | 'asserts'>): string {
  return hashText(caseContentKey(c));
}

/** 整组用例的指纹：与顺序无关（顺序只影响结果矩阵排版，不改变「测什么」）。 */
export function datasetHash(cases: EvalCase[]): string {
  return hashText(cases.map(caseContentKey).sort().join('\u0001'));
}

export function shortDatasetHash(hash?: string | null): string {
  return hash ? hash.slice(0, 8) : '—';
}

/** 只用于展示「哪几项变了」，不参与指纹。 */
export function changedCaseFields(before?: EvalCase, after?: EvalCase): string[] {
  if (!before || !after) return [];
  const fields: string[] = [];
  if (before.name !== after.name) fields.push('名称');
  if (before.input !== after.input) fields.push('输入');
  if (JSON.stringify(canonicalVars(before.vars)) !== JSON.stringify(canonicalVars(after.vars))) {
    fields.push('变量');
  }
  if (JSON.stringify(before.asserts.map(assertionTuple)) !== JSON.stringify(after.asserts.map(assertionTuple))) {
    fields.push('断言');
  }
  return fields;
}

/** 快照入库前深拷贝，避免和编辑中的对象共享引用。 */
export function cloneCases(cases: EvalCase[]): EvalCase[] {
  return cases.map(c => ({
    ...c,
    vars: { ...c.vars },
    asserts: c.asserts.map(a => ({ ...a })),
  }));
}
