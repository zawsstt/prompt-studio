// 脱敏编码本回归测试（Node 直跑，esbuild 转译）
//
//   npx esbuild tests/sanitize.entry.ts --bundle --format=esm --platform=node --outfile=tests/_sanitize.mjs
//   node tests/_sanitize.mjs

import {
  BUILTIN_RULES, buildMaskLegend, buildMaskRegistry, collectSensitiveTokens,
  inferSensitiveLabel, maskText, parseSensitiveTermLines, unmaskText,
} from '../src/lib/sanitize';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra); }
};

console.log('\n[1] 自定义词条解析');
const entries = parseSensitiveTermLines([
  '详细指标A | 业务指标',
  'ods_user_info_daily｜数据表名',
  '张某某 | 客户姓名',
  '手机号条目',
  '',
  '详细指标A | 业务指标（覆盖）',
  '   ',
]);
ok('空行被忽略、重复词条合并', entries.length === 4, `got ${entries.length}`);
ok('半角 | 解析出含义标记', entries.find(e => e.value === '详细指标A')?.label === '业务指标（覆盖）');
ok('全角 ｜ 解析出含义标记', entries.find(e => e.value === 'ods_user_info_daily')?.label === '数据表名');
ok('没有标记时 label 为空', entries.find(e => e.value === '手机号条目')?.label === '');
ok('解析结果只保留真实词条（不含标记）',
  entries.every(e => !e.value.includes('|') && !e.value.includes('｜')));

console.log('\n[2] 类型标记与编号');
const custom = [
  { value: '详细指标A', label: '业务指标' },
  { value: 'ods_user_info_daily', label: '' },
  { value: '张某某', label: '客户姓名' },
];
const text = [
  'ods_user_info_daily 是底表，详细指标A 需要优化。',
  '客户张某某，手机 13800138000，邮箱 a@b.com，内网 192.168.1.10。',
].join('\n');
const labels = new Map(custom.map(e => [e.value, e.label]));
const tokens = collectSensitiveTokens([text], custom.map(e => e.value), BUILTIN_RULES);
const reg = buildMaskRegistry(tokens, t => labels.get(t) || '');
const idOf = (v: string) => reg.byToken.get(v);

ok('自定义词条被收集', !!idOf('详细指标A') && !!idOf('张某某'));
ok('SQL 底表自动识别类型', !!idOf('ods_user_info_daily') && reg.labelById.get(idOf('ods_user_info_daily')!) === 'SQL 底表名');
ok('自定义标记优先', reg.labelById.get(idOf('张某某')!) === '客户姓名');
ok('内置手机号自动识别', !!idOf('13800138000') && reg.labelById.get(idOf('13800138000')!) === '手机号');
ok('内置邮箱自动识别', !!idOf('a@b.com') && reg.labelById.get(idOf('a@b.com')!) === '邮箱');
ok('内置内网 IP 自动识别', !!idOf('192.168.1.10') && reg.labelById.get(idOf('192.168.1.10')!) === '内网 IP');
ok('未知自定义词条回退', buildMaskRegistry(new Set(['一些业务词'])).labelById.get('SENS-001') === '自定义敏感词');
ok('inferSensitiveLabel 对非内置词条返回空', inferSensitiveLabel('一些业务词') === '');

console.log('\n[3] 脱敏 / 还原');
const masked = maskText(text, reg);
ok('全部命中替换为 {{SENS-xxx}}', (masked.match(/\{\{SENS-\d{3,}\}\}/g) || []).length >= 6);
ok('脱敏文本不包含任何原文',
  !masked.includes('ods_user_info_daily') &&
  !masked.includes('详细指标A') &&
  !masked.includes('张某某') &&
  !masked.includes('13800138000') &&
  !masked.includes('a@b.com') &&
  !masked.includes('192.168.1.10'),
  masked);
ok('unmaskText 精确还原', unmaskText(masked, reg) === text);
ok('兼容 AI 去掉双大括号的编号', unmaskText(masked.replace(/\{\{|\}\}/g, ''), reg) === text);

console.log('\n[4] 编码本');
const legend = buildMaskLegend(reg, [masked]);
ok('生成编码本', !!legend);
ok('编码本包含类型标记',
  !!legend && legend.includes('SQL 底表名') && legend.includes('业务指标') && legend.includes('客户姓名') && legend.includes('手机号') && legend.includes('邮箱') && legend.includes('内网 IP'));
ok('编码本只包含编号，不泄露原文',
  !!legend &&
  !legend.includes('ods_user_info_daily') &&
  !legend.includes('详细指标A') &&
  !legend.includes('张某某') &&
  !legend.includes('13800138000') &&
  !legend.includes('a@b.com') &&
  !legend.includes('192.168.1.10'));
ok('编码本要求保留占位符',
  !!legend && legend.includes('不要猜测') && legend.includes('including braces'));

const reg2 = buildMaskRegistry(new Set(['只出现词', '未出现词']));
const masked2 = maskText('只出现词', reg2);
const legend2 = buildMaskLegend(reg2, [masked2]);
ok('编码本只列本次实际用到的编号',
  !!legend2 && (legend2.match(/- \{\{SENS-\d{3,}\}\}/g) || []).length === 1,
  legend2 ?? 'null');
ok('没有编号时返回 null', buildMaskLegend(reg, ['普通文本']) === null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
