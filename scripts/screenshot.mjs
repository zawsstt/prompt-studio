// 临时调试脚本：桌面尺寸截图 + 控制台错误捕获
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.argv[2] || 'http://localhost:3000';
const OUT = process.argv[3] || 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\theme-shot.png';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,900'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));
page.on('console', msg => {
  if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`);
});

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: OUT });
console.log(`screenshot → ${OUT}`);
await browser.close();
