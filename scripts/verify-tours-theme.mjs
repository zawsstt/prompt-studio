// 模块引导 + 主题自定义 验收
//
//   node scripts/verify-tours-theme.mjs
//
// 覆盖：编辑区自动引导 / 模块首次进入自动引导 / 重播 / 深色模式 /
//       液态玻璃工具条 / 设置持久化 / 关键页面深色截图。

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

const closeOnboarding = async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.onboarding-dialog .settings-footer button')]
      .find(b => (b.textContent || '').includes('跳过'));
    btn?.click();
  });
  await sleep(350);
};
const openMainDoc = async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.welcome-guide button')]
      .find(b => (b.textContent || '').includes('打开主文档'));
    btn?.click();
  });
  await sleep(500);
};
const tourState = () => page.evaluate(() => ({
  active: !!document.querySelector('.tour-popover'),
  title: document.querySelector('.tour-title')?.textContent?.trim() ?? null,
  badge: document.querySelector('.tour-badge')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  count: document.querySelector('.tour-count')?.textContent?.trim() ?? null,
  hole: !!document.querySelector('.tour-hole'),
  seen: localStorage.getItem('promptstudio:tour:editor'),
}));
const clickTour = (label) => page.evaluate((text) => {
  const btn = [...document.querySelectorAll('.tour-actions button')]
    .find(b => (b.textContent || '').includes(text));
  btn?.click();
}, label);
const gotoNav = async (title) => {
  await page.evaluate((t) => {
    const item = [...document.querySelectorAll('.nav-group .nav-item')]
      .find(n => (n.getAttribute('title') || '') === t);
    item?.click();
  }, title);
  await sleep(1300);
};

try {
  console.log('\n[1] 首次进入编辑区：自动播放一次引导');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3200);
  await closeOnboarding();
  await openMainDoc();
  await sleep(1200);
  const first = await tourState();
  check('编辑区引导自动出现', first.active && first.badge?.includes('编辑工作区'), JSON.stringify(first));
  check('引导有聚光灯与步骤计数', first.hole && first.count === '1 / 4', JSON.stringify(first));
  check('首次出现时已写入已看标记', first.seen === '1', String(first.seen));
  await page.screenshot({ path: `${OUT}\\tour-editor.png` });

  await clickTour('下一步');
  await sleep(350);
  const step2 = await tourState();
  check('下一步切到第 2 步', step2.count === '2 / 4', step2.count ?? null);
  await clickTour('下一步');
  await sleep(350);
  await page.screenshot({ path: `${OUT}\\tour-editor-step3.png` });
  await clickTour('下一步');
  await sleep(350);
  const step4 = await tourState();
  check('走到最后一步', step4.count === '4 / 4', step4.count ?? null);
  await clickTour('完成');
  await sleep(300);
  check('完成后面板关闭', await page.evaluate(() => !document.querySelector('.tour-popover')));

  console.log('\n[2] 模块首次进入：各自自动播放一次');
  for (const [navTitle, expect] of [
    ['工作区范围', '工作区范围'],
    ['提示词评测', '提示词评测'],
    ['版本历史', '版本历史'],
    ['规则集', '规则集'],
  ]) {
    await gotoNav(navTitle);
    const st = await tourState();
    check(`${navTitle} 自动引导`, st.active && st.badge?.includes(expect), JSON.stringify(st));
    if (st.active) await clickTour('跳过');
    await sleep(300);
  }

  console.log('\n[3] 重播入口：模块标题旁的 ?');
  await gotoNav('提示词评测');
  const replay = await page.evaluate(() => !!document.querySelector('.ev-head-actions .tour-replay'));
  check('评测页有引导重播按钮', replay);
  await page.evaluate(() => document.querySelector('.ev-head-actions .tour-replay')?.click());
  await sleep(400);
  const replayed = await tourState();
  check('重播按钮能再次打开引导', replayed.active && replayed.count === '1 / 4', JSON.stringify(replayed));
  await clickTour('跳过');
  await sleep(300);

  console.log('\n[4] 深色模式 + 液态玻璃');
  await page.evaluate(() => document.querySelector('.nav-group-bottom .nav-item')?.click());
  await sleep(600);
  await page.evaluate(() => {
    const item = [...document.querySelectorAll('.settings-nav-item')]
      .find(n => (n.textContent || '').includes('外观'));
    item?.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.theme-seg button')]
      .find(b => (b.textContent || '').includes('深色'));
    btn?.click();
  });
  await sleep(450);
  const dark = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    dialogBg: getComputedStyle(document.querySelector('.settings-dialog')).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    text: getComputedStyle(document.querySelector('.settings-section-head h3')).color,
  }));
  check('深色主题已应用', dark.theme === 'dark' && dark.dialogBg === 'rgb(21, 26, 35)', JSON.stringify(dark));
  check('深色下文字保持高对比', dark.text === 'rgb(233, 236, 243)', dark.text);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.toolbar-style-card')]
      .find(b => (b.textContent || '').includes('液态玻璃'));
    btn?.click();
  });
  await sleep(450);
  const liquid = await page.evaluate(() => ({
    toolbar: document.documentElement.dataset.toolbar,
    previewBlur: getComputedStyle(document.querySelector('.appearance-stage .st-toolbar')).backdropFilter,
    savedTheme: localStorage.getItem('promptstudio:themeMode'),
    savedToolbar: localStorage.getItem('promptstudio:toolbarStyle'),
  }));
  check('液态玻璃生效并持久化',
    liquid.toolbar === 'liquid' && (liquid.previewBlur ?? '').includes('blur') && liquid.savedTheme === 'dark' && liquid.savedToolbar === 'liquid',
    JSON.stringify(liquid));
  await page.screenshot({ path: `${OUT}\\theme-appearance-liquid.png` });

  await page.evaluate(() => document.querySelector('.settings-header button')?.click());
  await sleep(400);
  // 回编辑视图截深色主界面
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.topbar .tab')]
      .find(b => (b.textContent || '').trim() === '编辑');
    tab?.click();
  });
  await sleep(500);
  await page.screenshot({ path: `${OUT}\\theme-editor-dark.png` });

  await gotoNav('提示词评测');
  await page.screenshot({ path: `${OUT}\\theme-eval-dark.png` });
  await gotoNav('版本历史');
  await page.screenshot({ path: `${OUT}\\theme-history-dark.png` });
  await gotoNav('工作区范围');
  await page.screenshot({ path: `${OUT}\\theme-workspace-dark.png` });
  await gotoNav('规则集');
  await page.screenshot({ path: `${OUT}\\theme-ruleset-dark.png` });

  console.log('\n[5] 刷新后主题保持');
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1800);
  const persisted = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    toolbar: document.documentElement.dataset.toolbar,
    tour: !!document.querySelector('.tour-popover'),
  }));
  check('刷新后仍是深色 + 液态玻璃', persisted.theme === 'dark' && persisted.toolbar === 'liquid', JSON.stringify(persisted));
  check('已看过的引导不再自动出现', persisted.tour === false, JSON.stringify(persisted));

  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
