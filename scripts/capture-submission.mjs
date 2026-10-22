import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'D:/pp studio/docs/demo-shots';
const URL = 'http://localhost:3000';
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
    { "file": "src/api.ts", "line": 42, "severity": "high", "suggestion": "..." }
  ]
}
\`\`\`

## Examples

输入：一个新增了未校验参数的接口改动
输出：{"summary": "存在注入风险，建议修复后合并"}

## References

- 团队代码规范见 references/style-guide.md
`;

const CANDIDATE = DOC
  .replace('3. **给出建议**：每条问题必须包含文件路径、行号、风险等级与修改建议。',
    '3. **给出建议**：为每条问题标注文件路径、行号、风险等级，并给出可直接套用的修改代码。')
  .replace('输入：一个新增了未校验参数的接口改动\n输出：{"summary": "存在注入风险，建议修复后合并"}\n\n', '')
  + `
## Constraints

- 不评论代码风格偏好，只评论正确性、安全性与可维护性。
- 单次审查输出不超过 10 条问题，按严重程度降序排列。
`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none', '--lang=zh-CN'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 120)));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(2500);

  // A. onboarding
  await page.screenshot({ path: path.join(OUT, 'A-onboarding.png') });

  // 关闭引导
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find(b => b.innerText.includes('跳过'));
    el && el.click();
  });
  await wait(900);

  // 注入文档 + 对话记录
  await page.evaluate(async (doc, cand) => {
    const m = await import('/src/store/useStore.ts');
    const now = Date.now();
    m.useStore.setState({
      docContent: doc,
      docName: 'code-review-agent.md',
      editingFilePath: 'prompts/code-review-agent.md',
      showWelcome: false,
      chatMessages: [
        {
          id: 'u1', role: 'user', timestamp: now - 60000,
          content: '帮我把这份 Skill 按 Anthropic 规范收紧一下：指令改成祈使句，补上约束章节，示例精简。',
        },
        {
          id: 'a1', role: 'assistant', timestamp: now - 30000,
          modelId: 'deepseek-chat', tokens: 1860, costEst: 0.004,
          reasoning: '用户要求三件事：① 指令句式统一为祈使句；② 补充 Constraints 约束章节；③ 精简 Examples。当前文档的指令段是陈述式，需要改写为祈使式并补充可执行动作；示例只有一组输入输出，可以合并到 Output Format 说明中；Constraints 章节缺失，需要新增安全边界与输出规模约束。',
          content: `已按规范收紧，主要改动 3 处：\n\n1. **指令祈使化**：第 3 条从「给出建议」改为「为每条问题标注…并给出可直接套用的修改代码」，明确动作对象。\n2. **示例精简**：Examples 与 Output Format 重复，删除示例段，保留 schema 即可。\n3. **新增 Constraints**：补充评论边界（只评正确性/安全/可维护性）与输出规模约束（≤10 条，按严重度降序）。\n\n完整候选文档已生成，点击下方「应用为候选修改」进入对比视图逐条确认。`,
        },
      ],
    });
    m.useStore.getState().revalidate && m.useStore.getState().revalidate();
    m.useStore.setState({ candidateContent: cand });
  }, DOC, CANDIDATE);
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, 'B-main.png') });

  // C. Diff
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().openDiff();
  });
  await wait(1500);
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    const blocks = m.useStore.getState().changeBlocks;
    const ex = [
      { why: '规则集要求指令使用祈使句并明确动作对象，原句只描述"给出建议"，缺少可执行细节。',
        how: '将「给出建议」改写为「标注文件路径、行号、风险等级，并给出可直接套用的修改代码」。',
        effect: '提高指令遵循率，输出可直接落地，减少二次追问。' },
      { why: 'Examples 与 Output Format 的 JSON schema 重复，占用上下文且不增加信息量。',
        how: '删除重复的输入/输出示例段，保留 Output Format 的字段定义。',
        effect: '减少约 12% 上下文 token，规则集校验不再报冗余模块。' },
      { why: 'Anthropic Skill 标准要求显式声明边界与规模约束，原文档缺少 Constraints 章节。',
        how: '新增 ## Constraints 章节，写入评论边界与单次输出条数上限。',
        effect: '约束模型行为边界，避免跑题与超长输出。' },
    ];
    blocks.forEach((b, i) => {
      if (ex[i]) { b.explanation = ex[i]; b.pendingConfirmation = false; }
      b.modelId = 'deepseek-chat'; b.tokens = 1860; b.costEst = 0.004;
    });
    m.useStore.setState({ changeBlocks: [...blocks] });
  });
  await wait(700);
  await page.screenshot({ path: path.join(OUT, 'C-diff.png') });

  // D. Mod log
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().setModLogChange(0);
    m.useStore.getState().toggleModLog(true);
  });
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, 'D-modlog.png') });

  // 关闭 modlog + 接受全部，关闭 diff
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().toggleModLog(false);
    m.useStore.getState().acceptAll();
  });
  await wait(800);

  // 生成版本记录（历史视图）
  await page.evaluate(async (doc, cand) => {
    const m = await import('/src/store/useStore.ts');
    const st = m.useStore.getState();
    await st.createVersion('v1 初始版本（导入 Anthropic Skill 标准）', doc);
    await st.createVersion('v2 AI 收紧：祈使句 + Constraints（接受 3/3）', cand);
  }, DOC, CANDIDATE);
  await wait(1200);

  // E. 历史
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().setActiveView('history');
  });
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, 'E-history.png') });

  // F. 规则集
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().setActiveView('ruleset');
  });
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, 'F-ruleset.png') });

  // G. 工作区
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().setActiveView('workspace');
  });
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, 'G-workspace.png') });

  // H. 设置（模型接入）
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().setActiveView('editor');
  });
  await wait(600);
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    await m.useStore.getState().openSettings();
  });
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, 'H-settings.png') });

  // I. 自动整理确认
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().closeSettings();
  });
  await wait(600);
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().doAutoOrganize();
  });
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, 'I-organize.png') });

  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.getState().cancelAutoOrganize();
  });
  await wait(600);

  // J. 语音输入
  const voiceOk = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || x.innerText || '').includes('语音输入'));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('voice click:', voiceOk);
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, 'J-voice.png') });

  console.log('done');
  await browser.close();
})();
