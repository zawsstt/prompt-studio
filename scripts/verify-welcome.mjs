// 验证：首次欢迎页 + 刷新恢复最近编辑目标
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

// ── 1) 首次打开（无记录）→ 欢迎页 ──
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));
const first = await page.evaluate(() => {
  const wg = document.querySelector('.welcome-guide');
  return {
    hasWelcome: !!wg,
    title: wg?.querySelector('.wg-title')?.textContent,
    hasActions: wg ? wg.querySelectorAll('.wg-actions .btn').length : 0,
    hasDocChip: !!document.querySelector('.chip-file'),
  };
});
console.log('=== 1) 首次打开 ===');
console.log(JSON.stringify(first, null, 1));
console.log(first.hasWelcome ? '✅ 欢迎页显示' : '❌ 欢迎页未显示');

// 欢迎页布局检查（不超出编辑器区域）
const wgGeo = await page.evaluate(() => {
  const wg = document.querySelector('.welcome-guide');
  const pane = document.querySelector('.code-pane');
  if (!wg || !pane) return null;
  const a = wg.getBoundingClientRect();
  const b = pane.getBoundingClientRect();
  return {
    inside: a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1,
    wg: { x: Math.round(a.x), y: Math.round(a.y), w: Math.round(a.width), h: Math.round(a.height) },
    pane: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
  };
});
console.log('=== 1b) 欢迎页区域约束 ===');
console.log(JSON.stringify(wgGeo, null, 1));
console.log(wgGeo?.inside ? '✅ 欢迎页仅在编辑器区域内' : '❌ 欢迎页超出编辑器区域');

// ── 2) 导入文件 + 打开 → 刷新 → 恢复该文件 ──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  await s.importFile(new File(['## 最近编辑的文件\n内容 X'], 'recent-file.md', { type: 'text/markdown' }));
  s.setEditingFile('recent-file.md');
});
await new Promise(r => setTimeout(r, 600));
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 3500));
const restored = await page.evaluate(() => ({
  hasWelcome: !!document.querySelector('.welcome-guide'),
  chip: document.querySelector('.chip-file')?.textContent?.trim(),
  editorStarts: document.querySelector('.cm-content')?.textContent?.slice(0, 20),
}));
console.log('=== 2) 刷新后恢复最近编辑文件 ===');
console.log(JSON.stringify(restored, null, 1));
console.log(
  !restored.hasWelcome && restored.chip?.includes('recent-file.md') && restored.editorStarts?.includes('最近编辑的文件')
    ? '✅ 刷新后恢复最近编辑的文件'
    : '❌ 恢复失败'
);

// ── 3) 返回主文档 → 刷新 → 恢复主文档 ──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().setEditingFile(null);
});
await new Promise(r => setTimeout(r, 400));
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 3500));
const docRestored = await page.evaluate(() => ({
  hasWelcome: !!document.querySelector('.welcome-guide'),
  chip: document.querySelector('.chip-file')?.textContent?.trim() ?? null,
  editorStarts: document.querySelector('.cm-content')?.textContent?.slice(0, 15),
}));
console.log('=== 3) 刷新后恢复主文档 ===');
console.log(JSON.stringify(docRestored, null, 1));
console.log(
  !docRestored.hasWelcome && !docRestored.chip
    ? '✅ 刷新后恢复主文档'
    : '❌ 主文档恢复异常'
);

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\welcome-check.png' });
await browser.close();
