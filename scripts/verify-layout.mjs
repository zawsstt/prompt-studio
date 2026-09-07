// 临时验证脚本：编辑器滚动 + 侧边栏 hover 展开
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

// 1) 编辑器滚动能力
const scrollInfo = await page.evaluate(() => {
  const scroller = document.querySelector('.cm-scroller');
  const host = document.querySelector('.cm-host');
  const wrapper = document.querySelector('.cm-wrapper');
  const ew = document.querySelector('.editor-wrapper');
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { h: Math.round(b.height), sh: el.scrollHeight, cw: el.clientWidth };
  };
  // 尝试滚动
  let scrollable = false;
  if (scroller) {
    scroller.scrollTop = 500;
    scrollable = scroller.scrollTop > 0;
  }
  return {
    editorWrapper: r(ew),
    cmWrapper: r(wrapper),
    cmHost: r(host),
    scroller: r(scroller),
    scrollable,
  };
});
console.log('=== 编辑器滚动 ===');
console.log(JSON.stringify(scrollInfo, null, 1));
console.log(scrollInfo.scrollable ? '✅ 编辑器可滚动' : '❌ 编辑器仍不可滚动');

// 2) 侧边栏收缩态
const collapsed = await page.evaluate(() => {
  const nav = document.querySelector('.nav-column');
  const r = nav.getBoundingClientRect();
  const name = getComputedStyle(document.querySelector('.sb-name'));
  const main = document.querySelector('.main-content');
  const mr = main.getBoundingClientRect();
  return { w: Math.round(r.width), labelOpacity: name.opacity, mainX: Math.round(mr.x) };
});
console.log('=== 侧边栏收缩态 ===');
console.log(JSON.stringify(collapsed, null, 1));

// 3) hover 展开
await page.hover('.nav-column');
await new Promise(r => setTimeout(r, 500));
const expanded = await page.evaluate(() => {
  const nav = document.querySelector('.nav-column');
  const r = nav.getBoundingClientRect();
  const name = getComputedStyle(document.querySelector('.sb-name'));
  return { w: Math.round(r.width), labelOpacity: name.opacity };
});
console.log('=== 侧边栏 hover 展开态 ===');
console.log(JSON.stringify(expanded, null, 1));
console.log(expanded.w > collapsed.w ? '✅ hover 展开生效' : '❌ hover 展开失效');

await browser.close();
