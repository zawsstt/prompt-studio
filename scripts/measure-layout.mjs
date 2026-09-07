// 临时调试脚本：测量关键元素矩形，找出重叠/溢出
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.argv[2] || 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

const measure = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, sel);

const rects = {};
for (const sel of ['.nav-column', '.topbar', '.content-area', '.editor-view', '.code-pane', '.chat-panel', '.doc-indicator', '.tabs']) {
  rects[sel] = await measure(sel);
}
console.log('=== 主界面矩形 (1600x900) ===');
console.log(JSON.stringify(rects, null, 1));

// 通过 vite 模块句柄直接打开 diff 视图（验证其几何覆盖范围）
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  m.useStore.setState({ candidateContent: s.docContent + '\n# 候选修改测试\n- 新增一行' });
  s.openDiff();
});
await new Promise(r => setTimeout(r, 1200));
const diffRect = await measure('.diff-overlay');
const toolbarRect = await measure('.diff-toolbar');
console.log('=== diff 视图 (openDiff 后) ===');
console.log('diff-overlay:', JSON.stringify(diffRect));
console.log('diff-toolbar:', JSON.stringify(toolbarRect));

// 溢出检测：滚动宽度 > 视口宽度
const overflow = await page.evaluate(() => {
  const issues = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 50) {
      const cls = (el.className || '').toString().slice(0, 60);
      issues.push({ tag: el.tagName, cls, sw: el.scrollWidth, cw: el.clientWidth });
    }
  });
  return issues.slice(0, 15);
});
console.log('=== 横向溢出元素 ===');
console.log(JSON.stringify(overflow, null, 1));

await browser.close();
