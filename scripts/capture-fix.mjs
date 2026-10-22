import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'D:/pp studio/docs/demo-shots';
const wait = ms => new Promise(r => setTimeout(r, ms));

const DOC = `---
name: code-review-agent
description: 对 Pull Request 做结构化代码审查，输出可执行的整改建议
---

# Code Review Agent

## Instructions

你是一名资深代码审查工程师。收到 PR diff 后，按以下步骤工作：

1. **理解意图**：阅读 PR 描述与改动文件，判断改动目标与影响面。
2. **风险定位**：优先检查安全、并发、错误处理、性能四类风险。
3. **给出建议**：每条问题必须包含文件路径、行号、风险等级与修改建议。
4. **总结结论**：输出是否可以合并的结论，并列出必须修复项。

## Output Format

\`\`\`json
{
  "summary": "一句话结论",
  "issues": [
    { "file": "src/api.ts", "line": 42, "severity": "high" }
  ]
}
\`\`\`

## Examples

输入：新增未校验参数的接口改动
输出：{"summary": "存在注入风险，建议修复后合并"}

## References

- 团队代码规范见 references/style-guide.md
`;

const CAND = DOC
  .replace('3. **给出建议**：每条问题必须包含文件路径、行号、风险等级与修改建议。',
    '3. **给出建议**：为每条问题标注文件路径、行号、风险等级，并给出可直接套用的修改代码。')
  .replace('输入：新增未校验参数的接口改动\n输出：{"summary": "存在注入风险，建议修复后合并"}\n\n', '')
  + '\n## Constraints\n\n- 只评论正确性、安全性与可维护性。\n- 单次输出不超过 10 条，按严重度降序排列。\n';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none', '--lang=zh-CN'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2200);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes('跳过'));
    el && el.click();
  });
  await wait(500);
  await page.evaluate(async (doc) => {
    const m = await import('/src/store/useStore.ts');
    const now = Date.now();
    m.useStore.setState({ docName: 'code-review-agent.md', showWelcome: false });
    m.useStore.getState().setDocContent(doc);
    m.useStore.setState({
      chatMessages: [
        { id: 'u1', role: 'user', timestamp: now - 60000, content: '帮我把这份 Skill 按 Anthropic 规范收紧：指令改祈使句、补 Constraints、示例精简。' },
        { id: 'a1', role: 'assistant', timestamp: now - 30000, modelId: 'deepseek-chat', tokens: 1860, costEst: 0.004,
          reasoning: '用户要求三件事：① 指令句式统一为祈使句；② 补充 Constraints 约束章节；③ 精简 Examples。',
          content: '已按规范收紧，主要改动 3 处：\n\n1. **指令祈使化**：第 3 条改为「为每条问题标注文件路径、行号、风险等级，并给出可直接套用的修改代码」。\n2. **示例精简**：Examples 与 Output Format 重复，删除示例段保留 schema。\n3. **新增 Constraints**：补充评论边界与输出规模约束。\n\n点击下方「应用为候选修改」进入对比视图逐条确认。' },
      ],
    });
  }, DOC);
  await wait(2500);
  await page.screenshot({ path: path.join(OUT, 'B-main.png') });
  console.log('B ok');

  await page.evaluate(async (doc, cand) => {
    const m = await import('/src/store/useStore.ts');
    const st = m.useStore.getState();
    await st.createVersion('v1 初始版本（导入 Anthropic Skill 标准）', doc);
    await st.createVersion('v2 AI 收紧：祈使句 + Constraints（接受 3/3）', cand);
    await st.loadVersions();
  }, DOC, CAND);
  await wait(800);
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().setActiveView('history');
  });
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, 'E-history.png') });
  console.log('E ok');
  await browser.close();
})();
