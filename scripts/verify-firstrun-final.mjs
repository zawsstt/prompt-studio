// 最终复核：first=1 隔离（正确选择器）+ 无参刷新恢复
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
const wsSnap = () => page.evaluate(() => ({
  fileRows: document.querySelectorAll('.ws-module-item').length,
  scopes: document.querySelectorAll('.ws-scope-card').length,
  labels: [...document.querySelectorAll('.ws-group-label')].map(l => (l.textContent || '').trim()).filter(Boolean),
}));

// 1. 制造老用户数据（导入文件）
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('跳过')); if (b) b.click(); });
await sleep(600);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(700);
const fi = await page.$('input[type=file]');
await fi.uploadFile(FIXTURE);
await sleep(1500);

// 2. first=1 → 全新态
await page.goto('http://localhost:3000/index.html?first=1', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(900);
console.log('first=1 工作区:', JSON.stringify(await wsSnap()));

// 3. 无参刷新 → 恢复历史
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(900);
console.log('刷新后工作区:', JSON.stringify(await wsSnap()));
await browser.close();
