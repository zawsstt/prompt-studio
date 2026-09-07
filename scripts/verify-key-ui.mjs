// API Key 生命周期回归（纯 UI 点击路径，绕开动态 import 双实例失真）：
// 新增 → 已配置展示 → 清除 → 保存 → 刷新 → 彻底未配置
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
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

// 关闭新手指引（点「跳过（不再提示）」）
async function dismissOnboarding() {
  const btn = await page.$('.settings-footer .btn-ghost');
  if (btn) { await btn.click(); await sleep(600); }
}

// 打开设置（点击侧栏「设置」）
async function openSettings() {
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.nav-group-bottom .nav-item')];
    const it = items.find(i => i.textContent.includes('设置'));
    if (it) it.click();
  });
  await sleep(900);
}

const snap = () => page.evaluate(() => ({
  pillText: document.querySelector('.model-pill .mn')?.textContent ?? null,
  pillOff: !!document.querySelector('.model-pill .pulse.off'),
  hasSettings: !!document.querySelector('.settings-dialog .sd-title'),
  pwValue: document.querySelector('.key-row input[type=password]')?.value ?? null,
  keyStatus: document.querySelector('.key-status')?.textContent?.trim() ?? null,
  hasClearBtn: !!document.querySelector('.key-clear'),
  storedRaw: localStorage.getItem('ps_key_deepseek') ?? null,
}));

// ══ 1. 全新用户 ══
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await dismissOnboarding();
await openSettings();
console.log('1. FRESH:', JSON.stringify(await snap()));

// ══ 2. 输入 Key → 保存 ══
await page.type('.key-row input[type=password]', 'sk-ui-test-7h4k2m');
await sleep(300);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.settings-footer .btn')];
  const save = btns.find(b => b.textContent.includes('保存设置'));
  if (save) save.click();
});
await sleep(800);
console.log('2. AFTER-SAVE:', JSON.stringify({ ...(await snap()), storedRaw: (await snap()).storedRaw?.slice(0, 10) + '…' }));

// ══ 3. 刷新 → 已配置展示（打码值 + 清除按钮 + 绿色 pill） ══
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await dismissOnboarding();
await openSettings();
console.log('3. RELOAD-CONFIGURED:', JSON.stringify(await snap()));

// ══ 4. 点「清除」→ 保存 → 刷新 → 彻底未配置（假配置态回归测试） ══
await page.click('.key-clear');
await sleep(400);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.settings-footer .btn')];
  const save = btns.find(b => b.textContent.includes('保存设置'));
  if (save) save.click();
});
await sleep(800);
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);
await dismissOnboarding();
await openSettings();
console.log('4. RELOAD-AFTER-DELETE:', JSON.stringify(await snap()));

console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
