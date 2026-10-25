// 首次引导高度 / 窄分屏聊天布局 / 输入框联动 验收
//
//   node scripts/verify-chat-layout.mjs

import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:4173';
const OUT = 'E:\\DIFF_prompt - 副本\\docs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${cond ? '' : `  ${extra}`}`);
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu', '--window-size=1440,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`));
page.on('dialog', dialog => { dialog.accept().catch(() => {}); });

const shrinkChatToMin = async () => {
  const handle = await page.$('.panel-resize-handle');
  if (!handle) return false;
  const box = await handle.boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 260, box.y + 20, { steps: 12 });
  await page.mouse.up();
  await sleep(500);
  return true;
};

try {
  console.log('\n[1] 首次引导：高度由内容决定');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3200);
  const onboarding = await page.evaluate(() => {
    const dialog = document.querySelector('.onboarding-dialog');
    if (!dialog) return null;
    const body = dialog.querySelector('.ob-body');
    const footer = dialog.querySelector('.settings-footer');
    const steps = dialog.querySelector('.ob-steps');
    const dr = dialog.getBoundingClientRect();
    const br = body?.getBoundingClientRect();
    const fr = footer?.getBoundingClientRect();
    const sr = steps?.getBoundingClientRect();
    return {
      height: Math.round(dr.height),
      width: Math.round(dr.width),
      bodyHeight: br ? Math.round(br.height) : null,
      gapBodyFooter: br && fr ? Math.round(fr.top - br.bottom) : null,
      gapStepsBody: sr && br ? Math.round(br.top - sr.bottom) : null,
      scrollHeight: dialog.scrollHeight,
      clientHeight: dialog.clientHeight,
    };
  });
  check('引导弹窗出现', !!onboarding, JSON.stringify(onboarding));
  check('高度紧凑（< 520px）', (onboarding?.height ?? 999) < 520, JSON.stringify(onboarding));
  check('正文与底部之间没有大片留白', (onboarding?.gapBodyFooter ?? 999) <= 40, JSON.stringify(onboarding));
  check('宽度仍是 560px', onboarding?.width === 560, String(onboarding?.width));
  await page.screenshot({ path: `${OUT}\\onboarding-compact.png` });

  console.log('\n[2] 关闭引导，把对话分屏拉到最小');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.onboarding-dialog .settings-footer button')]
      .find(b => (b.textContent || '').includes('跳过'));
    btn?.click();
  });
  await sleep(500);
  check('引导已关闭', await page.evaluate(() => !document.querySelector('.onboarding-dialog')));
  // 本脚本只测布局：把所有模块引导标为已看，避免自动弹出遮挡操作
  await page.evaluate(() => {
    ['editor', 'chat', 'workspace', 'eval', 'history', 'ruleset', 'diff']
      .forEach(id => localStorage.setItem(`promptstudio:tour:${id}`, '1'));
  });
  // 关闭编辑器上的欢迎页，露出真实编辑器
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.welcome-guide button')]
      .find(b => (b.textContent || '').includes('打开主文档'));
    btn?.click();
  });
  await sleep(600);
  check('拖动分屏手柄', await shrinkChatToMin());
  const narrow = await page.evaluate(() => {
    const panel = document.querySelector('.chat-panel');
    return { width: Math.round(panel.getBoundingClientRect().width) };
  });
  check('对话面板收窄到最小（约 300px）', narrow.width >= 295 && narrow.width <= 320, JSON.stringify(narrow));

  console.log('\n[3] 触发引用 + 多行输入');
  // 选中编辑器内容 → 点「询问」→ 引用 chip + 草稿进入输入区
  await page.click('.cm-content');
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await sleep(500);
  const hasToolbar = await page.evaluate(() => !!document.querySelector('.st-toolbar'));
  if (hasToolbar) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.st-action')]
        .find(b => (b.textContent || '').trim() === '询问');
      btn?.click();
    });
    await sleep(600);
  }
  check('选区工具条可触发引用', hasToolbar, String(hasToolbar));
  const refState = await page.evaluate(() => ({
    ref: !!document.querySelector('.chat-reference-block'),
    value: document.querySelector('textarea[aria-label="对话输入"]')?.value ?? '',
  }));
  check('输入区出现引用 chip 与草稿', refState.ref && refState.value.length > 0, JSON.stringify({ ref: refState.ref, len: refState.value.length }));

  // 追加三行（Shift+Enter 换行，不触发发送）
  const ta = await page.$('textarea[aria-label="对话输入"]');
  if (ta) {
    await ta.focus();
    await page.keyboard.press('End');
    for (const line of ['第一行补充', '第二行补充', '第三行补充']) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
      await page.keyboard.type(line, { delay: 6 });
    }
  }
  await sleep(500);

  const layout = await page.evaluate(() => {
    const panel = document.querySelector('.chat-panel');
    const area = document.querySelector('.chat-input-area');
    const bar = document.querySelector('.context-bar');
    const composer = document.querySelector('.chat-composer');
    const ta = document.querySelector('textarea[aria-label="对话输入"]');
    const row = document.querySelector('.chat-input-row');
    const hint = document.querySelector('.ctx-hint');
    const foot = document.querySelector('.composer-foot');
    const ref = document.querySelector('.chat-reference-block');
    const rect = el => (el ? el.getBoundingClientRect() : null);
    return {
      panelWidth: Math.round(rect(panel)?.width ?? 0),
      areaHeight: Math.round(rect(area)?.height ?? 0),
      barHeight: Math.round(rect(bar)?.height ?? 0),
      composerHeight: Math.round(rect(composer)?.height ?? 0),
      composerWidth: Math.round(rect(composer)?.width ?? 0),
      taHeight: Math.round(rect(ta)?.height ?? 0),
      taClient: ta?.clientHeight ?? 0,
      taScroll: ta?.scrollHeight ?? 0,
      taValueLines: (ta?.value ?? '').split('\n').length,
      rowOverflow: row ? row.scrollWidth > row.clientWidth + 1 : null,
      areaOverflow: area ? area.scrollWidth > area.clientWidth + 1 : null,
      hintDisplay: hint ? getComputedStyle(hint).display : null,
      footDisplay: foot ? getComputedStyle(foot).display : null,
      refHeight: Math.round(rect(ref)?.height ?? 0),
      barTextVertical: bar ? rect(bar).height > 40 : null,
    };
  });
  console.log('  layout:', JSON.stringify(layout));
  check('上下文条保持单行、不再被挤成竖排', layout.barHeight > 0 && layout.barHeight < 40, JSON.stringify(layout.barHeight));
  check('窄屏隐藏次要文案（规则摘要/字数）', layout.hintDisplay === 'none' && layout.footDisplay === 'none', JSON.stringify({ hint: layout.hintDisplay, foot: layout.footDisplay }));
  check('输入区没有横向溢出', layout.rowOverflow === false && layout.areaOverflow === false, JSON.stringify(layout));
  check('多行输入完整可见（未被裁掉）', layout.taValueLines >= 4 && layout.taScroll <= layout.taClient + 2, JSON.stringify(layout));
  check('输入卡片高度合理（< 260px）', layout.composerHeight > 0 && layout.composerHeight < 260, String(layout.composerHeight));
  check('引用 chip 与输入框在同一卡片内', layout.refHeight > 0, String(layout.refHeight));

  await page.evaluate(() => document.querySelector('.chat-panel')?.scrollIntoView({ block: 'end' }));
  await sleep(300);
  const panelEl = await page.$('.chat-panel');
  if (panelEl) await panelEl.screenshot({ path: `${OUT}\\chat-narrow-composer.png` });

  console.log('\n[4] 宽分屏：辅助提示与发送文案回归');
  // 把分割线往左拖，恢复较宽的对话面板
  const handle = await page.$('.panel-resize-handle');
  if (handle) {
    const box = await handle.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 180, box.y + 20, { steps: 12 });
      await page.mouse.up();
    }
  }
  await sleep(500);
  const wide = await page.evaluate(() => {
    const panel = document.querySelector('.chat-panel');
    const foot = document.querySelector('.composer-foot');
    const hint = document.querySelector('.ctx-hint');
    const ta = document.querySelector('textarea[aria-label="对话输入"]');
    return {
      width: Math.round(panel.getBoundingClientRect().width),
      footDisplay: foot ? getComputedStyle(foot).display : null,
      hintDisplay: hint ? getComputedStyle(hint).display : null,
      taClient: ta?.clientHeight ?? 0,
      taScroll: ta?.scrollHeight ?? 0,
      focusBorder: getComputedStyle(document.querySelector('.chat-composer')).borderColor,
    };
  });
  check('拉宽后恢复辅助提示', wide.width > 340 && wide.footDisplay !== 'none' && wide.hintDisplay !== 'none', JSON.stringify(wide));
  check('宽屏下多行内容仍完整', wide.taScroll <= wide.taClient + 2, JSON.stringify(wide));

  await page.screenshot({ path: `${OUT}\\chat-composer-wide.png` });

  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
