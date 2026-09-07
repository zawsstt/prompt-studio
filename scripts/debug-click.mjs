// 终极诊断：通过真实 UI 点击触发自动整理
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
page.on('console', msg => {
  if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`);
});

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

// 先打乱文档（store 直接改，编辑器可能不同步但 doAutoOrganize 读 store）
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
await new Promise(r => setTimeout(r, 500));

// 找顶栏"自动整理"按钮点击
const btnInfo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.topbar button')];
  return btns.map((b, i) => ({ i, text: b.textContent.trim(), title: b.title }));
});
console.log('=== 顶栏按钮 ===');
console.log(JSON.stringify(btnInfo, null, 1));

await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.topbar button')];
  const target = btns.find(b => b.textContent.includes('自动整理'));
  if (target) target.click();
});
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  return {
    preview: !!m.useStore.getState().organizePreview,
    confirm: !!document.querySelector('.confirm-dialog'),
    root: document.getElementById('root').children.length,
  };
});
console.log('=== UI 点击后 ===');
console.log(JSON.stringify(result, null, 1));

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\debug-click.png' });
await browser.close();
