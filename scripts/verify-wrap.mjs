// 验证：diff 长行自动换行（无横向滚动、无截断）
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1100,768'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 768 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  const lines = s.docContent.split('\n');
  const candidate = lines.map(l =>
    l.includes('接收用户的财经数据查询请求')
      ? l.replace('接收用户的财经数据查询请求', '接收用户的财经查询请求')
      : l
  );
  m.useStore.setState({ candidateContent: candidate.join('\n') });
  s.openDiff();
});
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.dc-cell')];
  const overflowCells = cells
    .filter(c => c.scrollWidth > c.clientWidth + 2)
    .slice(0, 5)
    .map(c => ({ sw: c.scrollWidth, cw: c.clientWidth, text: c.textContent.slice(0, 30) }));
  // 长行是否换行：检查行高大于单行
  const rowHeights = [...document.querySelectorAll('.dc-row')].slice(0, 12).map(r => Math.round(r.getBoundingClientRect().height));
  const tallRows = rowHeights.filter(h => h > 30).length;
  return {
    totalCells: cells.length,
    overflowCount: overflowCells.length,
    overflowCells,
    rowHeights,
    tallRows,
    maxRowHeight: Math.max(...rowHeights),
  };
});
console.log('=== 长行换行验证 ===');
console.log(JSON.stringify(result, null, 1));
console.log(result.overflowCount === 0 ? '✅ 无横向溢出（自动换行生效）' : `❌ 仍有 ${result.overflowCount} 个单元格横向溢出`);
console.log(result.tallRows > 0 ? `✅ ${result.tallRows} 行发生换行（行高 ${result.maxRowHeight}px）` : 'ℹ️ 无长行换行（内容都不长）');

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\wrap-check.png' });
await browser.close();
