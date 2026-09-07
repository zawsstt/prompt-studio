// 权威验证：浏览器内直接调用 buildDiffLines 纯函数（无 store 实例问题）
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
await new Promise(r => setTimeout(r, 3000));

// ── A) 纯函数单元测试：替换块内含相同行 + 不同行 ──
const unit = await page.evaluate(async () => {
  const diff = await import('/src/lib/diff.ts');
  const oldText = [
    '# 标题',
    '',
    '## Instructions',
    '第一行指令',
    '第二行指令保持不变',
    '第三行指令',
    '',
    '## Output',
    '输出内容',
  ].join('\n');
  const newText = [
    '# 标题',
    '',
    '## Instructions',
    '第一行指令（改过了）',
    '第二行指令保持不变',
    '第三行指令',
    '',
    '## Output',
    '输出内容',
  ].join('\n');
  const { leftLines, rightLines, changeBlocks } = diff.buildDiffLines(oldText, newText);
  return {
    leftTypes: leftLines.map(l => l.type),
    rightTypes: rightLines.map(l => l.type),
    blocks: changeBlocks.map(b => ({ type: b.type, oldStart: b.oldStartLine, oldEnd: b.oldEndLine })),
  };
});
console.log('=== A) 纯函数：替换块含相同行 ===');
console.log(JSON.stringify(unit, null, 1));
const leftTypes = unit.leftTypes.join(',');
console.log(
  leftTypes.includes('replaced') && leftTypes.includes('equal')
    ? '✅ 相同行=equal，不同行=replaced（正确降级）'
    : '❌ 降级失败'
);

// ── B) 纯函数：整行替换（左右都不同）──
const unit2 = await page.evaluate(async () => {
  const diff = await import('/src/lib/diff.ts');
  const oldText = 'a\nb\nc';
  const newText = 'a\nX\nc';
  const { leftLines, rightLines } = diff.buildDiffLines(oldText, newText);
  return {
    leftTypes: leftLines.map(l => l.type),
    rightTypes: rightLines.map(l => l.type),
    leftContents: leftLines.map(l => l.content),
    rightContents: rightLines.map(l => l.content),
  };
});
console.log('=== B) 纯函数：单行替换 ===');
console.log(JSON.stringify(unit2, null, 1));
console.log(
  unit2.leftTypes.includes('replaced') && unit2.rightTypes.includes('replaced')
    ? '✅ 不同行正确标记 replaced'
    : '❌ 替换标记失败'
);

// ── C) 纯函数：charDiffs 行级（含字符级差异）──
const unit3 = await page.evaluate(async () => {
  const diff = await import('/src/lib/diff.ts');
  const { leftLines, rightLines } = diff.buildDiffLines('hello world', 'hello there');
  const rep = leftLines.filter(l => l.type === 'replaced');
  return {
    repCount: rep.length,
    charDiffs: rep[0]?.charDiffs ?? null,
  };
});
console.log('=== C) 纯函数：charDiffs ===');
console.log(JSON.stringify(unit3, null, 1));

await browser.close();
