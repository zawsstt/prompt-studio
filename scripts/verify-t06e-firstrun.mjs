// T06e 首次引导隔离自检：老用户（有真实数据）→ 从官网 first=1 进入 → 历史数据不露面；刷新（无参）→ 恢复历史
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FIXTURE = 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\scripts\\t06d-fixture.md';

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

// ══ 1. 制造「老用户」数据：跳过引导 + 导入文件 + 生成版本（自动整理→确认） ══
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.settings-footer .btn')];
  const skip = btns.find(b => b.textContent.includes('跳过'));
  if (skip) skip.click();
});
await sleep(600);
// 导入文件
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-item')];
  const it = items.find(i => i.textContent.includes('工作区范围'));
  if (it) it.click();
});
await sleep(700);
const fileInput = await page.$('input[type=file]');
await fileInput.uploadFile(FIXTURE);
await sleep(1000);
// 生成一个版本：自动整理（主文档）→ 确认
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.top-right .btn')];
  const b = btns.find(x => x.textContent.includes('自动整理'));
  if (b) b.click();
});
await sleep(900);
page.on('dialog', d => d.accept());
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.confirm-footer .btn')];
  const b = btns.find(x => x.textContent.includes('确认整理'));
  if (b) b.click();
});
await sleep(1500);
const seeded = await page.evaluate(() => ({
  fileCount: document.querySelectorAll('.nav-submenu-item').length, // 展开前不计，先记录 workspace 状态
  versions: null,
}));
// 打开历史视图确认有版本
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-item')];
  const it = items.find(i => i.textContent.includes('版本历史'));
  if (it) it.click();
});
await sleep(900);
const histBefore = await page.evaluate(() => document.querySelectorAll('.version-item').length);
console.log('1. 老用户数据就绪: 版本数 =', histBefore);

// ══ 2. 从官网入口 first=1 进入 → 历史数据应全部不露面 ══
await page.goto('http://localhost:3000/index.html?first=1', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
const fresh = await page.evaluate(() => ({
  url: location.href,
  onboarding: !!document.querySelector('.ob-steps'),
  welcome: !!document.querySelector('.welcome-guide'),
  crumb: document.querySelector('.doc-indicator b')?.textContent ?? null,
  chatEmpty: !!document.querySelector('.chat-empty'),
  editorSample: (document.querySelector('.cm-content')?.textContent || '').includes('驾驶舱'),
}));
// 工作区视图：无导入文件
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-item')];
  const it = items.find(i => i.textContent.includes('工作区范围'));
  if (it) it.click();
});
await sleep(900);
const wsFresh = await page.evaluate(() => ({
  fileRows: document.querySelectorAll('.ws-folder-item, .ws-scope-card').length,
  emptyText: document.querySelector('.ws-empty, .nav-submenu-empty')?.textContent?.trim() ?? null,
}));
// 历史视图：无版本
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-item')];
  const it = items.find(i => i.textContent.includes('版本历史'));
  if (it) it.click();
});
await sleep(900);
const histFresh = await page.evaluate(() => document.querySelectorAll('.version-item').length);
console.log('2. first=1 全新态:', JSON.stringify({ ...fresh, wsFresh, histFresh }, null, 1));

// ══ 3. 刷新（无参）→ 恢复老用户历史 ══
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
const restored = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  return {
    versions: s.versions.length,
    imports: s.importedFiles.length,
    scopes: s.workspaceScopes.length,
    chat: s.chatMessages.length,
    docHead: s.docContent.slice(0, 30),
  };
});
console.log('3. 刷新恢复:', JSON.stringify(restored, null, 1));
console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
