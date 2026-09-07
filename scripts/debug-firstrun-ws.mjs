// Debug：first=1 后工作区残留行是什么；刷新（无参）后历史是否恢复（UI 视角）
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 制造数据
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('跳过')); if (b) b.click(); });
await sleep(600);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(700);
const fi = await page.$('input[type=file]');
await fi.uploadFile(FIXTURE);
await sleep(1000);

// first=1 进入
await page.goto('http://localhost:3000/index.html?first=1', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(900);
const ws = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('.ws-folder-item, .ws-scope-card')].map(r => ({ cls: r.className, text: (r.textContent || '').trim().slice(0, 40) })),
  empty: document.querySelector('.ws-empty')?.textContent?.trim() ?? null,
  containerHead: document.querySelector('.workspace-scope-container')?.innerText.slice(0, 260) ?? null,
}));
console.log('first=1 工作区:', JSON.stringify(ws, null, 1));

// 刷新（无参）后 UI 验证历史恢复
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('版本历史')); if (i) i.click(); });
await sleep(900);
const hist = await page.evaluate(() => document.querySelectorAll('.version-item').length);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(900);
const imp = await page.evaluate(() => document.querySelectorAll('.ws-folder-item').length);
console.log('刷新后 UI: 版本行数 =', hist, '| 导入文件行数 =', imp);
await browser.close();
