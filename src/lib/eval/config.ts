// ── Eval config import/export (YAML or JSON) ──
//
// Accepted shapes (all keys optional except cases):
//
//   promptRole: system
//   cases:
//     - name: 退款政策
//       input: 退款多久到账？
//       vars: { topic: 退款 }
//       assert:
//         - contains: 7 个工作日
//         - not-contains: 大概
//         - llm-rubric: { value: "先给结论，再给依据", threshold: 0.8 }
//
// Shorthand forms are normalized into full `Assertion` objects.

import { parse as parseYaml } from 'yaml';
import type { Assertion, AssertionType, EvalCase, EvalConfig } from '../../types';

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const VALID_TYPES: AssertionType[] = [
  'contains', 'not-contains', 'regex', 'equals', 'json-valid', 'max-latency', 'llm-rubric',
];

function normalizeAssertion(raw: unknown): Assertion | null {
  if (typeof raw === 'string') {
    // "contains: foo" / "foo"
    const m = raw.match(/^([a-z-]+)\s*:\s*([\s\S]+)$/i);
    if (m && VALID_TYPES.includes(m[1] as AssertionType)) {
      return { id: makeId('as'), type: m[1] as AssertionType, value: m[2].trim() };
    }
    return { id: makeId('as'), type: 'contains', value: raw.trim() };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;

    // { type: 'contains', value: 'x', threshold: 0.8 }
    if (typeof obj.type === 'string' && VALID_TYPES.includes(obj.type as AssertionType)) {
      return {
        id: makeId('as'),
        type: obj.type as AssertionType,
        value: String(obj.value ?? ''),
        threshold: typeof obj.threshold === 'number' ? obj.threshold : undefined,
        description: typeof obj.description === 'string' ? obj.description : undefined,
      };
    }

    // { contains: 'x' } / { llm-rubric: { value, threshold } }
    for (const [key, val] of Object.entries(obj)) {
      if (!VALID_TYPES.includes(key as AssertionType)) continue;
      if (val && typeof val === 'object') {
        const inner = val as Record<string, unknown>;
        return {
          id: makeId('as'),
          type: key as AssertionType,
          value: String(inner.value ?? ''),
          threshold: typeof inner.threshold === 'number' ? inner.threshold : undefined,
          description: typeof inner.description === 'string' ? inner.description : undefined,
        };
      }
      return { id: makeId('as'), type: key as AssertionType, value: String(val ?? '') };
    }
  }

  return null;
}

function normalizeCase(raw: unknown, index: number): EvalCase | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const vars: Record<string, string> = {};
  if (obj.vars && typeof obj.vars === 'object') {
    for (const [k, v] of Object.entries(obj.vars as Record<string, unknown>)) {
      vars[k] = v === null || v === undefined ? '' : String(v);
    }
  }

  const rawAsserts = (obj.assert ?? obj.asserts ?? []) as unknown;
  const asserts = Array.isArray(rawAsserts)
    ? rawAsserts.map(normalizeAssertion).filter((a): a is Assertion => a !== null)
    : [];

  return {
    id: makeId('case'),
    name: String(obj.name ?? `用例 ${index + 1}`),
    input: String(obj.input ?? obj.prompt ?? ''),
    vars,
    asserts,
  };
}

export interface ParseResult {
  config?: EvalConfig;
  error?: string;
}

export function parseEvalConfig(text: string): ParseResult {
  if (!text.trim()) return { error: '配置为空' };

  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (e) {
    return { error: `解析失败：${e instanceof Error ? e.message : String(e)}` };
  }

  if (!data || typeof data !== 'object') return { error: '配置格式不正确，应为对象' };

  const root = data as Record<string, unknown>;
  const rawCases = root.cases ?? root.tests;

  if (!Array.isArray(rawCases) || rawCases.length === 0) {
    return { error: '缺少 cases 数组（或 tests 数组）' };
  }

  const cases = rawCases
    .map((c, i) => normalizeCase(c, i))
    .filter((c): c is EvalCase => c !== null);

  if (cases.length === 0) return { error: '没有可用的用例' };

  const role = root.promptRole === 'user' ? 'user' : 'system';
  return { config: { promptRole: role, cases } };
}

/** Serialize current cases back to a readable config file. */
export function stringifyEvalConfig(promptRole: 'system' | 'user', cases: EvalCase[]): string {
  const payload = {
    promptRole,
    cases: cases.map(c => ({
      name: c.name,
      input: c.input,
      ...(Object.keys(c.vars).length ? { vars: c.vars } : {}),
      assert: c.asserts.map(a => ({
        type: a.type,
        value: a.value,
        ...(a.threshold !== undefined ? { threshold: a.threshold } : {}),
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/** A ready-to-run example so the view is never an empty dead end. */
export function exampleEvalConfig(): string {
  return `promptRole: system
cases:
  - name: 明确结论 + 禁止模糊词
    input: 退款多久到账？
    assert:
      - contains: 工作日
      - not-contains: 大概
      - not-contains: 可能
      - max-latency: 20000

  - name: 结构化输出
    input: 用 JSON 返回一个只含 answer 字段的对象，answer 是一句话结论
    assert:
      - json-valid: answer
      - llm-rubric:
          value: 先给结论，再给依据；不得使用模糊限定词
          threshold: 0.7
`;
}
