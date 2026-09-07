// 验证 5 项需求：添加按钮/应用对话/锁定/文件树/规则集页
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

// 准备：创建 scope + 导入文件（根文件 + 文件夹文件）
const setup = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const mods = s.parseDocumentModules();
  s.createScope('测试范围A', '验证用', mods);
  // 根文件
  await s.importFile(new File(['## 根模块\n内容A'], 'root-file.md', { type: 'text/markdown' }));
  // 文件夹文件（webkitRelativePath 模拟）
  const f = new File(['## 子模块1\n内容B'], 'sub-file.md', { type: 'text/markdown' });
  Object.defineProperty(f, 'webkitRelativePath', { value: 'docs/sub-file.md' });
  await s.importFile(f);
  const f2 = new File(['## 子模块2\n内容C'], 'sub2-file.md', { type: 'text/markdown' });
  Object.defineProperty(f2, 'webkitRelativePath', { value: 'docs/sub2-file.md' });
  await s.importFile(f2);
  return {
    scopeCount: m.useStore.getState().workspaceScopes.length,
    files: m.useStore.getState().importedFiles.map(x => x.path),
  };
});
console.log('=== 准备 ===');
console.log(JSON.stringify(setup, null, 1));

// ── 需求 4：文件树（文件夹分组） ──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ activeView: 'workspace' });
});
await new Promise(r => setTimeout(r, 800));
const tree = await page.evaluate(() => {
  const folders = [...document.querySelectorAll('.ws-folder-item')].map(el => el.textContent.trim());
  const rootFiles = [...document.querySelectorAll('.ws-module-list > .ws-module-item')].map(el => el.textContent.trim());
  return { folders, rootFiles };
});
console.log('=== 4) 文件树 ===');
console.log(JSON.stringify(tree, null, 1));
console.log(tree.folders.some(f => f.includes('docs')) ? '✅ 文件夹分组显示' : '❌ 文件夹未分组');

// ── 需求 3：锁定守卫 ──
const lockTest = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const scope = s.workspaceScopes[0];
  const modCount = scope.modules.length;
  s.toggleScopeLocked(scope.id);
  s.toggleModuleInScope(scope.id, scope.modules[0].heading); // 应被拒绝
  const afterToggle = m.useStore.getState().workspaceScopes[0].modules[0].selected;
  const delBefore = m.useStore.getState().workspaceScopes.length;
  s.deleteScope(scope.id); // 应被拒绝
  const delAfter = m.useStore.getState().workspaceScopes.length;
  s.toggleScopeLocked(scope.id); // 解锁
  s.toggleModuleInScope(scope.id, m.useStore.getState().workspaceScopes[0].modules[0].heading); // 应生效
  const afterUnlock = m.useStore.getState().workspaceScopes[0].modules[0].selected;
  return { modCount, afterToggle, delBlocked: delBefore === delAfter, afterUnlock };
});
console.log('=== 3) 锁定守卫 ===');
console.log(JSON.stringify(lockTest, null, 1));
console.log(
  !lockTest.afterToggle && lockTest.delBlocked && lockTest.afterUnlock
    ? '✅ 锁定后不可勾选/删除，解锁后恢复'
    : `❌ 锁定守卫异常: ${JSON.stringify(lockTest)}`
);

// ── 需求 1 + 2：添加文件至工作区 + 应用到对话 ──
const addApplied = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const scope = s.workspaceScopes[0];
  const paths = s.importedFiles.map(f => f.path);
  const before = m.useStore.getState().workspaceScopes[0].modules.length;
  s.addFilesToScope(scope.id, paths);
  const after = m.useStore.getState().workspaceScopes[0].modules.length;
  const headings = m.useStore.getState().workspaceScopes[0].modules.map(x => x.heading);
  s.toggleScopeApplied(scope.id);
  const applied = m.useStore.getState().workspaceScopes[0].applied;
  return { before, after, added: after - before, headings, applied };
});
console.log('=== 1+2) 添加至工作区 + 应用到对话 ===');
console.log(JSON.stringify(addApplied, null, 1));
console.log(
  addApplied.added > 0 && addApplied.applied
    ? `✅ 添加 ${addApplied.added} 个文件模块成功（${addApplied.headings.slice(0, 3).join(' / ')}…），已应用到对话`
    : '❌ 添加/应用失败'
);

// ── 需求 2：侧边栏子菜单 ──
await page.evaluate(() => {
  document.querySelector('.nav-column .nav-sub-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 500));
const submenu = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-submenu-item')].map(el => el.textContent.trim());
  const secs = [...document.querySelectorAll('.nav-submenu-sec')].map(el => el.textContent.trim());
  return { secs, items };
});
console.log('=== 2) 侧边栏子菜单 ===');
console.log(JSON.stringify(submenu, null, 1));
console.log(submenu.secs.includes('已应用区域') && submenu.items.length > 0 ? '✅ 子菜单显示已应用区域+文件' : '❌ 子菜单异常');

// ── 需求 5：规则集页 ──
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ activeView: 'ruleset' });
});
await new Promise(r => setTimeout(r, 800));
const rsm = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.rsm-card')].map(c => ({
    name: c.querySelector('.rsm-card-name')?.textContent?.trim().slice(0, 40),
    meta: c.querySelector('.rsm-card-meta')?.textContent?.trim(),
  }));
  const expandBtn = document.querySelector('.rsm-card-head');
  return { cardCount: cards.length, cards: cards.slice(0, 4) };
});
console.log('=== 5) 规则集页 ===');
console.log(JSON.stringify(rsm, null, 1));
console.log(rsm.cardCount >= 4 ? '✅ 规则集页渲染（内置+自定义）' : '❌ 规则集页异常');

// 展开第一个卡片看规则详情
await page.evaluate(() => {
  document.querySelector('.rsm-card-head')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await new Promise(r => setTimeout(r, 400));
const rsmDetail = await page.evaluate(() => ({
  kindTitles: [...document.querySelectorAll('.rs-kind-title')].map(el => el.textContent.trim()),
  ruleCount: document.querySelectorAll('.rs-kind-rule').length,
}));
console.log('=== 5b) 规则详情 ===');
console.log(JSON.stringify(rsmDetail, null, 1));
console.log(rsmDetail.ruleCount > 0 ? '✅ 规则详情展示' : '❌ 规则详情为空');

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\workspace-final.png' });
await browser.close();
