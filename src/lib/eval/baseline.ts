// ── Regression baseline (P1-2) ──
//
// 三件事，全部是纯函数（可单测）：
// 1. scoreRun / buildScoreCurve：把运行记录折算成「每个版本一个分数」，供版本时间线出曲线；
// 2. diffRuns：逐用例对比两次运行，分出退化 / 修复 / 持续失败；
// 3. locateRegression：把退化用例映射回该版本的 changeBlock（启发式，必须标注依据，
//    不假装是精确归因——只给「最可疑的改动」）。

import type {
  Assertion, AssertionResult, CaseResult,
  ChangeBlock, EvalCase, EvalRun,
} from '../../types';
import { caseSignature, changedCaseFields, datasetHash } from './dataset';

export const UNVERSIONED_LABEL = '未版本化';

/** 0-100 分：通过用例占比（既有口径「全部断言通过才算用例通过」）。 */
export function scoreRun(run: Pick<EvalRun, 'passed' | 'total'>): number {
  if (!run.total || run.total <= 0) return 0;
  return Math.round((Math.max(0, run.passed) / run.total) * 100);
}

export interface VersionScorePoint {
  versionId: string | null;
  versionLabel: string;
  versionNumber: number | null;
  /** 该版本最近一次运行的分数 */
  score: number;
  /** 该版本历史最好成绩 */
  bestScore: number;
  /** 与曲线上一个点的差值（第一个点 / 未版本化点可能为 null） */
  delta: number | null;
  runCount: number;
  lastRunAt: number;
  modelName: string;
}

/**
 * 版本分数曲线：按版本号升序（v1 → vN），未版本化的运行排在最后。
 * 每个版本取最近一次运行作为当前分数；没有任何运行的版本不出现在曲线里。
 */
export function buildScoreCurve(
  runs: EvalRun[],
  versions: { id: string; label: string; versionNumber: number }[]
): VersionScorePoint[] {
  const byVersion = new Map<string, EvalRun[]>();
  const unversioned: EvalRun[] = [];

  for (const run of runs) {
    if (!run.versionId) {
      unversioned.push(run);
      continue;
    }
    const list = byVersion.get(run.versionId) ?? [];
    list.push(run);
    byVersion.set(run.versionId, list);
  }

  const points: VersionScorePoint[] = [];
  for (const version of versions) {
    const list = byVersion.get(version.id);
    if (!list || list.length === 0) continue;
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
    const latest = sorted[0];
    points.push({
      versionId: version.id,
      versionLabel: version.label,
      versionNumber: version.versionNumber,
      score: scoreRun(latest),
      bestScore: Math.max(...sorted.map(scoreRun)),
      delta: null,
      runCount: sorted.length,
      lastRunAt: latest.createdAt,
      modelName: latest.modelName,
    });
  }
  points.sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0));

  if (unversioned.length > 0) {
    const sorted = [...unversioned].sort((a, b) => b.createdAt - a.createdAt);
    points.push({
      versionId: null,
      versionLabel: UNVERSIONED_LABEL,
      versionNumber: null,
      score: scoreRun(sorted[0]),
      bestScore: Math.max(...sorted.map(scoreRun)),
      delta: null,
      runCount: sorted.length,
      lastRunAt: sorted[0].createdAt,
      modelName: sorted[0].modelName,
    });
  }

  for (let i = 1; i < points.length; i++) {
    points[i].delta = points[i].score - points[i - 1].score;
  }
  return points;
}

// ── Run diff ──

export type CaseDeltaStatus = 'regressed' | 'fixed' | 'still-failing' | 'still-passing' | 'added' | 'removed' | 'changed';

export interface CaseDelta {
  key: string;
  caseName: string;
  status: CaseDeltaStatus;
  before?: CaseResult;
  after?: CaseResult;
  /** 本次运行中未通过的断言（已带判定理由） */
  failingAssertions: AssertionResult[];
  /** 仅 changed：相对基线改了哪几项（名称/输入/变量/断言） */
  changedFields?: string[];
}

export interface RunDiff {
  before: EvalRun;
  after: EvalRun;
  /** 两次运行是否都存了用例快照（旧运行没有） */
  datasetKnown: boolean;
  /** 用例集指纹是否一致 */
  sameDataset: boolean;
  datasetHashBefore: string | null;
  datasetHashAfter: string | null;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  /** 只在「两次都有、且用例内容未变」的用例上计算的口径 */
  comparableCount: number;
  comparableBefore: number;
  comparableAfter: number;
  comparableDelta: number;
  deltas: CaseDelta[];
  regressed: CaseDelta[];
  fixed: CaseDelta[];
  added: CaseDelta[];
  removed: CaseDelta[];
  changed: CaseDelta[];
}

interface CaseMatch {
  before?: CaseResult;
  beforeDef?: EvalCase;
  afterDef?: EvalCase;
  /** 同一条用例（id/名称匹配上）但内容改过 → 不可比较 */
  contentChanged: boolean;
}

/**
 * 对比两次运行。用例优先按 caseId 匹配，匹配不上退回 caseName，再退回「内容指纹相同」。
 *
 * 只要有任意一次运行存了用例快照，就会核对用例内容：
 * 同一条用例被改过（输入/变量/断言/名称）→ 标记 changed，不参与涨跌；
 * 新增/移除的用例也不参与；涨跌只在「两次都有且内容未变」的共同用例上计算。
 * 旧运行没有快照时退回纯 id/名称匹配（保持旧口径）。
 */
export function diffRuns(before: EvalRun, after: EvalRun): RunDiff {
  const beforeDefs = new Map((before.dataset ?? []).map(c => [c.id, c]));
  const afterDefs = new Map((after.dataset ?? []).map(c => [c.id, c]));
  const datasetKnown = (before.dataset?.length ?? 0) > 0 && (after.dataset?.length ?? 0) > 0;

  const hashBefore = datasetKnown
    ? (before.datasetHash ?? datasetHash(before.dataset!))
    : (before.datasetHash ?? null);
  const hashAfter = datasetKnown
    ? (after.datasetHash ?? datasetHash(after.dataset!))
    : (after.datasetHash ?? null);
  const sameDataset = datasetKnown && hashBefore === hashAfter;

  const used = new Set<string>();

  const matchBefore = (c: CaseResult): CaseMatch => {
    const afterDef = afterDefs.get(c.caseId);
    const sigAfter = afterDef ? caseSignature(afterDef) : null;
    const differs = (beforeDef?: EvalCase) =>
      datasetKnown && !!beforeDef && !!sigAfter && caseSignature(beforeDef) !== sigAfter;

    // 1) 同 id（正常编辑用例时 id 不变；内容变了要标 changed）
    const byId = before.cases.find(b => b.caseId === c.caseId && !used.has(b.caseId));
    if (byId) {
      const beforeDef = beforeDefs.get(byId.caseId);
      return { before: byId, beforeDef, afterDef, contentChanged: differs(beforeDef) };
    }

    // 2) 同名（重新导入会换 id）
    const byName = before.cases.find(b => b.caseName === c.caseName && !used.has(b.caseId));
    if (byName) {
      const beforeDef = beforeDefs.get(byName.caseId);
      return { before: byName, beforeDef, afterDef, contentChanged: differs(beforeDef) };
    }

    // 3) 内容指纹一致、只是改了名 → 仍算同一条用例
    if (datasetKnown && sigAfter) {
      const byContent = before.cases.find(b => {
        if (used.has(b.caseId)) return false;
        const def = beforeDefs.get(b.caseId);
        return !!def && caseSignature(def) === sigAfter;
      });
      if (byContent) {
        return {
          before: byContent,
          beforeDef: beforeDefs.get(byContent.caseId),
          afterDef,
          contentChanged: false,
        };
      }
    }

    return { before: undefined, afterDef, contentChanged: false };
  };

  const deltas: CaseDelta[] = [];
  for (const c of after.cases) {
    const match = matchBefore(c);
    const b = match.before;
    if (b) used.add(b.caseId);

    let status: CaseDeltaStatus;
    if (!b) status = 'added';
    else if (match.contentChanged) status = 'changed';
    else if (b.passed && !c.passed) status = 'regressed';
    else if (!b.passed && c.passed) status = 'fixed';
    else if (!c.passed) status = 'still-failing';
    else status = 'still-passing';

    deltas.push({
      key: c.caseId,
      caseName: c.caseName,
      status,
      before: b,
      after: c,
      failingAssertions: c.assertions.filter(a => !a.passed),
      changedFields: status === 'changed'
        ? changedCaseFields(match.beforeDef, match.afterDef)
        : undefined,
    });
  }

  for (const b of before.cases) {
    if (used.has(b.caseId)) continue;
    deltas.push({
      key: b.caseId,
      caseName: b.caseName,
      status: 'removed',
      before: b,
      failingAssertions: [],
    });
  }

  const comparable = deltas.filter(d => d.before && d.after && d.status !== 'changed');
  const comparableBeforePass = comparable.filter(d => d.before!.passed).length;
  const comparableAfterPass = comparable.filter(d => d.after!.passed).length;
  const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return {
    before,
    after,
    datasetKnown,
    sameDataset,
    datasetHashBefore: hashBefore,
    datasetHashAfter: hashAfter,
    scoreBefore: scoreRun(before),
    scoreAfter: scoreRun(after),
    scoreDelta: scoreRun(after) - scoreRun(before),
    comparableCount: comparable.length,
    comparableBefore: pct(comparableBeforePass, comparable.length),
    comparableAfter: pct(comparableAfterPass, comparable.length),
    comparableDelta: pct(comparableAfterPass, comparable.length) - pct(comparableBeforePass, comparable.length),
    deltas,
    regressed: deltas.filter(d => d.status === 'regressed'),
    fixed: deltas.filter(d => d.status === 'fixed'),
    added: deltas.filter(d => d.status === 'added'),
    removed: deltas.filter(d => d.status === 'removed'),
    changed: deltas.filter(d => d.status === 'changed'),
  };
}

/** 基线选择：优先「上一个有评测记录的版本」，否则取当前运行之前最近的一次运行。 */
export function pickBaselineRun(
  runs: EvalRun[],
  current: EvalRun,
  versions: { id: string; versionNumber: number }[]
): EvalRun | null {
  const others = runs.filter(r => r.id !== current.id);
  if (others.length === 0) return null;

  if (current.versionId) {
    const cur = versions.find(v => v.id === current.versionId);
    if (cur) {
      for (let n = cur.versionNumber - 1; n >= 1; n--) {
        const version = versions.find(v => v.versionNumber === n);
        if (!version) continue;
        const hit = others
          .filter(r => r.versionId === version.id)
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        if (hit) return hit;
      }
    }
  }

  const older = others
    .filter(r => r.createdAt <= current.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt);
  return older[0] ?? [...others].sort((a, b) => b.createdAt - a.createdAt)[0];
}

// ── Change-block localization ──

/** 禁止性表述：被删掉往往意味着「别用模糊词」的约束失效。 */
const PROHIBITION = /禁止|不得|不应|不要|避免|严禁|不许|切勿|不能/;

const CJK = /[\u4e00-\u9fa5]/;

function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

/**
 * 粗分词：按非字母/数字切块；中文没有空格，再拆 2-gram，
 * 否则整句会作为一个词，永远命中不了变更片段。
 */
function splitTerms(text: string): string[] {
  const out = new Set<string>();
  for (const chunk of text.split(/[^\p{L}\p{N}]+/u)) {
    if (!chunk) continue;
    if (chunk.length >= 2) out.add(chunk.toLowerCase());
    if (CJK.test(chunk)) {
      for (let i = 0; i + 2 <= chunk.length; i++) {
        out.add(chunk.slice(i, i + 2));
      }
    }
  }
  return [...out].filter(t => t.length >= 2);
}

/** 从断言里提取可用于比对的字面量（正则剥离元字符，字段路径按逗号/点拆开）。 */
export function assertionTerms(assertion: Assertion): string[] {
  const value = assertion.value ?? '';
  switch (assertion.type) {
    case 'regex': {
      const cleaned = value.replace(/\\[dswbSWD]|[\^$.*+?()[\]{}|\\/]/g, ' ');
      return splitTerms(cleaned);
    }
    case 'json-valid':
      return value.split(/[,.]/).flatMap(splitTerms);
    case 'max-latency':
      return [];
    default:
      return splitTerms(value);
  }
}

export interface LocatedBlock {
  block: ChangeBlock;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  /** 命中的依据，展示给用户，避免把启发式包装成结论 */
  signals: string[];
}

/**
 * 把一个退化用例映射到「最可疑的 changeBlock」。
 *
 * 判定信号（从强到弱）：
 * - contains 断言失败：变更把该字面量从提示词里删掉了（+4）
 * - not-contains 断言失败：变更把该字面量加进去了（+4）
 * - not-contains 断言失败：变更删掉了禁止性表述（+3）
 * - 字面量出现在变更说明里（+1）
 * - 用例输入里的词出现在变更片段里（弱信号，最多 +2）
 *
 * 返回按分数降序的前 3 个；一个都没有时返回空数组（UI 必须如实说「未能定位」）。
 */
export function locateRegression(
  delta: CaseDelta,
  version: { changeBlocks: ChangeBlock[] },
  cases: EvalCase[]
): LocatedBlock[] {
  const result = delta.after;
  if (!result) return [];

  const evalCase =
    cases.find(c => c.id === result.caseId) ??
    cases.find(c => c.name === result.caseName);

  const defById = new Map<string, Assertion>(evalCase?.asserts.map(a => [a.id, a]) ?? []);
  const failing = result.assertions.filter(a => !a.passed);
  if (failing.length === 0) return [];

  // 被拒绝的修改没有进入版本内容，不能当成嫌疑对象
  const candidates = version.changeBlocks.filter(b => b.accepted !== false);
  if (candidates.length === 0) return [];

  const inputTerms = splitTerms(evalCase?.input ?? '');

  const scored = candidates.map((block, index) => {
    const oldText = normalize(block.oldSnippet ?? '');
    const newText = normalize(block.newSnippet ?? '');
    const whyText = normalize(
      [block.explanation?.why, block.explanation?.how, block.explanation?.effect]
        .filter(Boolean)
        .join(' ')
    );

    let score = 0;
    const signals: string[] = [];

    for (const r of failing) {
      const def = defById.get(r.assertionId);
      if (!def) continue;

      const terms = assertionTerms(def);
      const longest = (list: string[]) => [...list].sort((a, b) => b.length - a.length)[0];
      // 只取最长的命中词：「工作日 / 工作 / 作日」只算一次，不重复抬分
      const removed = longest(terms.filter(t => oldText.includes(t) && !newText.includes(t)));
      const added = longest(terms.filter(t => newText.includes(t) && !oldText.includes(t)));
      const related = longest(terms.filter(t => oldText.includes(t) || newText.includes(t)));
      const whyHit = longest(terms.filter(t => whyText.includes(t)));

      if (def.type === 'contains' && removed) {
        score += 4;
        signals.push(`移除了「${removed}」`);
      } else if (def.type === 'not-contains' && added) {
        score += 4;
        signals.push(`新增了「${added}」`);
      } else if (related) {
        score += 1;
        signals.push(`${def.type === 'not-contains' && removed ? '移除了' : '涉及'}「${related}」`);
      } else if (whyHit) {
        score += 1;
        signals.push(`变更说明提到「${whyHit}」`);
      }

      if (
        def.type === 'not-contains' &&
        PROHIBITION.test(block.oldSnippet ?? '') &&
        !PROHIBITION.test(block.newSnippet ?? '')
      ) {
        score += 3;
        signals.push('删除了禁止性表述');
      }
    }

    let inputHits = 0;
    for (const term of inputTerms) {
      if (oldText.includes(term) || newText.includes(term)) inputHits++;
    }
    if (inputHits > 0) {
      score += Math.min(inputHits, 2);
      signals.push(`与用例输入相关 ${inputHits} 处`);
    }

    return {
      block,
      score,
      confidence: (score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low') as LocatedBlock['confidence'],
      signals: [...new Set(signals)].slice(0, 4),
      index,
    };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ index: _index, ...rest }) => rest);
}
