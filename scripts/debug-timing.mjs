// 时序实验：弹窗是否闪现后被关闭，还是从未渲染
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

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

// 打乱 + 触发，然后按时间点采样 DOM
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const lines = s.docContent.split('\n');
  const refIdx = lines.findIndex(l => l.startsWith('## References'));
  if (refIdx > 0) {
    const refBlock = lines.splice(refIdx);
    m.useStore.setState({ docContent: [...refBlock, '', ...lines].join('\n') });
  }
  m.useStore.getState().doAutoOrganize();
});

for (const ms of [50, 250, 800, 2000]) {
  await new Promise(r => setTimeout(r, ms === 50 ? 50 : ms - (ms === 250 ? 50 : ms === 800 ? 250 : 800)));
  const t = await page.evaluate(() => ({
    t: performance.now(),
    confirm: !!document.querySelector('.confirm-dialog'),
    root: document.getElementById('root').children.length,
  }));
  console.log(`+${ms}ms → confirm=${t.confirm} rootChildren=${t.root}`);
}

// 手动触发一次无关 setState，看是否唤醒渲染
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ showValidationPanel: true });
});
await new Promise(r => setTimeout(r, 300));
const finalState = await page.evaluate(() => ({
  confirm: !!document.querySelector('.confirm-dialog'),
  root: document.getElementById('root').children.length,
}));
console.log('after nudge →', JSON.stringify(finalState));

await browser.close();
