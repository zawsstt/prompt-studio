// 本地文件夹授权全链路（mock File System Access API）：授权→树→打开→编辑写回→刷新恢复
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Mock File System Access API ──
await page.evaluateOnNewDocument(() => {
  window.__localWrites = [];
  const FILES = {
    'prompts/驾驶舱主agent.md': '---\nname: driving-cabin\n---\n# 驾驶舱主 Agent\n敏感词条：详细指标A\n',
    'prompts/子agent-情报.md': '# 外部情报子智能体\n参考 ods_user_register_daily 表\n',
    'README.txt': '本地文件夹授权演示文件\n',
  };
  const makeFileHandle = (path) => ({
    kind: 'file',
    name: path.split('/').pop(),
    async getFile() {
      return new File([FILES[path] ?? ''], this.name, { type: 'text/plain' });
    },
    async createWritable() {
      let buf = '';
      return {
        async write(content) { buf = String(content); },
        async close() {
          FILES[path] = buf;
          window.__localWrites.push({ path, content: buf.slice(0, 60) });
        },
      };
    },
  });
  const dirHandle = {
    kind: 'directory',
    name: 'my-prompts',
    async *entries() {
      yield ['prompts', {
        kind: 'directory',
        name: 'prompts',
        async *entries() {
          yield ['驾驶舱主agent.md', makeFileHandle('prompts/驾驶舱主agent.md')];
          yield ['子agent-情报.md', makeFileHandle('prompts/子agent-情报.md')];
        },
      }];
      yield ['README.txt', makeFileHandle('README.txt')];
    },
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
  };
  window.showDirectoryPicker = async () => dirHandle;
  window.isFileSystemAccessAPIMock = true;
});

await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('跳过')); if (b) b.click(); });
await sleep(600);

// 1. 进入工作区 → 授权本地文件夹
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(800);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.ws-create-actions .btn')].find(x => x.textContent.includes('授权本地文件夹'));
  if (b) b.click();
});
await sleep(1200);
const tree = await page.evaluate(() => ({
  status: document.querySelector('.ws-create-hint b')?.textContent ?? null,
  files: [...document.querySelectorAll('.ws-module-item')].map(i => i.textContent.trim()).filter(Boolean),
  folders: [...document.querySelectorAll('.ws-folder-item .ws-folder-name')].map(i => i.textContent),
}));
console.log('1. 授权后文件树:', JSON.stringify(tree, null, 1));

// 2. 打开本地文件（README.txt 根文件）
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.ws-module-item')];
  const it = items.find(i => i.textContent.includes('README.txt'));
  const btn = it?.querySelector('.btn');
  if (btn) btn.click();
});
await sleep(1200);
const opened = await page.evaluate(() => ({
  crumb: document.querySelector('.doc-indicator b')?.textContent ?? null,
  chip: document.querySelector('.chip-file')?.textContent?.trim() ?? null,
  editorHead: document.querySelector('.cm-content')?.textContent.slice(0, 40) ?? null,
}));
console.log('2. 打开本地文件:', JSON.stringify(opened, null, 1));

// 3. 编辑 → 触发写回（真实键盘输入走 CM6 updateListener → 防抖 → 写回本地）
const editorHead2 = await page.evaluate(() => document.querySelector('.cm-content')?.textContent?.slice(0, 30) ?? null);
console.log('2b. 编辑器内容:', JSON.stringify(editorHead2));
await page.click('.cm-content');
await sleep(500);
await page.keyboard.down('Control');
await page.keyboard.press('End'); // 光标到文档末尾
await page.keyboard.up('Control');
await page.keyboard.type('\n# 已编辑（写回本地）\n');
await sleep(3000); // 防抖 500ms + 写回
const writes = await page.evaluate(() => window.__localWrites);
console.log('3. 编辑写回:', JSON.stringify(writes, null, 1));

// 4. 刷新 → mock 句柄不可克隆（降级会话级授权）→ 需重新授权；真实浏览器原生句柄可持久化恢复
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4500);
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(900);
const restored = await page.evaluate(() => ({
  fileCount: document.querySelectorAll('.ws-module-item').length,
  authBtn: [...document.querySelectorAll('.ws-create-actions .btn')].map(b => b.textContent.trim()),
}));
console.log('4. 刷新后（mock 场景：需重新授权）:', JSON.stringify(restored, null, 1));
console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
