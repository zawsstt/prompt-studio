// 临时调试脚本：打开 diff 视图并截图
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';
const OUT = process.argv[2] || 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\diff-shot.png';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  m.useStore.setState({ candidateContent: s.docContent + '\n# 候选修改测试\n- 新增一行内容用于验证 diff 视图布局' });
  s.openDiff();
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: OUT });
console.log(`screenshot → ${OUT}`);
await browser.close();
