import type { RuleSet } from '../types';

export const RULESETS: Record<string, RuleSet> = {
  'anthropic-skill': {
    id: 'anthropic-skill',
    name: 'Anthropic Skill 标准',
    structureRules: [
      { type: 'require-frontmatter', fields: ['name', 'description'], error: 'SKILL.md 必须包含 name 与 description frontmatter', level: 'error' },
      { type: 'require-module', module: 'Instructions', error: '缺少 Instructions 章节', level: 'warning' },
      { type: 'forbid-module', module: '系统提示词', error: "不要直接暴露'系统提示词'字样", level: 'warning' },
      { type: 'forbid-field', fields: ['internal-notes'], error: '禁止 internal-notes 字段（内部备注不应随 Skill 发布）', level: 'warning' },
    ],
    orderRules: [
      { module: 'frontmatter', position: 0 },
      { module: 'Instructions', position: 1 },
      { module: 'Output Format', position: 2 },
      { module: 'Examples', position: 3 },
      { module: 'References', position: 4, optional: true },
    ],
    formatRules: [
      { type: 'yaml-frontmatter' },
      { type: 'codeblock-language', enforce: true },
      { type: 'heading-depth', max: 3 },
      { type: 'line-width', max: 120, warning: true },
    ],
    styleRules: [
      { type: 'person-consistency', person: 'you', error: '指令人称不统一', level: 'info' },
      { type: 'imperative-verbs', enforce: true },
      { type: 'forbid-words', words: ['尽量', '可能的话'], error: '模糊词削弱指令确定性', level: 'warning' },
    ],
  },
  'generic-prompt': {
    id: 'generic-prompt',
    name: '通用 Prompt',
    structureRules: [
      { type: 'require-module', module: 'Instructions', error: '建议包含 Instructions 指令章节', level: 'info' },
    ],
    orderRules: [],
    formatRules: [
      { type: 'codeblock-language', enforce: true },
      { type: 'heading-depth', max: 4 },
    ],
    styleRules: [
      { type: 'forbid-words', words: ['尽量', '可能的话'], error: '避免使用模糊词', level: 'warning' },
    ],
  },
  'openai-function': {
    id: 'openai-function',
    name: 'OpenAI Function',
    structureRules: [
      { type: 'require-frontmatter', fields: ['name'], error: 'Function 必须包含 name 字段', level: 'error' },
    ],
    orderRules: [
      { module: 'frontmatter', position: 0 },
      { module: 'description', position: 1 },
      { module: 'parameters', position: 2 },
    ],
    formatRules: [
      { type: 'codeblock-language', enforce: true },
    ],
    styleRules: [],
  },
  'custom-blank': {
    id: 'custom-blank',
    name: '自定义（空白模板）',
    structureRules: [],
    orderRules: [],
    formatRules: [],
    styleRules: [],
    allowUnknownModules: true,
  },
};

export function getRuleSet(id: string): RuleSet | undefined {
  return RULESETS[id];
}

export function getRuleSetList(): RuleSet[] {
  return Object.values(RULESETS);
}

/** Built-in rulesets merged with user-defined ones (custom wins on id collision). */
export function mergeRulesets(custom: RuleSet[] = []): RuleSet[] {
  const merged = new Map<string, RuleSet>();
  for (const rs of Object.values(RULESETS)) merged.set(rs.id, rs);
  for (const rs of custom) merged.set(rs.id, rs);
  return Array.from(merged.values());
}

/** Find a ruleset by id across built-in and custom sets. */
export function findRuleset(id: string, custom: RuleSet[] = []): RuleSet | undefined {
  return RULESETS[id] || custom.find(r => r.id === id);
}
