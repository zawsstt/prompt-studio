// 临时调试脚本：复现全部视图（主界面/diff/设置/确认弹窗/侧边栏展开）截图
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';
const OUT = 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs';
const W = parseInt(process.argv[2] || '1536', 10);
const H = parseInt(process.argv[3] || '864', 10);

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

// 1. 主界面
await page.screenshot({ path: `${OUT}\\repro-main.png` });

// 2. diff（构造多类型变更）
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
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: `${OUT}\\repro-diff.png` });

// 3. 关闭 diff，打开设置
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().closeDiff();
});
await new Promise(r => setTimeout(r, 600));
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().openSettings();
});
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: `${OUT}\\repro-settings.png` });

// 4. 关闭设置，触发自动整理确认弹窗
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().closeSettings();
});
await new Promise(r => setTimeout(r, 600));
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().doAutoOrganize();
});
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: `${OUT}\\repro-confirm.png` });

// 5. 侧边栏 hover 展开
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().cancelAutoOrganize();
});
await new Promise(r => setTimeout(r, 400));
await page.hover('.nav-column');
await new Promise(r => setTimeout(r, 700));
await page.screenshot({ path: `${OUT}\\repro-sidebar.png` });

console.log(`done (${W}x${H})`);
await browser.close();
