// 脱敏全链路：AI 收到的上下文只含编号（捕获真实 payload 断言）→ 候选还原为真实内容
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SENS_FIXTURE = 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\scripts\\t07-sensitive-fixture.md';

// 含敏感数据的测试文件：SQL 底表 + 自定义指标词条 + 手机号
fs.writeFileSync(SENS_FIXTURE, `---
name: sales-report-agent
description: 销售报表子智能体
---

# Instructions

你是销售报表子智能体，负责生成经营日报。

## 数据口径

- 详细指标A：新增注册用户数，来源底表 ods_user_register_daily
- 详细指标B：付费转化率，来源底表 dws_pay_convert_daily
- 联系电话：13800138000
`, 'utf8');

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
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Mock SSE + 捕获请求体
await page.evaluateOnNewDocument(() => {
  const realFetch = window.fetch.bind(window);
  window.__sentPayloads = [];
  window.fetch = async (url, init) => {
    if (typeof url === 'string' && url.includes('/chat/completions')) {
      try { window.__sentPayloads.push(JSON.parse(init.body)); } catch { /* ignore */ }
      const REPLY = '```markdown\n---\nname: sales-report-agent\ndescription: 销售报表子智能体\n---\n\n# Instructions\n\n你是销售报表子智能体，负责生成经营日报。\n\n## 数据口径\n\n- {{SENS-001}}：新增注册用户数，来源底表 {{SENS-002}}\n- {{SENS-003}}：付费转化率，来源底表 {{SENS-004}}\n- 联系电话：{{SENS-005}}\n\n## 新增\n\n- 每日 10:00 前输出经营日报\n```\n\n```json-explanations\n{"blocks":[]}\n```';
      const chunks = REPLY.match(/.{1,40}/gs) || [];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for (const ch of chunks) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ch } }] })}\n\n`));
            await new Promise(r => setTimeout(r, 3));
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

await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('跳过')); if (b) b.click(); });
await sleep(600);

// 1. 配置 API Key
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-group-bottom .nav-item')].find(x => x.textContent.includes('设置')); if (i) i.click(); });
await sleep(900);
await page.type('.key-row input[type=password]', 'sk-mask-test-0000');
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('保存设置')); if (b) b.click(); });
await sleep(700);

// 2. 开启脱敏 + 添加词条（详细指标A/B）
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-group-bottom .nav-item')].find(x => x.textContent.includes('设置')); if (i) i.click(); });
await sleep(900);
const maskToggle = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.settings-form-group .btn')];
  const b = btns.find(x => x.textContent.includes('脱敏'));
  if (b) b.click();
  return !!b;
});
await sleep(400);
// 词条 textarea：聚焦后真实键盘输入（每行一条）→ blur 触发 applyTerms
await page.evaluate(() => {
  const tas = [...document.querySelectorAll('.settings-dialog textarea')];
  const ta = tas[tas.length - 1];
  if (ta) ta.focus();
});
await page.keyboard.type('详细指标A');
await page.keyboard.press('Enter');
await page.keyboard.type('详细指标B');
await page.keyboard.press('Tab'); // 触发 blur
await sleep(500);
// 关闭设置
await page.evaluate(() => { const b = [...document.querySelectorAll('.settings-footer .btn')].find(x => x.textContent.includes('取消')); if (b) b.click(); });
await sleep(500);

// 3. 导入敏感文件
await page.evaluate(() => { const i = [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('工作区范围')); if (i) i.click(); });
await sleep(700);
const fi = await page.$('input[type=file]');
await fi.uploadFile(SENS_FIXTURE);
await sleep(1200);

// 4. 打开文件
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-item')];
  const it = items.find(i => i.textContent.includes('AI 对话'));
  if (it) it.click();
  const toggle = document.querySelector('.nav-sub-toggle');
  if (toggle) toggle.click();
});
await sleep(800);
await page.evaluate(() => {
  const sub = [...document.querySelectorAll('.nav-submenu-item')];
  const f = sub.find(i => i.textContent.includes('t07-sensitive'));
  if (f) f.click();
});
await sleep(1000);

// 5. 发送消息（输入中故意带敏感词）
await page.type('.chat-input-row textarea', '把 ods_user_register_daily 的口径改为累计口径');
await sleep(300);
await page.click('.input-actions .btn-primary');
await sleep(6000);

// 6. 断言：AI 收到的 payload 只含编号，不含原文（逐条 dump）
const payloadCheck = await page.evaluate(() => {
  const last = window.__sentPayloads[window.__sentPayloads.length - 1];
  if (!last) return { found: false };
  const msgs = last.messages || [];
  const body = JSON.stringify(msgs);
  return {
    found: true,
    msgCount: msgs.length,
    perMsg: msgs.map(m => ({
      role: m.role,
      hasOriginal: (m.content || '').includes('ods_user_register_daily') || (m.content || '').includes('详细指标A') || (m.content || '').includes('13800138000'),
      hasMask: (m.content || '').includes('SENS-0'),
      preview: String(m.content || '').slice(0, 70),
    })),
    maskIds: [...new Set(body.match(/SENS-\d{3}/g) || [])],
  };
});
console.log('6. AI 收到的 payload:', JSON.stringify(payloadCheck, null, 1));

// 7. 应用候选 → 断言编辑器内容为还原后的真实内容
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.msg-actions .btn')];
  const b = btns.find(x => x.textContent.includes('应用为候选'));
  if (b) b.click();
});
await sleep(1500);
// 接受全部 → 落盘
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.diff-toolbar .tb-btn')];
  const b = btns.find(x => x.textContent.includes('接受全部'));
  if (b) b.click();
});
await sleep(1200);
page.on('dialog', d => d.accept());
await sleep(1800);
const finalCheck = await page.evaluate(() => {
  const host = document.querySelector('.cm-host .cm-content');
  const text = host ? host.textContent : '';
  return {
    hasOriginal: text.includes('详细指标A') && text.includes('ods_user_register_daily') && text.includes('13800138000'),
    hasMaskLeft: text.includes('SENS-'),
    head: text.slice(0, 120),
  };
});
console.log('7. 候选还原（编辑器）:', JSON.stringify(finalCheck, null, 1));
console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
