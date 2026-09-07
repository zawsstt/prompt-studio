// 临时调试脚本：检查自动整理弹窗为何不渲染
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
page.on('pageerror', err => console.log(`[pageerror] ${err.stack || err.message}`));
page.on('console', msg => {
  if (['error', 'warning'].includes(msg.type())) console.log(`[console.${msg.type()}] ${msg.text()}`);
});

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

// 打乱文档
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const lines = s.docContent.split('\n');
  const refIdx = lines.findIndex(l => l.startsWith('## References'));
  if (refIdx > 0) {
    const refBlock = lines.splice(refIdx);
    m.useStore.setState({ docContent: [...refBlock, '', ...lines].join('\n') });
  }
});
// 触发自动整理
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.getState().doAutoOrganize();
});
await new Promise(r => setTimeout(r, 1500));

const state = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  return {
    preview: !!s.organizePreview,
    confirmOverlay: !!document.querySelector('.confirm-overlay'),
    confirmDialog: !!document.querySelector('.confirm-dialog'),
    rootChildren: document.getElementById('root').children.length,
  };
});
console.log('=== 弹窗状态 ===');
console.log(JSON.stringify(state, null, 1));

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\debug-organize.png' });
console.log('screenshot saved');
await browser.close();
