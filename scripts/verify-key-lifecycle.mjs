// API Key 生命周期回归：新增 → 已配置展示 → 清除 → 刷新后彻底未配置（假配置态回归）
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

const snap = () => page.evaluate(() => ({
  pillText: document.querySelector('.model-pill .mn')?.textContent || null,
  pillOff: !!document.querySelector('.model-pill .pulse.off'),
  keyInput: document.querySelector('.settings-form-group input[type=password]')?.value ?? null,
  keyStatus: document.querySelector('.key-status')?.textContent?.trim() ?? null,
  hasClearBtn: !!document.querySelector('.key-clear'),
  storedRaw: localStorage.getItem('ps_key_deepseek') ?? null,
}));

// ══ 1. 全新用户：应为未配置 ══
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4200));
await page.evaluate(async () => { const m = await import('/src/store/useStore.ts'); m.useStore.getState().openSettings(); });
await new Promise(r => setTimeout(r, 800));
console.log('1. FRESH:', JSON.stringify(await snap()));

// ══ 2. 新增 Key：store 置入并保存 ══
await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  m.useStore.setState({ apiKeyInput: 'sk-live-test-9f8e7d' });
  await m.useStore.getState().doSaveSettings();
});
await new Promise(r => setTimeout(r, 600));
const afterSave = await snap();
const storeKey = await page.evaluate(async () => { const m = await import('/src/store/useStore.ts'); return m.useStore.getState().apiKeyInput; });
console.log('2. AFTER-SAVE:', JSON.stringify({ ...afterSave, storeApiKey: storeKey, storedRaw: afterSave.storedRaw?.slice(0, 8) + '…' }));
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4200));
await page.evaluate(async () => { const m = await import('/src/store/useStore.ts'); m.useStore.getState().openSettings(); });
await new Promise(r => setTimeout(r, 800));
console.log('3. AFTER-RELOAD(已配置):', JSON.stringify(await snap()));

// ══ 3. 清除：重新打开设置 → 点「清除」按钮 → 保存 → 刷新 → 应彻底未配置 ══
await page.evaluate(async () => { const m = await import('/src/store/useStore.ts'); m.useStore.getState().openSettings(); });
await new Promise(r => setTimeout(r, 800));
const beforeClear = await snap();
console.log('3. REOPEN(已配置展示):', JSON.stringify({ keyInput: beforeClear.keyInput?.slice(0, 10) + '…', keyStatus: beforeClear.keyStatus, hasClearBtn: beforeClear.hasClearBtn, pillText: beforeClear.pillText, pillOff: beforeClear.pillOff }));
await page.click('.key-clear');
await new Promise(r => setTimeout(r, 400));
const afterClearInput = await snap();
console.log('4. AFTER-CLEAR-CLICK:', JSON.stringify({ keyInput: afterClearInput.keyInput, keyStatus: afterClearInput.keyStatus, hasClearBtn: afterClearInput.hasClearBtn }));
await page.evaluate(async () => { const m = await import('/src/store/useStore.ts'); await m.useStore.getState().doSaveSettings(); });
await new Promise(r => setTimeout(r, 600));
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4200));
await page.evaluate(async () => { const m = await import('/src/store/useStore.ts'); m.useStore.getState().openSettings(); });
await new Promise(r => setTimeout(r, 800));
console.log('5. AFTER-DELETE+RELOAD(应未配置):', JSON.stringify(await snap()));

console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
