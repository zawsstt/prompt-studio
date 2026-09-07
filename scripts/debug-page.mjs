// 临时调试脚本：用系统 Edge 加载页面，抓取控制台错误、页面错误与 DOM 状态
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu'],
});

const page = await browser.newPage();
page.on('console', msg => {
  const type = msg.type();
  if (['error', 'warning'].includes(type)) {
    console.log(`[${type}] ${msg.text()}`);
  }
});
page.on('pageerror', err => console.log(`[pageerror] ${err.stack || err.message}`));
page.on('requestfailed', req => console.log(`[requestfailed] ${req.url()} → ${req.failure()?.errorText}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 6000)); // 等 init() 完成

const dom = await page.evaluate(() => {
  const root = document.getElementById('root');
  return {
    rootChildren: root ? root.children.length : -1,
    bodyText: document.body.innerText.slice(0, 500),
    bodyHtml: document.body.innerHTML.slice(0, 800),
  };
});
console.log('=== DOM 状态 ===');
console.log(JSON.stringify(dom, null, 2));

await browser.close();
