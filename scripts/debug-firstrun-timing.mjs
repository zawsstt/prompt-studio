// 实证：first=1 时 init 与 reset 的执行时序（StrictMode 双 init 嫌疑）
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
page.on('console', m => { if (m.type() === 'log' || m.type() === 'warn') console.log('PAGE:', m.text().slice(0, 160)); });

await page.goto('http://localhost:3000/index.html?first=1', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(5000);

// 从页面内观察 store 的最终状态（实例 A 视角不可得，但可以 hook zustand 的 setState）
// 方案：监听 zustand 中间件 —— 直接订阅 store 变化，记录 workspaceScopes/importedFiles/versions 每次变化
const log = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const events = [];
  const unsub = m.useStore.subscribe((s, prev) => {
    if (s.workspaceScopes !== prev.workspaceScopes || s.importedFiles !== prev.importedFiles || s.versions !== prev.versions) {
      events.push({
        t: performance.now() | 0,
        ws: s.workspaceScopes.length,
        imp: s.importedFiles.length,
        ver: s.versions.length,
      });
    }
  });
  await new Promise(r => setTimeout(r, 4000));
  unsub();
  return events.slice(0, 20);
});
console.log('STORE-EVENTS:', JSON.stringify(log, null, 1));
await browser.close();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
