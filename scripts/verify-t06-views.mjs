// T06 多视图验证：导航各视图，断言视觉规则生效 + 截图存档
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';
const OUT = 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));
// 原生 confirm（退出 Diff 保护）自动取消，避免阻塞 evaluate
page.on('dialog', dialog => { dialog.dismiss().catch(() => {}); });

const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);

const probe = () => page.evaluate(() => {
  const gs = (el, prop) => (el ? getComputedStyle(el).getPropertyValue(prop).trim() : null);
  const gps = (el, pseudo, prop) => (el ? getComputedStyle(el, pseudo).getPropertyValue(prop).trim() : null);
  const q = sel => document.querySelector(sel);
  return {
    paneMetaTabular: gs(q('.pane-meta'), 'font-variant-numeric'),
    sendBtnBg: gs(q('.input-actions .btn-primary'), 'background-image'),
    sendBtnShadow: gs(q('.input-actions .btn-primary'), 'box-shadow'),
    spectrum: gs(q('.diff-spectrum'), 'background-image'),
    spectrumH: gs(q('.diff-spectrum'), 'height'),
    versionAxis: gps(q('.version-item'), '::before', 'background-image'),
    versionNodeCur: gs(q('.version-node.current'), 'background-image'),
    viewHead: gs(q('.view-head'), 'background-image'),
    modlogPanelBg: gs(q('.mod-log-panel'), 'background-color'),
    modlogBlur: gs(q('.mod-log-panel'), 'backdrop-filter'),
    bubbleUser: gs(q('.chat-message.user .msg-bubble'), 'background-image'),
    bubbleAssistant: gs(q('.chat-message.assistant .msg-bubble'), 'box-shadow'),
    welcomeGlow: gs(q('.welcome-guide'), 'background-image'),
    wgMarkShadow: gs(q('.wg-mark'), 'box-shadow'),
  };
});

const setView = (name) => page.evaluate(async (n) => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ activeView: n });
}, name);

// 1. 欢迎主视图
const r1 = await probe();
console.log('view=welcome', JSON.stringify(r1, null, 2));
await page.screenshot({ path: `${OUT}\\t06-main.png` });

// 2. 进入编辑态（关闭欢迎，显示 pane-meta / 校验面板）
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ showWelcome: false });
});
await sleep(900);
await page.screenshot({ path: `${OUT}\\t06-editor.png` });

// 3. Diff 视图
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
await sleep(1600);
const r2 = await probe();
console.log('view=diff', JSON.stringify(r2, null, 2));
await page.screenshot({ path: `${OUT}\\t06-diff.png` });

// 4. 注入对话消息（验证气泡质感），再进历史视图
try {
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    const s = m.useStore.getState();
    s.closeDiff();
    m.useStore.setState({
      diffActive: false,
      activeView: 'editor',
      chatMessages: [
        { id: 'm1', role: 'user', content: '请帮我优化这段 Prompt 的结构，并说明理由。', timestamp: Date.now(), tokens: 42, costEst: 0.0012 },
        { id: 'm2', role: 'assistant', content: '已调整模块顺序并统一了祈使句语气。\n\n- 将「背景」上移至头部\n- 为每个模块补充验收标准', reasoning: '用户原文缺少背景信息，补充后模型输出更稳定。', timestamp: Date.now(), tokens: 186, costEst: 0.0048, appliedAsCandidate: true },
      ],
    });
    m.useStore.setState({ activeView: 'history' });
  });
} catch (e) { console.log('STEP4 FAIL:', e.message); }
await sleep(1200);
const r3 = await probe();
console.log('view=history', JSON.stringify(r3, null, 2));
await page.screenshot({ path: `${OUT}\\t06-history.png` });

// 4b. 编辑视图（气泡可见）截图
try {
  await page.evaluate(async () => {
    const m = await import('/src/store/useStore.ts');
    m.useStore.setState({ activeView: 'editor' });
  });
} catch (e) { console.log('STEP4B FAIL:', e.message); }
await sleep(1000);
const r3b = await probe();
console.log('view=editor+messages', JSON.stringify(r3b, null, 2));
await page.screenshot({ path: `${OUT}\\t06-chat.png` });

// 5. 工作区视图
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ activeView: 'workspace' });
});
await sleep(1000);
const r4 = await probe();
console.log('view=workspace', JSON.stringify(r4, null, 2));
await page.screenshot({ path: `${OUT}\\t06-workspace.png` });

// 6. 侧边栏展开
await page.hover('.nav-column');
await sleep(900);
await page.screenshot({ path: `${OUT}\\t06-sidebar.png` });

console.log('pageErrors:', errors.length ? errors : 'none');
await browser.close();
