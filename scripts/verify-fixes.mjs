// 验证：1) replaced 块内相同行降级  2) 设置弹窗小窗口几何  3) 圈选左右识别
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1366,768'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

// 实例一致性 probe：翻转 showValidationPanel 看 DOM 是否响应
const probe = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const before = !!document.querySelector('.validation-panel-collapsed, .validation-panel');
  m.useStore.setState({ showValidationPanel: false });
  await new Promise(r => setTimeout(r, 300));
  const collapsed = !!document.querySelector('.validation-panel-collapsed');
  return { before, collapsed, works: before !== collapsed };
});
console.log('=== store 实例 probe ===');
console.log(JSON.stringify(probe, null, 1));
if (!probe.works) {
  console.log('❌ 动态 import 与 React 不同实例（HMR 残留），重新加载页面');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3500));
}

// ── 1) replaced 降级验证 ──
const openDiffResult = await page.evaluate(async () => {
  try {
    const m = await import('/src/store/useStore.ts');
    const s = m.useStore.getState();
    const lines = s.docContent.split('\n');
    const idx = lines.findIndex(l => l.includes('你是一个财经数据分析驾驶舱的主协调'));
    const candidate = [...lines];
    if (idx >= 0) {
      candidate[idx] = lines[idx].replace('接收用户的财经数据查询请求', '接收用户的财经查询请求');
    }
    m.useStore.setState({ candidateContent: candidate.join('\n') });
    s.openDiff();
    const after = m.useStore.getState();
    return {
      ok: true,
      idx,
      changed: after.docContent !== after.candidateContent,
      docLen: after.docContent.length,
      candLen: after.candidateContent.length,
      diffActive: after.diffActive,
      line: idx >= 0 ? lines[idx].slice(0, 60) : null,
    };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
console.log('=== openDiff ===');
console.log(JSON.stringify(openDiffResult, null, 1));
await new Promise(r => setTimeout(r, 1500));

const diffInfo = await page.evaluate(async () => {
  const counts = {};
  document.querySelectorAll('.dc-row').forEach(row => {
    const t = row.dataset.rowType || '?';
    counts[t] = (counts[t] || 0) + 1;
  });
  const repRows = [...document.querySelectorAll('.dc-row.replaced')].slice(0, 3).map(r => ({
    left: r.querySelector('.dc-cell-left')?.textContent ?? '',
    right: r.querySelector('.dc-cell-right')?.textContent ?? '',
    bgL: getComputedStyle(r.querySelector('.dc-cell-left')).backgroundColor,
  }));
  // 原始 diff 行数据 + candidateContent 对应段
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const repLeft = s.diffLeftLines.filter(l => l.type === 'replaced').slice(0, 2);
  const repRight = s.diffRightLines.filter(l => l.type === 'replaced').slice(0, 2);
  const candSeg = s.candidateContent.split('\n')[9]?.slice(0, 80) ?? 'n/a';
  const docSeg = s.docContent.split('\n')[9]?.slice(0, 80) ?? 'n/a';
  return {
    counts, repRows, hasDcRows: document.querySelectorAll('.dc-row').length,
    repLeft: repLeft.map(l => ({ content: l.content.slice(0, 60) })),
    repRight: repRight.map(l => ({ content: l.content.slice(0, 60) })),
    docLine9: docSeg,
    candLine9: candSeg,
  };
});
console.log('=== 1) replaced 降级验证 ===');
console.log(JSON.stringify(diffInfo, null, 1));
const sameLineReplaced = diffInfo.repRows.filter(r => r.left === r.right);
console.log(sameLineReplaced.length === 0
  ? '✅ 无"左右内容相同但标黄"的行'
  : `❌ 仍有 ${sameLineReplaced.length} 行左右相同却被标 replaced`);

// ── 2) 设置弹窗几何（1366x768 小窗口） ──
// 注：closeDiff 有未处理变更时会弹 window.confirm（headless 下阻塞），改用 setState 绕过
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ diffActive: false });
});
await new Promise(r => setTimeout(r, 500));
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().openSettings();
});
await new Promise(r => setTimeout(r, 800));

const modalGeo = await page.evaluate(() => {
  const d = document.querySelector('.settings-dialog').getBoundingClientRect();
  return {
    x: Math.round(d.x), y: Math.round(d.y),
    w: Math.round(d.width), h: Math.round(d.height),
    vw: window.innerWidth, vh: window.innerHeight,
    inside: d.x >= 0 && d.y >= 0 && d.x + d.width <= window.innerWidth && d.y + d.height <= window.innerHeight,
  };
});
console.log('=== 2) 设置弹窗小窗口几何 ===');
console.log(JSON.stringify(modalGeo, null, 1));
console.log(modalGeo.inside ? '✅ 弹窗完整在视口内' : '❌ 弹窗超出视口');

// ── 3) 圈选左右识别 ──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ settingsOpen: false });
});
await new Promise(r => setTimeout(r, 500));
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const lines = s.docContent.split('\n');
  const candidate = [...lines];
  candidate.push('# 附加测试块');
  m.useStore.setState({ candidateContent: candidate.join('\n') });
  s.openDiff();
});
await new Promise(r => setTimeout(r, 1200));

// 选左侧单元格
await page.evaluate(() => {
  const leftCell = document.querySelector('.dc-cell-left:not(.empty)');
  const target = leftCell.firstChild || leftCell;
  const range = document.createRange();
  range.selectNodeContents(target);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.querySelector('.dc-body').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 200));
const selLeft = await page.evaluate(() => {
  const tb = document.querySelector('.st-toolbar');
  return tb ? tb.querySelector('.st-source')?.textContent?.trim() : null;
});
console.log('=== 3) 圈选识别（左） ===');
console.log(selLeft, selLeft === '修改前（左）' ? '✅' : '❌');

// 选右侧单元格
await page.evaluate(() => {
  const rightCell = document.querySelector('.dc-cell-right:not(.empty)');
  const target = rightCell.firstChild || rightCell;
  const range = document.createRange();
  range.selectNodeContents(target);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.querySelector('.dc-body').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 200));
const selRight = await page.evaluate(() => {
  const tb = document.querySelector('.st-toolbar');
  return tb ? tb.querySelector('.st-source')?.textContent?.trim() : null;
});
console.log('=== 3) 圈选识别（右） ===');
console.log(selRight, selRight === '修改后（右）' ? '✅' : '❌');

await browser.close();
