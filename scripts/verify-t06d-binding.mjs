// T06d 动态绑定自检：面包屑/横幅跟随文件、AI 上下文源=文件、候选应用写回文件、Diff token 估算
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FIXTURE = 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\scripts\\t06d-fixture.md';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));

// ── Mock SSE API：模拟 DeepSeek 流式回复（markdown fence + json-explanations） ──
await page.evaluateOnNewDocument(() => {
  const realFetch = window.fetch.bind(window);
  const AI_REPLY = '```markdown\n---\nname: external-intel-agent\ndescription: 外部情报领域子智能体\n---\n\n# Instructions\n\n你是外部情报子智能体，始终以 JSON 格式输出结果。\n\n调用任何工具前，必须校验参数完整性。\n\n## Output Format\n\n```json\n{ "intent": "quote" }\n```\n```\n\n```json-explanations\n{"blocks":[{"id":"b1","type":"replaced","why":"模糊词削弱指令确定性","how":"改为祈使句","effect":"输出更稳定","oldSnippet":"尽量保证","newSnippet":"始终以"}]}\n```';
  window.fetch = async (url, init) => {
    if (typeof url === 'string' && url.includes('/chat/completions')) {
      const chunks = AI_REPLY.match(/.{1,40}/gs) || [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for (const ch of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`));
            await new Promise(r => setTimeout(r, 5));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    return realFetch(url, init);
  };
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const snap = () => page.evaluate(() => ({
  crumb: document.querySelector('.doc-indicator b')?.textContent ?? null,
  banner: document.querySelector('.validation-banner')?.textContent?.trim() ?? null,
  chipFile: document.querySelector('.chip-file')?.textContent?.trim() ?? null,
  paneMeta: document.querySelector('.pane-meta')?.textContent ?? null,
  sendDisabled: document.querySelector('.input-actions .btn-primary')?.disabled ?? null,
}));

// ══ 1. 新用户：跳过引导 → 配置 API Key（UI） ══
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.settings-footer .btn')];
  const skip = btns.find(b => b.textContent.includes('跳过'));
  if (skip) skip.click();
});
await sleep(700);
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-group-bottom .nav-item')];
  const it = items.find(i => i.textContent.includes('设置'));
  if (it) it.click();
});
await sleep(900);
await page.type('.key-row input[type=password]', 'sk-mock-test-1234');
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.settings-footer .btn')];
  const save = btns.find(b => b.textContent.includes('保存设置'));
  if (save) save.click();
});
await sleep(700);

// ══ 2. 进入工作区导入测试文件 ══
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-item')];
  const it = items.find(i => i.textContent.includes('工作区范围'));
  if (it) it.click();
});
await sleep(800);
const fileInput = await page.$('input[type=file]');
await fileInput.uploadFile(FIXTURE);
await sleep(1200);

// ══ 3. 从 NavColumn 打开导入的文件（先展开子菜单 chevron，再点文件项） ══
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-item')];
  const it = items.find(i => i.textContent.includes('AI 对话'));
  if (it) it.click();
  // 展开子菜单
  const toggle = document.querySelector('.nav-sub-toggle');
  if (toggle) toggle.click();
});
await sleep(900);
const fileList = await page.evaluate(() =>
  [...document.querySelectorAll('.nav-submenu-item')].map(i => i.textContent.trim()).filter(Boolean)
);
console.log('3a. 子菜单文件列表:', JSON.stringify(fileList));
await page.evaluate(() => {
  const sub = [...document.querySelectorAll('.nav-submenu-item')];
  const f = sub.find(i => i.textContent.includes('t06d-fixture'));
  if (f) f.click();
});
await sleep(1000);
console.log('3b. 打开文件后:', JSON.stringify(await snap()));

// ══ 4. 发送消息（mock API）→ 等待 AI 回复 ══
await page.type('.chat-input-row textarea', '把指令改成祈使句并强调 JSON 输出');
await sleep(300);
await page.click('.input-actions .btn-primary');
await sleep(6000); // 等流式完成
const chatState = await page.evaluate(() => ({
  msgCount: document.querySelectorAll('.chat-message').length,
  lastMsg: [...document.querySelectorAll('.chat-message.assistant .msg-bubble')].pop()?.textContent?.slice(0, 80) ?? null,
}));
console.log('4. AI 回复:', JSON.stringify(chatState));

// ══ 5. 点击「应用为候选修改」→ 文件 diff 应打开 ══
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.msg-actions .btn')];
  const b = btns.find(x => x.textContent.includes('应用为候选'));
  if (b) b.click();
});
await sleep(1500);
const diffState = await page.evaluate(() => ({
  diffOpen: !!document.querySelector('.diff-overlay'),
  diffLabel: document.querySelector('.diff-file-tab .diff-file-tab-name')?.textContent ?? null,
  stats: document.querySelector('.tb-stats')?.textContent ?? null,
  tokenText: [...document.querySelectorAll('.diff-stats span')].map(s => s.textContent).join(' '),
}));
console.log('5. 文件候选 Diff:', JSON.stringify(diffState));

// ══ 6. 关闭 diff → 断言文件内容已更新（面包屑仍=文件名，内容含「始终以」） ══
await page.evaluate(() => {
  // 接受全部修改
  const btns = [...document.querySelectorAll('.diff-toolbar .tb-btn')];
  const b = btns.find(x => x.textContent.includes('接受全部'));
  if (b) b.click();
});
await sleep(1200);
// 处理确认对话框
page.on('dialog', d => d.accept());
await sleep(1500);
const finalState = await page.evaluate(() => ({
  crumb: document.querySelector('.doc-indicator b')?.textContent ?? null,
  fileContent: (window.__storeProbe = null),
}));
// 通过编辑器内容断言文件更新（当前打开文件的内容）
const editorContent = await page.evaluate(() => {
  const host = document.querySelector('.cm-host .cm-content');
  return host ? host.textContent.slice(0, 200) : null;
});
console.log('6. 文件更新后:', JSON.stringify({ ...finalState, editorHead: editorContent }));

console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
