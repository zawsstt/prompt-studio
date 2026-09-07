// UI/UX 优化迭代专用截图脚本：主界面 + diff + 设置 + 侧边栏 + onboarding
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.argv[2] || 'http://localhost:3000';
const OUT = process.argv[3] || 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\uiux-capture';
const W = parseInt(process.argv[4] || '1600', 10);
const H = parseInt(process.argv[5] || '900', 10);

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));
page.on('console', msg => { if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`); });

const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(3500);

// 0. 主界面
await page.screenshot({ path: `${OUT}-main.png` });
console.log(`[ok] main`);

// 1. 侧边栏 hover 展开
await page.hover('.nav-column');
await sleep(900);
await page.screenshot({ path: `${OUT}-sidebar.png` });
console.log(`[ok] sidebar`);

// 2. Diff 视图（通过 store 直接构造）
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const lines = s.docContent.split('\n');
  const replaced = lines.map(l =>
    l.includes('调度子 Agent')
      ? '3. **调度子 Agent**：将子任务分配给对应领域 agent，并校验返回结果完整性'
      : l
  );
  const removedIdx = replaced.findIndex(l => l.includes('实体列表'));
  if (removedIdx >= 0) replaced.splice(removedIdx, 1);
  replaced.push('', '## Output Example', '```json', '{ "intent": "quote" }', '```');
  m.useStore.setState({ candidateContent: replaced.join('\n') });
  s.openDiff();
});
await sleep(1800);
await page.screenshot({ path: `${OUT}-diff.png` });
console.log(`[ok] diff`);

// 3. 设置
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().closeDiff();
  m.useStore.getState().openSettings();
});
await sleep(1200);
await page.screenshot({ path: `${OUT}-settings.png` });
console.log(`[ok] settings`);

// 4. 校验面板 hover / 编辑器选区（可选：触发 SelectionToolbar）
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().closeSettings();
});
await sleep(800);
await page.screenshot({ path: `${OUT}-final.png` });
console.log(`[ok] final`);

await browser.close();
console.log(`done (${W}x${H}) → ${OUT}-*.png`);
