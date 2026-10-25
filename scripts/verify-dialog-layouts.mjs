// 弹窗布局回归：设置中心拆分样式后，规则集导入弹窗仍保持原有内边距与尺寸
//
//   node scripts/verify-dialog-layouts.mjs

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

try {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3000);
  // 跳首次引导
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.onboarding-dialog .settings-footer button')]
      .find(b => (b.textContent || '').includes('跳过'));
    btn?.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    ['editor', 'chat', 'workspace', 'eval', 'history', 'ruleset', 'diff']
      .forEach(id => localStorage.setItem(`promptstudio:tour:${id}`, '1'));
  });

  console.log('\n[1] 规则集导入弹窗：保留原有 padding / 尺寸');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.topbar button')]
      .find(b => (b.textContent || '').includes('导入规则集'));
    btn?.click();
  });
  await sleep(500);
  const dialog = await page.evaluate(() => {
    const el = document.querySelector('.ruleset-import-dialog');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const footer = el.querySelector('.settings-footer');
    const fr = footer?.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      height: Math.round(r.height),
      paddingTop: cs.paddingTop,
      paddingLeft: cs.paddingLeft,
      footerVisible: !!fr && fr.bottom <= r.bottom + 1,
      scrollable: el.scrollHeight > el.clientHeight + 1,
    };
  });
  check('导入弹窗出现', !!dialog, JSON.stringify(dialog));
  check('保留 26px 内边距', dialog?.paddingTop === '26px' && dialog?.paddingLeft === '28px', JSON.stringify(dialog));
  check('宽度不被设置中心影响', (dialog?.width ?? 0) <= 700, String(dialog?.width));
  check('底部按钮在弹窗内可见', dialog?.footerVisible, JSON.stringify(dialog));
  await page.screenshot({ path: `${OUT}\\ruleset-import-dialog.png` });

  await page.evaluate(() => document.querySelector('.ruleset-import-dialog .settings-header button')?.click());
  await sleep(300);

  console.log('\n[2] 设置中心仍是宽面板');
  await page.evaluate(() => document.querySelector('.nav-group-bottom .nav-item')?.click());
  await sleep(500);
  const center = await page.evaluate(() => {
    const el = document.querySelector('.settings-center');
    const body = el?.querySelector('.settings-body');
    return {
      width: el ? Math.round(el.getBoundingClientRect().width) : null,
      height: el ? Math.round(el.getBoundingClientRect().height) : null,
      bodyScrollable: body ? body.scrollHeight > body.clientHeight + 1 : null,
    };
  });
  check('设置中心宽 860 / 高 680', center.width === 860 && center.height === 680, JSON.stringify(center));
  check('内容区可独立滚动', center.bodyScrollable === true, JSON.stringify(center));

  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
