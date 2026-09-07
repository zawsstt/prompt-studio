// 最终 UI 验证（dev server 刚重启、页面首次加载 = 单实例）
// 1) replaced 行侧别渲染正确（左无 add span / 右无 del span） 2) 相同行不标黄
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1366,768'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

// 构造候选：说明段改词 + 块内含未变行（构造"第二行指令保持不变"场景）
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
  const rows = [...document.querySelectorAll('.dc-row')];
  const counts = {};
  const repDetails = [];
  rows.forEach((row, i) => {
    const t = row.dataset.rowType || '?';
    counts[t] = (counts[t] || 0) + 1;
    if (t === 'replaced') {
      const leftCell = row.querySelector('.dc-cell-left');
      const rightCell = row.querySelector('.dc-cell-right');
      repDetails.push({
        row: i,
        left: leftCell?.textContent?.slice(0, 50) ?? '',
        right: rightCell?.textContent?.slice(0, 50) ?? '',
        leftHasAdd: !!leftCell?.querySelector('.char-add'),
        rightHasDel: !!rightCell?.querySelector('.char-del'),
        leftHasDel: !!leftCell?.querySelector('.char-del'),
        rightHasAdd: !!rightCell?.querySelector('.char-add'),
      });
    }
  });
  return { counts, repDetails };
});
console.log('=== 最终 UI 验证 ===');
console.log(JSON.stringify(result, null, 1));

const rep = result.repDetails[0];
if (!rep) {
  console.log('❌ 未找到 replaced 行');
} else {
  const leftOK = !rep.leftHasAdd;
  const rightOK = !rep.rightHasDel;
  const differ = rep.left !== rep.right;
  console.log(`行内容不同: ${differ ? '✅' : '❌'}`);
  console.log(`左侧无新增标记: ${leftOK ? '✅' : '❌'}`);
  console.log(`右侧无删除标记: ${rightOK ? '✅' : '❌'}`);
  console.log(`左侧有删除标记(正确): ${rep.leftHasDel ? '✅' : 'ℹ️ 无字符级差异'}`);
  console.log(`右侧有新增标记(正确): ${rep.rightHasAdd ? '✅' : 'ℹ️ 无字符级差异'}`);
}

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\final-diff-fix.png' });
await browser.close();
