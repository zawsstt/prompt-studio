// 临时调试脚本：侧边栏收缩态 + hover 展开态截图
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\sb-collapsed.png' });
await page.hover('.nav-column');
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\sb-expanded.png' });
console.log('done');
await browser.close();
