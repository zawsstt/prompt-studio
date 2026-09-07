// 临时调试脚本：构造含替换/删除/新增的候选，打开 diff 并截图
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';
const OUT = process.argv[2] || 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\diff-full.png';

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
  // 替换：第 3 条指令改写
  const replaced = lines.map(l =>
    l.includes('调度子 Agent')
      ? '3. **调度子 Agent**：将子任务分配给对应领域 agent，并校验返回结果完整性'
      : l
  );
  // 删除：删掉 JSON 示例中的实体行
  const removedIdx = replaced.findIndex(l => l.includes('实体列表'));
  if (removedIdx >= 0) replaced.splice(removedIdx, 1);
  // 新增：末尾追加示例段
  replaced.push('', '## Output Example', '```json', '{ "intent": "quote" }', '```');
  m.useStore.setState({ candidateContent: replaced.join('\n') });
  s.openDiff();
});
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: OUT });
console.log(`screenshot → ${OUT}`);
await browser.close();
