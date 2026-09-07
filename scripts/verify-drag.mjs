// 临时验证脚本：自动整理弹窗拖拽排序端到端测试 + 侧边栏底部对齐检查
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

// 0) 打乱文档模块顺序（确保 doAutoOrganize 会生成整理预览）
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const content = s.docContent;
  const lines = content.split('\n');
  // 把 References 模块移到最前（打乱顺序）
  const refIdx = lines.findIndex(l => l.startsWith('## References'));
  if (refIdx > 0) {
    const refBlock = lines.splice(refIdx);
    m.useStore.setState({ docContent: [...refBlock, '', ...lines].join('\n') });
  }
});

// 1) 打开自动整理弹窗
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().doAutoOrganize();
});
await new Promise(r => setTimeout(r, 800));

// 调试：弹窗状态
const debug = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const mods = [...s.docContent.matchAll(/^##\s+(.+)$/gm)].map(mm => mm[1].trim());
  return {
    preview: s.organizePreview ? { before: s.organizePreview.before, after: s.organizePreview.after } : null,
    modules: mods,
    hasConfirm: !!document.querySelector('.confirm-dialog'),
    toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent),
    rootChildren: document.getElementById('root')?.children.length ?? -1,
    bodySnippet: document.body.innerHTML.slice(0, 300),
  };
});
console.log('=== 调试状态 ===');
console.log(JSON.stringify(debug, null, 1));
if (!debug.preview) { console.log('❌ 弹窗未打开，中止'); await browser.close(); process.exit(1); }

const dialog = await page.evaluate(() => {
  const lis = [...document.querySelectorAll('.confirm-order-list')];
  const afterList = lis[1]; // 整理后
  const items = [...afterList.querySelectorAll('li')].map(li => ({
    text: li.textContent.trim(),
    draggable: li.draggable,
    hasHandle: !!li.querySelector('.drag-handle'),
    moved: li.classList.contains('confirm-moved'),
  }));
  return { count: items.length, items };
});
console.log('=== 弹窗整理后列表 ===');
console.log(JSON.stringify(dialog, null, 1));

// 2) 模拟拖拽：第0项拖到第2项位置（分步 + 等待 React 重渲染，模拟真实拖动时序）
await page.evaluate(() => {
  const afterList = document.querySelectorAll('.confirm-order-list')[1];
  const lis = [...afterList.querySelectorAll('li')];
  const dt = new DataTransfer();
  window.__dragDt = dt;
  lis[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
  window.__dragSource = lis[0];
});
await new Promise(r => setTimeout(r, 500)); // 等 React 处理 dragstart 的 setState
const midDrag = await page.evaluate(() => {
  const dragging = document.querySelector('.confirm-order-list li.dragging');
  return { hasDragging: !!dragging, text: dragging?.textContent.trim() };
});
console.log('=== dragstart 后 ===');
console.log(JSON.stringify(midDrag, null, 1));

await page.evaluate(() => {
  const afterList = document.querySelectorAll('.confirm-order-list')[1];
  const lis = [...afterList.querySelectorAll('li')];
  const dt = window.__dragDt || new DataTransfer();
  lis[2].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
});
await new Promise(r => setTimeout(r, 300));
const overState = await page.evaluate(() => {
  const afterList = document.querySelectorAll('.confirm-order-list')[1];
  const lis = [...afterList.querySelectorAll('li')];
  return { over2: lis[2]?.classList.contains('drag-over'), items: lis.map(li => li.textContent.trim()) };
});
console.log('=== dragover 后 ===');
console.log(JSON.stringify(overState, null, 1));

await page.evaluate(() => {
  const afterList = document.querySelectorAll('.confirm-order-list')[1];
  const lis = [...afterList.querySelectorAll('li')];
  const dt = window.__dragDt || new DataTransfer();
  lis[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  lis[0].dispatchEvent(new DragEvent('dragend', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 600));

const afterDrag = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const preview = m.useStore.getState().organizePreview;
  const afterList = document.querySelectorAll('.confirm-order-list')[1];
  const items = [...afterList.querySelectorAll('li')].map(li => li.textContent.trim());
  return { storeAfter: preview?.after, uiItems: items };
});
console.log('=== 拖拽后顺序（应第0项移到第2位） ===');
console.log(JSON.stringify(afterDrag, null, 1));

// 3) 确认整理 → 验证文档模块顺序
await page.evaluate(() => {
  document.querySelectorAll('.confirm-footer .btn-primary')[0]?.click();
});
await new Promise(r => setTimeout(r, 800));
const result = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const content = m.useStore.getState().docContent;
  const mods = [...content.matchAll(/^##\s+(.+)$/gm)].map(mm => mm[1].trim());
  return { modules: mods };
});
console.log('=== 确认后文档模块顺序 ===');
console.log(JSON.stringify(result, null, 1));

// 4) 侧边栏收缩态底部对齐
const navBottom = await page.evaluate(() => {
  const nav = document.querySelector('.nav-column').getBoundingClientRect();
  const gear = document.querySelector('.nav-group-bottom .nav-item .nav-icon').getBoundingClientRect();
  const avatar = document.querySelector('.nav-group-bottom .avatar').getBoundingClientRect();
  const center = nav.x + nav.width / 2;
  return {
    navW: Math.round(nav.width),
    gearCenter: Math.round(gear.x + gear.width / 2),
    avatarCenter: Math.round(avatar.x + avatar.width / 2),
    center,
    gearOffset: Math.round(gear.x + gear.width / 2 - center),
    avatarOffset: Math.round(avatar.x + avatar.width / 2 - center),
  };
});
console.log('=== 侧边栏收缩态底部对齐 ===');
console.log(JSON.stringify(navBottom, null, 1));

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\drag-final.png' });
await browser.close();
