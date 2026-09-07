// 验证：首次打开 = 引导弹窗 + 欢迎页 + 无校验信息；跳过后再刷新不弹
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

// ── 1) 首次打开 ──
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

const first = await page.evaluate(() => ({
  onboarding: !!document.querySelector('.ob-steps'),
  welcome: !!document.querySelector('.welcome-guide'),
  valBanner: !!document.querySelector('.validation-banner'),
  valPanel: !!document.querySelector('.validation-panel, .validation-panel-collapsed'),
  crumb: document.querySelector('.doc-indicator')?.textContent?.trim(),
  meta: !!document.querySelector('.pane-meta'),
  rulesetChip: !!document.querySelector('.chip-ruleset'),
  stepTitles: [...document.querySelectorAll('.ob-step span')].map(el => el.textContent.trim()),
}));
console.log('=== 1) 首次打开 ===');
console.log(JSON.stringify(first, null, 1));
console.log(
  first.onboarding && first.welcome
    ? '✅ 引导弹窗 + 欢迎页'
    : '❌ 弹窗/欢迎页缺失'
);
console.log(
  !first.valBanner && !first.valPanel && !first.meta && !first.rulesetChip
    ? '✅ 无校验横幅/校验面板/行数/规则集 chip'
    : '❌ 仍有不应出现的信息'
);

await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\onboarding-first.png' });

// ── 2) 跳过引导 → 弹窗关闭、欢迎页保留 ──
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.settings-footer .btn')];
  const skip = btns.find(b => b.textContent.includes('跳过'));
  if (skip) skip.click();
});
await new Promise(r => setTimeout(r, 600));
const afterSkip = await page.evaluate(() => ({
  onboarding: !!document.querySelector('.ob-steps'),
  welcome: !!document.querySelector('.welcome-guide'),
  onboarded: localStorage.getItem('promptstudio:onboarded'),
}));
console.log('=== 2) 跳过引导 ===');
console.log(JSON.stringify(afterSkip, null, 1));
console.log(
  !afterSkip.onboarding && afterSkip.welcome && afterSkip.onboarded === '1'
    ? '✅ 弹窗关闭、欢迎页保留、标记已记录'
    : '❌ 跳过逻辑异常'
);

// ── 3) 刷新后不再弹窗（onboarded 已标记），欢迎页仍在（无编辑记录） ──
await page.reload({ waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 3500));
const afterReload = await page.evaluate(() => ({
  onboarding: !!document.querySelector('.ob-steps'),
  welcome: !!document.querySelector('.welcome-guide'),
}));
console.log('=== 3) 刷新后 ===');
console.log(JSON.stringify(afterReload, null, 1));
console.log(
  !afterReload.onboarding && afterReload.welcome
    ? '✅ 不再弹引导，欢迎页保留'
    : '❌ 刷新后状态异常'
);

await browser.close();
