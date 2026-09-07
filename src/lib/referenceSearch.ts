import type { ImportedFileInfo } from '../types';

// ── Workspace reference search (P1-11) ──
// Phase 1: explicit path recognition + fuzzy subsequence matching.
// (BM25 full-text search is deferred per gap report.)

export interface ReferenceMatch {
  file: ImportedFileInfo;
  score: number;
  confidence: 'exact' | 'fuzzy';
}

/** Tokens that look like file paths: contain '/' or end with a doc extension. */
const PATH_TOKEN_RE = /[\w\-./\\]+(?:\.(?:md|markdown|txt|json|ya?ml|prompt)|\/[\w\-./\\]*)/gi;

const FUZZY_THRESHOLD = 0.6;

/**
 * Extract path-like mentions from chat input text.
 * e.g. "参考 references/fields.md 和 SKILL.md" → ["references/fields.md", "SKILL.md"]
 */
export function detectPathMentions(text: string): string[] {
  const mentions: string[] = [];
  const seen = new Set<string>();
  const matches = text.matchAll(PATH_TOKEN_RE);
  for (const m of matches) {
    // Trim trailing punctuation that is unlikely to be part of a path
    const token = m[0].replace(/[.,;:!?，。；：！？、)）\]】'"]+$/, '');
    if (token.length < 2) continue;
    const key = token.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      mentions.push(token);
    }
  }
  return mentions;
}

/**
 * Match a mention against imported files.
 * - exact: file path equals the mention or ends with it (suffix match) → score 1
 * - fuzzy: ordered subsequence coverage ratio, threshold ≥ 0.6
 * Results sorted by score descending.
 */
export function matchImportedFiles(mention: string, files: ImportedFileInfo[]): ReferenceMatch[] {
  const results: ReferenceMatch[] = [];
  const needle = mention.toLowerCase();

  for (const file of files) {
    const path = file.path.toLowerCase();
    const name = file.name.toLowerCase();

    if (path === needle || path.endsWith(needle) || name === needle) {
      results.push({ file, score: 1, confidence: 'exact' });
      continue;
    }

    const score = Math.max(subsequenceScore(needle, path), subsequenceScore(needle, name));
    if (score >= FUZZY_THRESHOLD) {
      results.push({ file, score, confidence: 'fuzzy' });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Ordered-subsequence coverage: fraction of needle characters that appear in
 * order within haystack. 1.0 when needle is a subsequence of haystack.
 */
function subsequenceScore(needle: string, haystack: string): number {
  if (!needle) return 0;
  let matched = 0;
  let hi = 0;
  for (let ni = 0; ni < needle.length; ni++) {
    const idx = haystack.indexOf(needle[ni], hi);
    if (idx === -1) continue;
    matched++;
    hi = idx + 1;
  }
  return matched / needle.length;
}
