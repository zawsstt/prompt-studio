// 验证：侧边栏 hover 展开态文字与对齐
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

await page.hover('.nav-column');
await new Promise(r => setTimeout(r, 700));

const state = await page.evaluate(() => {
  const nav = document.querySelector('.nav-column').getBoundingClientRect();
  const labels = [...document.querySelectorAll('.nav-label-wrap')].map(l => ({
    text: l.textContent.trim().slice(0, 12),
    opacity: getComputedStyle(l).opacity,
  }));
  const userInfo = document.querySelector('.sb-user-info');
  const mark = document.querySelector('.sb-head .mark').getBoundingClientRect();
  return {
    navW: Math.round(nav.width),
    labels: labels.slice(0, 4),
    userInfoOpacity: userInfo ? getComputedStyle(userInfo).opacity : 'n/a',
    markX: Math.round(mark.x),
  };
});
console.log('=== hover 展开态 ===');
console.log(JSON.stringify(state, null, 1));

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\sidebar-hover-final.png' });
await browser.close();
