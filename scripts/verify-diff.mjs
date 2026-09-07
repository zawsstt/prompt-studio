// 临时验证脚本：检查 diff 行的类型分布与单元格背景色
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
await new Promise(r => setTimeout(r, 3000));

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

const info = await page.evaluate(() => {
  const counts = {};
  const cells = [];
  document.querySelectorAll('.dc-row').forEach((row, i) => {
    const t = row.dataset.rowType || '?';
    counts[t] = (counts[t] || 0) + 1;
    // 只记录非 equal 行的单元格背景
    if (t !== 'equal' && i < 200) {
      const lc = row.querySelector('.dc-cell-left');
      const rc = row.querySelector('.dc-cell-right');
      cells.push({
        row: i,
        type: t,
        leftBg: lc ? getComputedStyle(lc).backgroundColor : null,
        rightBg: rc ? getComputedStyle(rc).backgroundColor : null,
        leftText: lc?.textContent?.slice(0, 30),
        rightText: rc?.textContent?.slice(0, 30),
      });
    }
  });
  return { counts, cells: cells.slice(0, 12) };
});
console.log('=== 行类型分布 ===');
console.log(JSON.stringify(info.counts, null, 1));
console.log('=== 非 equal 行详情 ===');
console.log(JSON.stringify(info.cells, null, 1));

await browser.close();
