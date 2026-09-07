import { diff_match_patch } from 'diff-match-patch';
import type { ChangeBlock, DiffLine, CharDiff } from '../types';

// ── Line-level diff using a simple LCS (Longest Common Subsequence) approach ──
// This is a practical implementation inspired by Myers' algorithm.

type DiffOp = 'equal' | 'delete' | 'insert' | 'replace' | 'reorder';

interface LineDiffOp {
  op: DiffOp;
  oldLines: string[];
  newLines: string[];
  /** For reorder halves: content of the counterpart half (for ChangeBlock snippets). */
  pairLines?: string[];
  /** Shared id linking the two halves of a reordered block. */
  reorderPairId?: number;
  /** Which side of a reordered pair this op represents. */
  reorderHalf?: 'old' | 'new';
}

function computeLineLCS(oldLines: string[], newLines: string[]): LineDiffOp[] {
  const m = oldLines.length;
  const n = newLines.length;
  // Build LCS table
  // To handle large files efficiently, we use space-optimized approach with two rows
  const prev = new Array(n + 1).fill(0);
  const curr = new Array(n + 1).fill(0);

  // We need the full table for backtracking, so use full matrix for now
  // For files > 2000 lines, we could use a more optimized approach
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp.push(new Array(n + 1).fill(0));
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff ops
  const ops: LineDiffOp[] = [];
  let i = m, j = n;

  const tempOps: LineDiffOp[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempOps.push({ op: 'equal', oldLines: [oldLines[i - 1]], newLines: [newLines[j - 1]] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempOps.push({ op: 'insert', oldLines: [], newLines: [newLines[j - 1]] });
      j--;
    } else {
      tempOps.push({ op: 'delete', oldLines: [oldLines[i - 1]], newLines: [] });
      i--;
    }
  }

  tempOps.reverse();

  // Merge consecutive ops of same type
  for (const op of tempOps) {
    const last = ops[ops.length - 1];
    if (last && last.op === op.op) {
      last.oldLines.push(...op.oldLines);
      last.newLines.push(...op.newLines);
    } else {
      ops.push({ ...op, oldLines: [...op.oldLines], newLines: [...op.newLines] });
    }
  }

  return ops;
}

// ── Convert delete+insert pairs to replace ──
function mergeReplacements(ops: LineDiffOp[]): LineDiffOp[] {
  const result: LineDiffOp[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].op === 'delete' && i + 1 < ops.length && ops[i + 1].op === 'insert') {
      result.push({ op: 'replace', oldLines: ops[i].oldLines, newLines: ops[i + 1].newLines });
      i++;
    } else {
      result.push(ops[i]);
    }
  }
  return result;
}

// ── Reorder detection (P1-1) ──
// Post-process after mergeReplacements: pair a pure delete block with a pure
// insert block whose normalized content matches (exact, or ≥0.9 line-LCS
// similarity). Both halves become `reorder` ops sharing one ChangeBlock.

/** Normalize a block for comparison: trim each line, drop empty lines. */
function normalizeBlock(lines: string[]): string {
  return lines.map(l => l.trim()).filter(l => l.length > 0).join('\n');
}

/** Dice-style similarity based on line-level LCS length (0..1). */
function blockSimilarity(a: string[], b: string[]): number {
  const na = a.map(l => l.trim()).filter(Boolean);
  const nb = b.map(l => l.trim()).filter(Boolean);
  if (na.length === 0 || nb.length === 0) return 0;
  // Performance safeguard: skip huge blocks (matrix is O(m*n))
  if (na.length > 200 || nb.length > 200) return 0;

  const m = na.length;
  const n = nb.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp.push(new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = na[i - 1] === nb[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return (2 * dp[m][n]) / (m + n);
}

const REORDER_MIN_LINES = 2;
const REORDER_SIMILARITY = 0.9;

function detectReorders(ops: LineDiffOp[]): LineDiffOp[] {
  const consumedInsert = new Set<number>();
  let pairId = 0;

  for (let i = 0; i < ops.length; i++) {
    const del = ops[i];
    if (del.op !== 'delete' || del.oldLines.length < REORDER_MIN_LINES) continue;
    const normDel = normalizeBlock(del.oldLines);
    if (!normDel) continue;

    let bestIdx = -1;
    let bestScore = 0;
    for (let j = 0; j < ops.length; j++) {
      if (consumedInsert.has(j)) continue;
      const ins = ops[j];
      if (ins.op !== 'insert' || ins.newLines.length < REORDER_MIN_LINES) continue;
      const normIns = normalizeBlock(ins.newLines);
      if (!normIns) continue;
      const score = normIns === normDel ? 1 : blockSimilarity(del.oldLines, ins.newLines);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = j;
      }
    }

    if (bestIdx >= 0 && bestScore >= REORDER_SIMILARITY) {
      pairId++;
      const ins = ops[bestIdx];
      ops[i] = {
        op: 'reorder',
        oldLines: del.oldLines,
        newLines: [],
        pairLines: ins.newLines,
        reorderPairId: pairId,
        reorderHalf: 'old',
      };
      ops[bestIdx] = {
        op: 'reorder',
        oldLines: [],
        newLines: ins.newLines,
        pairLines: del.oldLines,
        reorderPairId: pairId,
        reorderHalf: 'new',
      };
      consumedInsert.add(bestIdx);
    }
  }

  return ops;
}

/** Full op pipeline shared by buildDiffLines and applyChanges (keeps cb indexes aligned). */
function computeFinalOps(oldLines: string[], newLines: string[], ignoreWhitespace = false): LineDiffOp[] {
  const ops = ignoreWhitespace
    ? computeLineLCS(oldLines.map(l => l.trim()), newLines.map(l => l.trim()))
    : computeLineLCS(oldLines, newLines);
  return detectReorders(mergeReplacements(ops));
}

// ── Character-level diff for two line arrays ──
function computeCharDiffs(oldText: string, newText: string): CharDiff[] {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  const result: CharDiff[] = [];
  for (const [op, text] of diffs) {
    if (op === 0) result.push({ type: 'equal', text });
    else if (op === 1) result.push({ type: 'add', text });
    else result.push({ type: 'del', text });
  }
  return result;
}

// ── Build DiffLines for left (old) and right (new) panes ──
export function buildDiffLines(
  oldText: string,
  newText: string,
  options: { ignoreWhitespace?: boolean; ignoreReorder?: boolean } = {}
): { leftLines: DiffLine[]; rightLines: DiffLine[]; changeBlocks: ChangeBlock[] } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const ops = computeFinalOps(oldLines, newLines, options.ignoreWhitespace);
  return buildFromOps(ops, oldLines, newLines, options.ignoreReorder);
}

function buildFromOps(ops: LineDiffOp[], oldLines: string[], newLines: string[], ignoreReorder = false) {
  const leftLines: DiffLine[] = [];
  const rightLines: DiffLine[] = [];
  const changeBlocks: ChangeBlock[] = [];

  let oldLineNum = 1;
  let newLineNum = 1;
  let changeIdx = 0;
  // reorder pairId → changeBlock index (both halves share one block)
  const pairCbIdx = new Map<number, number>();

  for (const op of ops) {
    if (op.op === 'equal') {
      for (let k = 0; k < op.oldLines.length; k++) {
        leftLines.push({ type: 'equal', content: op.oldLines[k], oldLineNum: oldLineNum++ });
        rightLines.push({ type: 'equal', content: op.newLines[k], newLineNum: newLineNum++ });
      }
    } else if (op.op === 'delete') {
      const oldStart = oldLineNum;
      for (const line of op.oldLines) {
        leftLines.push({ type: 'removed', content: line, oldLineNum: oldLineNum++, changeBlockIdx: changeIdx });
        rightLines.push({ type: 'empty', content: '', changeBlockIdx: changeIdx });
      }
      changeBlocks.push({
        id: `cb-${changeIdx}`,
        type: 'removed',
        oldStartLine: oldStart,
        oldEndLine: oldLineNum - 1,
        newStartLine: 0,
        newEndLine: 0,
        oldSnippet: op.oldLines.join('\n'),
        newSnippet: '',
        accepted: null,
      });
      changeIdx++;
    } else if (op.op === 'insert') {
      const newStart = newLineNum;
      for (const line of op.newLines) {
        leftLines.push({ type: 'empty', content: '', changeBlockIdx: changeIdx });
        rightLines.push({ type: 'added', content: line, newLineNum: newLineNum++, changeBlockIdx: changeIdx });
      }
      changeBlocks.push({
        id: `cb-${changeIdx}`,
        type: 'added',
        oldStartLine: 0,
        oldEndLine: 0,
        newStartLine: newStart,
        newEndLine: newLineNum - 1,
        oldSnippet: '',
        newSnippet: op.newLines.join('\n'),
        accepted: null,
      });
      changeIdx++;
    } else if (op.op === 'replace') {
      const oldStart = oldLineNum;
      const newStart = newLineNum;
      const oldLen = op.oldLines.length;
      const newLen = op.newLines.length;
      const pairCount = Math.max(oldLen, newLen);

      // Diffchecker 语义：替换块内逐行配对，内容相同的行降级为 equal（不高亮），
      // 只有真正变化的行才标 replaced，并为该行单独计算字符级差异。
      for (let k = 0; k < pairCount; k++) {
        const oldLine = k < oldLen ? op.oldLines[k] : null;
        const newLine = k < newLen ? op.newLines[k] : null;

        if (oldLine !== null && newLine !== null && oldLine === newLine) {
          leftLines.push({ type: 'equal', content: oldLine, oldLineNum: oldLineNum++ });
          rightLines.push({ type: 'equal', content: newLine, newLineNum: newLineNum++ });
          continue;
        }

        // Per-line char diff (small lines only, performance safeguard)
        let charDiffs: { type: 'add' | 'del' | 'equal'; text: string }[] | undefined;
        if (oldLine !== null && newLine !== null && oldLine.length + newLine.length < 5000) {
          charDiffs = computeCharDiffs(oldLine, newLine);
        }

        if (oldLine !== null) {
          leftLines.push({
            type: 'replaced',
            content: oldLine,
            oldLineNum: oldLineNum++,
            changeBlockIdx: changeIdx,
            charDiffs,
          });
        } else {
          leftLines.push({ type: 'empty', content: '', changeBlockIdx: changeIdx });
        }

        if (newLine !== null) {
          rightLines.push({
            type: 'replaced',
            content: newLine,
            newLineNum: newLineNum++,
            changeBlockIdx: changeIdx,
            charDiffs,
          });
        } else {
          rightLines.push({ type: 'empty', content: '', changeBlockIdx: changeIdx });
        }
      }

      changeBlocks.push({
        id: `cb-${changeIdx}`,
        type: 'replaced',
        oldStartLine: oldStart,
        oldEndLine: oldStart + oldLen - 1,
        newStartLine: newStart,
        newEndLine: newStart + newLen - 1,
        oldSnippet: op.oldLines.join('\n'),
        newSnippet: op.newLines.join('\n'),
        accepted: null,
      });

      changeIdx++;
    } else if (op.op === 'reorder') {
      const halfLines = op.reorderHalf === 'old' ? op.oldLines : op.newLines;

      if (ignoreReorder) {
        // Render as equal: moved content shows at both positions, no change block.
        if (op.reorderHalf === 'old') {
          for (const line of op.oldLines) {
            leftLines.push({ type: 'equal', content: line, oldLineNum: oldLineNum++ });
            rightLines.push({ type: 'equal', content: '' });
          }
        } else {
          for (const line of op.newLines) {
            leftLines.push({ type: 'equal', content: '' });
            rightLines.push({ type: 'equal', content: line, newLineNum: newLineNum++ });
          }
        }
        continue;
      }

      // Both halves share one ChangeBlock; whichever half is met first creates it,
      // the second half backfills its line range.
      let cbIndex = pairCbIdx.get(op.reorderPairId!);
      if (cbIndex === undefined) {
        cbIndex = changeIdx++;
        pairCbIdx.set(op.reorderPairId!, cbIndex);
        changeBlocks.push({
          id: `cb-${cbIndex}`,
          type: 'reordered',
          oldStartLine: 0,
          oldEndLine: 0,
          newStartLine: 0,
          newEndLine: 0,
          oldSnippet: op.reorderHalf === 'old' ? op.oldLines.join('\n') : (op.pairLines || []).join('\n'),
          newSnippet: op.reorderHalf === 'new' ? op.newLines.join('\n') : (op.pairLines || []).join('\n'),
          accepted: null,
        });
      }
      const cb = changeBlocks[cbIndex];

      if (op.reorderHalf === 'old') {
        const oldStart = oldLineNum;
        for (const line of halfLines) {
          leftLines.push({ type: 'reordered', content: line, oldLineNum: oldLineNum++, changeBlockIdx: cbIndex });
          rightLines.push({ type: 'empty', content: '', changeBlockIdx: cbIndex });
        }
        cb.oldStartLine = oldStart;
        cb.oldEndLine = oldLineNum - 1;
      } else {
        const newStart = newLineNum;
        for (const line of halfLines) {
          leftLines.push({ type: 'empty', content: '', changeBlockIdx: cbIndex });
          rightLines.push({ type: 'reordered', content: line, newLineNum: newLineNum++, changeBlockIdx: cbIndex });
        }
        cb.newStartLine = newStart;
        cb.newEndLine = newLineNum - 1;
      }
    }
  }

  return { leftLines, rightLines, changeBlocks };
}

// ── Apply accepted changes to produce new content ──
export function applyChanges(
  oldText: string,
  newText: string,
  changeBlocks: ChangeBlock[],
  options: { ignoreReorder?: boolean } = {}
): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: string[] = [];

  // Same pipeline as buildDiffLines so changeBlock indexes stay aligned.
  const ops = computeFinalOps(oldLines, newLines);
  let cbIdx = 0;
  const pairCbIdx = new Map<number, number>();

  for (const op of ops) {
    if (op.op === 'equal') {
      result.push(...op.oldLines);
    } else if (op.op === 'reorder') {
      if (options.ignoreReorder) {
        // Not tracked as change blocks (mirrors buildDiffLines): keep the content
        // at its old position, skip the duplicate at the new position, and do NOT
        // consume a changeBlock index.
        if (op.reorderHalf === 'old') result.push(...op.oldLines);
        continue;
      }
      let idx = pairCbIdx.get(op.reorderPairId!);
      if (idx === undefined) {
        idx = cbIdx++;
        pairCbIdx.set(op.reorderPairId!, idx);
      }
      const cb = changeBlocks[idx];
      const accepted = cb?.accepted === true;
      if (op.reorderHalf === 'old') {
        // Rejected → keep content at its old position; accepted → dropped here
        // (the new half will emit it at the new position).
        if (!accepted) result.push(...op.oldLines);
      } else {
        // Accepted → emit at the new position; rejected → no duplicate.
        if (accepted) result.push(...op.newLines);
      }
    } else {
      const cb = changeBlocks[cbIdx];
      const accepted = cb?.accepted === true;
      if (accepted) {
        // Take new lines
        result.push(...op.newLines);
      } else {
        // Take old lines (for delete, oldLines has them; for insert, empty)
        result.push(...op.oldLines);
      }
      cbIdx++;
    }
  }

  return result.join('\n');
}

// ── Token estimation (rough: ~4 chars per token) ──
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
