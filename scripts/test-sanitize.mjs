// 脱敏引擎单元验证（node 24 直接跑 TS：type stripping）
import { buildMaskRegistry, collectSensitiveTokens, maskText, unmaskText, extractMaskIds, BUILTIN_RULES } from '../src/lib/sanitize.ts';

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { pass++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name} ${detail}`); }
}

// ── 1. 全局一致编号：同一 token 多文档同编号 ──
const terms = ['详细指标A', '用户手机号字段'];
const docs = [
  '指标口径说明：详细指标A = 新增注册用户数，底表 ods_user_info_daily。',
  'BI 报表口径：详细指标A 与 ods_user_info_daily 关联。用户手机号字段请脱敏。',
  'ods_user_info_daily 分区按天。',
];
const tokens = collectSensitiveTokens(docs, terms, BUILTIN_RULES);
const reg = buildMaskRegistry(tokens);
const masked = docs.map(d => maskText(d, reg));

// 编号按 token 长度降序分配：ods_user_info_daily(18)→001, 用户手机号字段(7)→002, 详细指标A(5)→003
assert('识别出 3 类 token（指标A/手机号字段/SQL 表）', reg.byId.size === 3, `got ${reg.byId.size}: ${[...reg.byId.values()]}`);
assert('SQL 表全局同编号 001', masked[0].includes('{{SENS-001}}') && masked[1].includes('{{SENS-001}}'), masked[0]);
assert('手机号字段全局同编号 002', masked[1].includes('{{SENS-002}}'), masked[1]);
assert('详细指标A 全局同编号 003', masked[0].includes('{{SENS-003}}') && masked[1].includes('{{SENS-003}}'), masked[1]);
assert('原文不在脱敏文本中', !masked.join('').includes('详细指标A'));
console.log('  样本:', masked[0]);

// ── 2. 还原：一对一 ──
const restored = masked.map(m => unmaskText(m, reg));
assert('还原后与原文一致', restored[0] === docs[0] && restored[1] === docs[1] && restored[2] === docs[2]);

// ── 3. AI 可能微调编号：裸 SENS-003（无括号）也能还原（003 = 详细指标A） ──
const aiOutput = '将 {{SENS-003}} 的口径改为「累计注册用户数」，并新增引用 SENS-003。';
const restoredAI = unmaskText(aiOutput, reg);
assert('裸编号还原', restoredAI.includes('详细指标A') && restoredAI.includes('新增引用 详细指标A'), restoredAI);

// ── 4. 未知编号保留（AI 幻觉） ──
const halluc = '参考 SENS-099 的口径';
assert('未知编号原样保留', unmaskText(halluc, reg) === halluc);

// ── 5. 长 token 优先（防子串） ──
const t2 = ['内网IP段', 'IP'];
const reg2 = buildMaskRegistry(collectSensitiveTokens(['内网IP段 10.1.1.1'], t2, []));
const m2 = maskText('内网IP段 10.1.1.1', reg2);
assert('长词先替换防子串', m2.includes('{{SENS-001}} 10.1.1.1'), m2);

// ── 6. 提取编号集合 ──
const ids = extractMaskIds('{{SENS-001}} 与 SENS-002');
assert('编号提取', ids.length === 2 && ids[0] === 'SENS-001' && ids[1] === 'SENS-002', JSON.stringify(ids));

// ── 7. 内置规则：手机号/邮箱/身份证/内网 IP ──
const t3 = collectSensitiveTokens(['联系 13800138000，邮箱 a.b@corp.cn，证件 11010119900307789X，内网 192.168.1.5'], [], BUILTIN_RULES);
assert('内置规则 4 类命中', t3.has('13800138000') && t3.has('a.b@corp.cn') && t3.has('11010119900307789X') && t3.has('192.168.1.5'), JSON.stringify([...t3]));

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
