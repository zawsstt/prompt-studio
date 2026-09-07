// 验证：文件编辑模式 + 联动检查 + 多文件 diff 队列
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

// 准备：两个同范围文件（B 引用 A 的模块），组成工作区
const setup = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  await s.importFile(new File(['## 数据模型\n字段定义：symbol/price', '## 计算逻辑\n根据 数据模型 计算'], 'agent-a.md', { type: 'text/markdown' }));
  const fb = new File(['## 输出格式\n引用 数据模型 的字段', '## 调用\n调用 agent-a.md 的能力'], 'agent-b.md', { type: 'text/markdown' });
  Object.defineProperty(fb, 'webkitRelativePath', { value: 'agents/agent-b.md' });
  await s.importFile(fb);
  const files = m.useStore.getState().importedFiles;
  const scope = s.createScopeFromFiles(files.map(f => f.path), '子agent协作组');
  return { scopeId: scope, files: files.map(f => f.path) };
});
console.log('=== 准备 ===');
console.log(JSON.stringify(setup, null, 1));

// ── 1) 点击文件 → 编辑区展示 ──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().setEditingFile('agent-a.md');
});
await new Promise(r => setTimeout(r, 800));
const fileMode = await page.evaluate(() => {
  const chip = document.querySelector('.chip-file');
  const editorText = document.querySelector('.cm-content')?.textContent?.slice(0, 30);
  const backBtn = [...document.querySelectorAll('.pane-head .btn')].find(b => b.textContent.includes('返回主文档'));
  return {
    chip: chip?.textContent?.trim(),
    editorStarts: editorText,
    hasBack: !!backBtn,
    editingFile: document.querySelector('.nav-submenu-editing')?.textContent?.trim(),
  };
});
console.log('=== 1) 文件编辑模式 ===');
console.log(JSON.stringify(fileMode, null, 1));
console.log(
  fileMode.chip?.includes('agent-a.md') && fileMode.editorStarts?.includes('数据模型') && fileMode.hasBack
    ? '✅ 文件在编辑区展示（chip + 内容 + 返回按钮）'
    : '❌ 文件模式异常'
);

// ── 2) 联动检查：修改 agent-a（B 引用了 A 的模块）──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const file = s.importedFiles.find(f => f.path === 'agent-a.md');
  s.updateImportedFileContent('agent-a.md', (file?.content ?? '') + '\n## 新增模块\n新增内容');
});
await new Promise(r => setTimeout(r, 1200)); // 等防抖 500ms + 检查
const sync = await page.evaluate(() => {
  const bar = document.querySelector('.sync-check-bar');
  const items = [...document.querySelectorAll('.sync-check-item')].map(el => el.textContent.trim());
  return { hasBar: !!bar, text: bar?.textContent?.slice(0, 40), items };
});
console.log('=== 2) 联动检查 ===');
console.log(JSON.stringify(sync, null, 1));
console.log(
  sync.hasBar && sync.items.length >= 2
    ? '✅ 联动条显示 B 文件引用提醒（文件级 + 模块级）'
    : '❌ 联动检查异常'
);

// 点击联动条目 → 打开引用方文件
await page.evaluate(() => {
  const item = document.querySelector('.sync-check-item');
  if (item) item.click();
});
await new Promise(r => setTimeout(r, 600));
const openedRef = await page.evaluate(() => ({
  chip: document.querySelector('.chip-file')?.textContent?.trim(),
}));
console.log('=== 2b) 点击联动条目打开引用方 ===');
console.log(JSON.stringify(openedRef, null, 1));
console.log(openedRef.chip?.includes('agent-b.md') ? '✅ 点击联动条目切换到引用文件' : '❌ 联动跳转异常');

// ── 3) 多文件 diff 队列 ──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  // 修改 agent-b（模拟联动更新）
  const fb = s.importedFiles.find(f => f.path === 'agents/agent-b.md');
  if (fb) s.updateImportedFileContent('agents/agent-b.md', (fb.content ?? '') + '\n## 同步更新\n已同步');
  // 切回 agent-a 打开对比
  s.setEditingFile('agent-a.md');
});
await new Promise(r => setTimeout(r, 800));
// 打开 diff（需候选？主文档候选没有 → 队列只有修改过的文件）
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().openDiff();
});
await new Promise(r => setTimeout(r, 1200));
const diffQ = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const tabs = [...document.querySelectorAll('.diff-file-tab')].map(t => t.textContent.trim());
  return {
    queue: s.diffQueue?.map(q => q.label),
    idx: s.currentDiffFileIdx,
    tabs,
    active: !!document.querySelector('.dc-body'),
  };
});
console.log('=== 3) 多文件 diff 队列 ===');
console.log(JSON.stringify(diffQ, null, 1));
console.log(
  diffQ.queue && diffQ.queue.length >= 2 && diffQ.tabs.length >= 2
    ? '✅ 多文件 diff 队列（tabs 展示 + 按顺序）'
    : '❌ 多文件 diff 队列异常'
);

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\filemode-final.png' });
await browser.close();
