// QA regression tests for src/lib/validation.ts
// Covers: forbid-field / require-frontmatter / require-module / forbid-module /
// unknown-module / yaml-frontmatter / codeblock-language / heading-depth /
// line-width / forbid-words / imperative-verbs / module order + parse helpers.

import { suite, test, assert, assertEqual, assertIncludes } from './helpers';
import { validate, parseFrontmatter, findModules, autoOrganize } from '../src/lib/validation';
import type { RuleSet } from '../src/types';

function makeRuleset(overrides: Partial<RuleSet> = {}): RuleSet {
  return {
    id: 'qa',
    name: 'qa-ruleset',
    structureRules: [
      { type: 'require-frontmatter', fields: ['name', 'version'], level: 'error' },
      { type: 'forbid-field', fields: ['internal-notes'], error: '禁止字段 internal-notes', level: 'error' },
      { type: 'require-module', module: 'Role', error: '缺少 Role 模块', level: 'error' },
      { type: 'forbid-module', module: 'Draft', error: '禁止 Draft 模块', level: 'error' },
      { type: 'unknown-module', error: '', level: 'warning' },
    ],
    orderRules: [
      { module: 'Role', position: 0 },
      { module: 'Instructions', position: 1 },
      { module: 'Examples', position: 2 },
    ],
    formatRules: [
      { type: 'yaml-frontmatter' },
      { type: 'codeblock-language', enforce: true },
      { type: 'heading-depth', max: 4 },
      { type: 'line-width', max: 80, warning: true },
    ],
    styleRules: [
      { type: 'forbid-words', words: ['尽量', '等等'], level: 'warning' },
      { type: 'imperative-verbs' },
    ],
    ...overrides,
  };
}

// A fully compliant document: correct frontmatter, ordered modules, no style
// violations, code block with language, headings within depth limit.
const GOOD_DOC = [
  '---',
  'name: demo',
  'version: 1.0',
  '---',
  '',
  '## Role',
  '你是一名代码审查助手。',
  '',
  '## Instructions',
  '- 审查下列代码',
  '- 输出问题清单',
  '',
  '## Examples',
  '```ts',
  'const a = 1;',
  '```',
].join('\n');

// A document violating many rules at once.
const BAD_DOC = [
  '---',
  'name: demo',
  'internal-notes: secret', // forbid-field (line 2)
  '\tversion: 1.0', // tab-indented → YAML syntax error; also not parsed as field
  '---',
  '',
  '## Examples', // out of order (before Role/Instructions)
  '示例内容',
  '',
  '## Role',
  '角色描述尽量模糊一点', // forbid-words: 尽量 (line 11)
  '',
  '## Instructions',
  '- 你应该遵循以下规则', // imperative-verbs: expects info issue (line 14)
  '- 遵循输出格式',
  '',
  '## Random', // unknown module
  '随便写点等等', // forbid-words: 等等
  '',
  '```', // codeblock-language: bare fence
  'code',
  '```',
].join('\n');

suite('validation: parseFrontmatter / findModules helpers');

test('parseFrontmatter extracts fields, raw, body, endLine', () => {
  const { fields, body, endLine } = parseFrontmatter(GOOD_DOC);
  assertEqual(fields.name, 'demo', 'name field');
  assertEqual(fields.version, '1.0', 'version field');
  assertEqual(endLine, 4, 'frontmatter ends at line 4');
  assert(!body.includes('---'), 'body excludes frontmatter delimiters');
});

test('parseFrontmatter returns empty fields when no frontmatter', () => {
  const { fields, endLine, body } = parseFrontmatter('## Role\n内容');
  assertEqual(Object.keys(fields).length, 0, 'no fields');
  assertEqual(endLine, 0, 'endLine 0');
  assertEqual(body, '## Role\n内容', 'body is full content');
});

test('findModules returns module names with 1-based line ranges', () => {
  const modules = findModules(GOOD_DOC);
  assertEqual(modules.length, 3, 'three modules');
  assertEqual(modules[0].name, 'Role', 'first module Role');
  assertEqual(modules[0].startLine, 6, 'Role starts at line 6');
  assertEqual(modules[0].endLine, 9, 'Role ends before Instructions heading');
  assertEqual(modules[2].name, 'Examples', 'last module Examples');
});

suite('validation: structure rules');

test('forbid-field fires on the field line with rule error message', () => {
  const issues = validate(BAD_DOC, makeRuleset());
  const hit = issues.find(i => i.message.includes('internal-notes'));
  assert(hit, 'forbid-field issue exists');
  assertEqual(hit!.line, 2, 'reported at the internal-notes line');
  assertEqual(hit!.severity, 'error', 'severity from rule level');
});

test('forbid-field does not fire when field absent', () => {
  const issues = validate(GOOD_DOC, makeRuleset());
  assert(!issues.some(i => i.message.includes('internal-notes')), 'no forbid-field issue');
});

test('require-frontmatter reports missing field (tab-indented line is not a field)', () => {
  const issues = validate(BAD_DOC, makeRuleset());
  const hit = issues.find(i => i.message.includes('version'));
  assert(hit, 'missing version field reported');
  assertEqual(hit!.severity, 'error', 'severity error');
});

test('require-module fires when module missing; silent when present', () => {
  const noRole = '---\nname: a\nversion: 1\n---\n## Instructions\n- 做这件事';
  const issues = validate(noRole, makeRuleset());
  assert(issues.some(i => i.message === '缺少 Role 模块'), 'require-module fires');
  const ok = validate(GOOD_DOC, makeRuleset());
  assert(!ok.some(i => i.message === '缺少 Role 模块'), 'require-module silent');
});

test('forbid-module fires when module present; silent when absent', () => {
  const withDraft = GOOD_DOC + '\n\n## Draft\n草稿';
  const issues = validate(withDraft, makeRuleset());
  assert(issues.some(i => i.message === '禁止 Draft 模块'), 'forbid-module fires');
  const ok = validate(GOOD_DOC, makeRuleset());
  assert(!ok.some(i => i.message === '禁止 Draft 模块'), 'forbid-module silent');
});

test('unknown-module warns for modules not in orderRules', () => {
  const issues = validate(BAD_DOC, makeRuleset());
  const hit = issues.find(i => i.message.includes('未知模块: Random'));
  assert(hit, 'unknown-module warning exists');
  assertEqual(hit!.severity, 'warning', 'severity from unknown-module rule level');
});

test('unknown-module suppressed when allowUnknownModules is true', () => {
  const issues = validate(BAD_DOC, makeRuleset({ allowUnknownModules: true }));
  assert(!issues.some(i => i.message.includes('未知模块')), 'no unknown-module warnings');
});

suite('validation: format rules');

test('yaml-frontmatter flags real YAML syntax error (tab indentation)', () => {
  const issues = validate(BAD_DOC, makeRuleset());
  assert(
    issues.some(i => i.message.includes('YAML 语法错误') && i.severity === 'error'),
    'yaml-frontmatter error reported'
  );
});

test('yaml-frontmatter silent for well-formed frontmatter', () => {
  const issues = validate(GOOD_DOC, makeRuleset());
  assert(!issues.some(i => i.message.includes('YAML 语法错误')), 'no YAML error');
});

test('codeblock-language flags bare fences; silent for tagged fences', () => {
  const bad = validate(BAD_DOC, makeRuleset());
  assert(bad.some(i => i.message.includes('代码块应带语言标签')), 'bare fence flagged');
  const good = validate(GOOD_DOC, makeRuleset());
  assert(!good.some(i => i.message.includes('代码块应带语言标签')), 'tagged fence ok');
});

test('heading-depth honors rule.max: depth-4 heading allowed when max=4', () => {
  const doc = GOOD_DOC + '\n\n#### 四级标题\n内容';
  const issues = validate(doc, makeRuleset()); // max: 4
  assert(
    !issues.some(i => i.ruleType === 'format' && i.message.includes('标题层级')),
    'depth-4 heading should be allowed when max=4'
  );
});

test('heading-depth flags headings deeper than rule.max', () => {
  const doc = GOOD_DOC + '\n\n##### 五级标题\n内容';
  const issues = validate(doc, makeRuleset()); // max: 4
  assert(
    issues.some(i => i.message.includes('标题层级')),
    'depth-5 heading should be flagged when max=4'
  );
});

test('line-width flags overlong lines as warning', () => {
  const doc = GOOD_DOC + '\n' + '长'.repeat(100);
  const issues = validate(doc, makeRuleset());
  const hit = issues.find(i => i.message.includes('行宽超过'));
  assert(hit, 'line-width issue exists');
  assertEqual(hit!.severity, 'warning', 'warning when rule.warning is true');
});

suite('validation: style rules');

test('forbid-words flags banned vague words with correct line', () => {
  const issues = validate(BAD_DOC, makeRuleset());
  const hits = issues.filter(i => i.message.includes('禁止使用模糊词'));
  assertEqual(hits.length, 2, 'both 尽量 and 等等 flagged');
  assert(hits.some(h => h.message.includes('尽量') && h.line === 11), '尽量 at line 11');
  assert(hits.some(h => h.message.includes('等等')), '等等 flagged');
});

test('imperative-verbs flags "你应该" list items inside Instructions module', () => {
  const issues = validate(BAD_DOC, makeRuleset());
  const hit = issues.find(i => i.ruleType === 'style' && i.message.includes('祈使句'));
  assert(hit, 'imperative-verbs info issue expected for "- 你应该遵循以下规则"');
  assertEqual(hit!.line, 14, 'reported at the offending line');
  assertEqual(hit!.severity, 'info', 'severity info (non-blocking heuristic)');
});

test('imperative-verbs does not flag plain imperative list items', () => {
  const issues = validate(GOOD_DOC, makeRuleset());
  assert(!issues.some(i => i.message.includes('祈使句')), 'no imperative-verbs issue');
});

test('imperative-verbs only applies to Instructions-like modules', () => {
  const doc = [
    '---', 'name: a', 'version: 1', '---', '',
    '## Role', '角色', '',
    '## Examples', '- 你应该看这里', '', // not an Instructions module → no flag
    '## Instructions', '- 执行任务',
  ].join('\n');
  const issues = validate(doc, makeRuleset({ orderRules: [], structureRules: [] }));
  assert(!issues.some(i => i.message.includes('祈使句')), 'Examples module not checked');
});

suite('validation: module order');

test('module order violation reported for out-of-order modules', () => {
  const issues = validate(BAD_DOC, makeRuleset());
  const hit = issues.find(i => i.ruleType === 'order');
  assert(hit, 'order issue exists');
  assertIncludes(hit!.message, '模块顺序应为', 'order message format');
});

test('module order ok for correctly ordered modules', () => {
  const issues = validate(GOOD_DOC, makeRuleset());
  assert(!issues.some(i => i.ruleType === 'order'), 'no order issue');
});

suite('validation: compliant document smoke test');

test('fully compliant document produces zero issues', () => {
  const issues = validate(GOOD_DOC, makeRuleset());
  assertEqual(issues.length, 0, `expected no issues, got: ${JSON.stringify(issues)}`);
});

suite('validation: autoOrganize');

test('autoOrganize reorders modules per orderRules and keeps frontmatter', () => {
  const organized = autoOrganize(BAD_DOC.replace('\tversion: 1.0\n', ''), makeRuleset());
  const roleIdx = organized.indexOf('## Role');
  const instrIdx = organized.indexOf('## Instructions');
  const exIdx = organized.indexOf('## Examples');
  const randomIdx = organized.indexOf('## Random');
  assert(roleIdx !== -1 && instrIdx !== -1 && exIdx !== -1, 'all known modules kept');
  assert(roleIdx < instrIdx && instrIdx < exIdx, 'modules sorted by orderRules');
  assert(randomIdx > exIdx, 'unknown module goes last');
  assert(organized.startsWith('---'), 'frontmatter preserved at top');
});
