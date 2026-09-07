// 发版前验证：①全新用户主文档=空白模板（非业务示例）②first=1 同 ③重置全部数据回归
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ══ 1. 全新用户（fresh profile）：跳过引导 → 打开主文档 → 应显示空白模板 ══
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('跳过')); if (b) b.click(); });
await sleep(600);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.wg-actions .btn')];
  const b = btns.find(x => x.textContent.includes('打开主文档'));
  if (b) b.click();
});
await sleep(1200);
const fresh = await page.evaluate(() => {
  const host = document.querySelector('.cm-content');
  return {
    crumb: document.querySelector('.doc-indicator b')?.textContent ?? null,
    hasBusinessData: (host?.textContent || '').includes('驾驶舱') || (host?.textContent || '').includes('财经'),
    hasTemplate: (host?.textContent || '').includes('your-agent-name') || (host?.textContent || '').includes('# Instructions'),
    head: host?.textContent?.slice(0, 60) ?? null,
  };
});
console.log('1. 全新用户主文档:', JSON.stringify(fresh, null, 1));

// ══ 2. first=1 演示模式：同模板 + 无历史 ══
await page.goto('http://localhost:3000/index.html?first=1', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.wg-actions .btn')];
  const b = btns.find(x => x.textContent.includes('打开主文档'));
  if (b) b.click();
});
await sleep(1200);
const demo = await page.evaluate(() => {
  const host = document.querySelector('.cm-content');
  return {
    onboarding: !!document.querySelector('.ob-steps'),
    crumb: document.querySelector('.doc-indicator b')?.textContent ?? null,
    hasBusinessData: (host?.textContent || '').includes('驾驶舱') || (host?.textContent || '').includes('财经'),
    hasTemplate: (host?.textContent || '').includes('your-agent-name'),
  };
});
console.log('2. first=1 演示模式:', JSON.stringify(demo, null, 1));

// ══ 3. 重置全部数据：制造数据 → ?reset=1 → 回到全新态 ══
// 先造数据（导入文件）
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('跳过')); if (b) b.click(); });
await sleep(600);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(700);
const fi = await page.$('input[type=file]');
await fi.uploadFile('D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\scripts\\t06d-fixture.md');
await sleep(1200);
// ?reset=1 触发重置
await page.goto('http://localhost:3000/index.html?reset=1', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(5000);
const reset = await page.evaluate(() => ({
  url: location.href,
  onboarding: !!document.querySelector('.ob-steps'),
  welcome: !!document.querySelector('.welcome-guide'),
  dbCounts: null, // 下面单独查
}));
const dbCounts = await page.evaluate(async () => {
  const { db } = await import('/src/store/db.ts');
  return {
    imports: await db.imports.count(),
    docs: await db.docs.count(),
    versions: await db.versions.count(),
    chats: await db.chats.count(),
  };
});
console.log('3. ?reset=1 重置:', JSON.stringify({ ...reset, dbCounts }, null, 1));
console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
