// 首屏 AI 对话引导验收：完成首次欢迎卡后，自动完整走一遍对话模块（含语音两种模式）
//
//   node scripts/verify-chat-tour.mjs

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

const probeTour = () => page.evaluate(() => ({
  exists: !!document.querySelector('.tour-layer'),
  badge: document.querySelector('.tour-badge')?.textContent?.trim() ?? '',
  count: document.querySelector('.tour-count')?.textContent?.trim() ?? '',
  title: document.querySelector('.tour-title')?.textContent?.trim() ?? '',
  hole: !!document.querySelector('.tour-hole'),
  voiceRows: [...document.querySelectorAll('.tour-voice-modes .tvm-row')]
    .map(r => r.textContent?.trim() || ''),
}));

try {
  console.log('\n[1] 首次进入：欢迎卡关闭后自动播放 AI 对话引导');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('.onboarding-dialog', { timeout: 30000 });
  const onboardTitle = await page.$eval('.onboarding-dialog .sd-title', el => el.textContent?.trim() || '');
  check('首次进入出现欢迎卡', onboardTitle.includes('欢迎使用'), onboardTitle);

  const skipped = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.onboarding-dialog button')]
      .find(b => (b.textContent || '').includes('跳过'));
    if (!btn) return false;
    btn.click();
    return true;
  });
  check('关闭欢迎卡', skipped);

  await page.waitForFunction(
    () => document.querySelector('.tour-badge')?.textContent?.includes('AI 对话'),
    { timeout: 10000 }
  );
  await sleep(300);
  const first = await probeTour();
  console.log('  first:', JSON.stringify(first));
  check('自动进入 AI 对话模块引导', first.exists && first.badge.includes('AI 对话') && first.hole, JSON.stringify(first));
  check('第一步从对话头部开始（1 / 5）', first.count === '1 / 5' && first.title.includes('模型与清空'), JSON.stringify(first));

  const firstHoleData = await page.evaluate(() => {
    const h = document.querySelector('.tour-hole')?.getBoundingClientRect();
    const c = document.querySelector('.chat-header')?.getBoundingClientRect();
    const ok = !!h && !!c &&
      h.top < c.bottom + 8 && h.bottom > c.top - 8 && h.left < c.right && h.right > c.left;
    return {
      ok,
      hole: h ? { left: h.left, top: h.top, width: h.width, height: h.height } : null,
      head: c ? { left: c.left, top: c.top, width: c.width, height: c.height } : null,
    };
  });
  console.log('  first hole:', JSON.stringify(firstHoleData));
  check('聚光灯高亮 AI 对话头部', firstHoleData.ok, JSON.stringify(firstHoleData));

  console.log('\n[2] 完整走完 5 步，最后一步对比语音两种模式');
  for (let i = 0; i < 4; i++) {
    await page.click('.tour-actions .btn-primary');
    await sleep(260);
  }
  const voice = await probeTour();
  console.log('  voice:', JSON.stringify(voice));
  check('走到第 5 步（5 / 5）', voice.count === '5 / 5', voice.count);
  check('语音步骤标题正确', voice.title.includes('语音输入') && voice.title.includes('直出'), voice.title);
  check('语音步骤内嵌安全 / 直出对比',
    voice.voiceRows.length === 2 &&
    voice.voiceRows[0].includes('安全模式') &&
    voice.voiceRows[0].includes('确认') &&
    voice.voiceRows[1].includes('直出模式') &&
    voice.voiceRows[1].includes('直接发送'),
    JSON.stringify(voice.voiceRows));
  check('语音步骤仍用聚光灯定位麦克风', voice.hole);

  await page.screenshot({ path: `${OUT}\\tour-chat-voice.png` });

  console.log('\n[3] 完成后记录已看，且不触发编辑区引导');
  await page.click('.tour-actions .btn-primary');
  await sleep(400);
  const done = await page.evaluate(() => ({
    tourGone: !document.querySelector('.tour-layer'),
    chatSeen: localStorage.getItem('promptstudio:tour:chat'),
    editorSeen: localStorage.getItem('promptstudio:tour:editor'),
  }));
  check('完成后关闭引导', done.tourGone);
  check('AI 对话引导记录为已看', done.chatSeen === '1', String(done.chatSeen));
  check('欢迎页未结束时不抢先播放编辑区引导', done.editorSeen !== '1', String(done.editorSeen));

  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
