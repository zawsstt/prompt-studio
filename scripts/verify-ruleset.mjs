// 验证：规则集页渲染 + 规则详情 + 锁定断言修正
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1366,768'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

// 锁定守卫（修正断言：初始 selected=true，锁定后 toggle 被拒 → 保持 true）
const lockTest = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const scope = s.parseDocumentModules();
  s.createScope('锁定测试', '', scope);
  const id = m.useStore.getState().workspaceScopes[0].id;
  m.useStore.getState().toggleScopeLocked(id);
  const heading = m.useStore.getState().workspaceScopes[0].modules[0].heading;
  const initial = m.useStore.getState().workspaceScopes[0].modules[0].selected;
  m.useStore.getState().toggleModuleInScope(id, heading); // 锁定 → 应被拒
  const locked = m.useStore.getState().workspaceScopes[0].modules[0].selected;
  m.useStore.getState().toggleScopeLocked(id); // 解锁
  m.useStore.getState().toggleModuleInScope(id, heading); // 解锁 → 应生效
  const unlocked = m.useStore.getState().workspaceScopes[0].modules[0].selected;
  return { initial, locked, unlocked };
});
console.log('=== 3) 锁定守卫（修正断言） ===');
console.log(JSON.stringify(lockTest, null, 1));
console.log(
  lockTest.locked === lockTest.initial && lockTest.unlocked !== lockTest.locked
    ? '✅ 锁定后 toggle 被拒（值不变），解锁后生效'
    : `❌ ${JSON.stringify(lockTest)}`
);

// 规则集页
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ activeView: 'ruleset' });
});
await new Promise(r => setTimeout(r, 1000));

const rsm = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.rsm-card')].map(c => ({
    name: c.querySelector('.rsm-card-name')?.textContent?.trim().slice(0, 50),
    meta: c.querySelector('.rsm-card-meta')?.textContent?.trim(),
  }));
  const hasImportBtn = [...document.querySelectorAll('.rsm-actions .btn')].some(b => b.textContent.includes('导入规则集'));
  const hasNewBtn = [...document.querySelectorAll('.rsm-actions .btn')].some(b => b.textContent.includes('新建'));
  return { cardCount: cards.length, cards, hasImportBtn, hasNewBtn };
});
console.log('=== 5) 规则集页 ===');
console.log(JSON.stringify(rsm, null, 1));
console.log(rsm.cardCount >= 4 && rsm.hasImportBtn && rsm.hasNewBtn ? '✅ 规则集页渲染完整' : '❌ 规则集页异常');

// 展开卡片看规则详情
await page.evaluate(() => {
  const head = document.querySelector('.rsm-card-head');
  if (head) head.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 500));
const detail = await page.evaluate(() => ({
  kindTitles: [...document.querySelectorAll('.rs-kind-title')].map(el => el.textContent.trim()),
  ruleCount: document.querySelectorAll('.rs-kind-rule').length,
  sample: document.querySelector('.rs-kind-rule')?.textContent?.trim().slice(0, 60),
}));
console.log('=== 5b) 规则详情 ===');
console.log(JSON.stringify(detail, null, 1));
console.log(detail.ruleCount > 0 ? '✅ 规则详情展示' : '❌ 规则详情为空');

// 复制为自定义
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.rsm-card .btn')];
  const copyBtn = btns.find(b => b.textContent.includes('复制为自定义'));
  if (copyBtn) copyBtn.click();
});
await new Promise(r => setTimeout(r, 800));
const afterCopy = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const customs = m.useStore.getState().customRulesets;
  return customs.map(r => ({ name: r.name, rules: r.structureRules.length + r.orderRules.length + r.formatRules.length + r.styleRules.length }));
});
console.log('=== 5c) 复制为自定义 ===');
console.log(JSON.stringify(afterCopy, null, 1));
console.log(afterCopy.length > 0 ? '✅ 复制为自定义成功' : '❌ 复制失败');

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\ruleset-final.png' });
await browser.close();
