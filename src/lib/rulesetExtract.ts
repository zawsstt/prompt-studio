import type { RuleSet, StructureRule, OrderRule, FormatRule } from '../types';
import { parseFrontmatter } from './validation';

// ── Deterministic local ruleset extraction (P1-5) ──
// Derives a RuleSet draft from an imported convention/spec markdown file.
// Phase 1 is heuristic-only (no AI call); the draft is meant to be reviewed
// and edited by the user before saving.

/**
 * Extract a RuleSet draft from a markdown specification document.
 * - frontmatter field names → require-frontmatter structure rule
 * - `## ` heading sequence → orderRules
 * - presence of fenced code blocks with language → codeblock-language rule
 * - deepest heading level → heading-depth rule
 *
 * @param content  markdown source of the imported spec file
 * @param fileName original file name (used for the draft ruleset name)
 */
export function extractRulesetFromMarkdown(content: string, fileName: string): RuleSet {
  const structureRules: StructureRule[] = [];
  const orderRules: OrderRule[] = [];
  const formatRules: FormatRule[] = [];

  // 1. Frontmatter fields → require-frontmatter
  const { fields } = parseFrontmatter(content);
  const fieldNames = Object.keys(fields);
  if (fieldNames.length > 0) {
    structureRules.push({
      type: 'require-frontmatter',
      fields: fieldNames,
      error: `文档必须包含 frontmatter 字段: ${fieldNames.join(', ')}`,
      level: 'error',
    });
    orderRules.push({ module: 'frontmatter', position: 0 });
  }

  // 2. `## ` heading sequence → orderRules
  const lines = content.split('\n');
  let position = orderRules.length;
  let maxDepth = 1;
  let hasLangCodeBlock = false;
  let inFence = false;

  for (const line of lines) {
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      if (!inFence && fenceMatch[1]) hasLangCodeBlock = true;
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      if (depth > maxDepth) maxDepth = depth;
      // Only level-2 headings define module order
      if (depth === 2) {
        orderRules.push({ module: headingMatch[2].trim(), position: position++ });
      }
    }
  }

  // 3. Code blocks with language tags → codeblock-language
  if (hasLangCodeBlock) {
    formatRules.push({ type: 'codeblock-language', enforce: true });
  }

  // 4. Deepest heading level → heading-depth
  if (maxDepth > 2) {
    formatRules.push({ type: 'heading-depth', max: maxDepth });
  }

  const baseName = fileName.replace(/\.[^.]+$/, '').trim() || '自定义规则集';

  return {
    id: `custom-${Date.now()}`,
    name: baseName,
    structureRules,
    orderRules,
    formatRules,
    styleRules: [],
    // Imported specs rarely enumerate every module exhaustively — tolerate extras.
    allowUnknownModules: true,
  };
}
