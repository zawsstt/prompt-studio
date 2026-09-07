// 实证：UI 导入文件 → 无参刷新 → 是否恢复（检查 saveImportedFile 落库）
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

await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('跳过')); if (b) b.click(); });
await sleep(600);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(700);
const fi = await page.$('input[type=file]');
await fi.uploadFile(FIXTURE);
await sleep(2000);

// 1. 导入后 UI 计数
const afterImport = await page.evaluate(() => document.querySelectorAll('.ws-folder-item').length);
// 2. 直接从 db 读（实例无关：Dexie 是全局的）
const dbCount = await page.evaluate(async () => {
  const { db } = await import('/src/store/db.ts');
  return { imports: await db.imports.count(), versions: await db.versions.count(), docs: await db.docs.count() };
});
console.log('导入后: UI行数 =', afterImport, '| db.imports =', dbCount.imports, '| db.versions =', dbCount.versions, '| db.docs =', dbCount.docs);

// 3. 无参刷新 → UI 恢复计数
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(900);
const afterReload = await page.evaluate(() => document.querySelectorAll('.ws-folder-item').length);
console.log('刷新后: UI行数 =', afterReload);
await browser.close();
