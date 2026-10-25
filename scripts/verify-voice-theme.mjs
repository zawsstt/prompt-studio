// 语音浮窗明暗适配验收：浅色模式必须跟随蓝白体系，深色保持原深色卡片
//
//   node scripts/verify-voice-theme.mjs

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

// 打桩语音识别，避免真实麦克风/权限
await page.evaluateOnNewDocument(() => {
  class FakeSpeechRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
    }
    start() {
      setTimeout(() => this.onstart && this.onstart(), 60);
      setTimeout(() => {
        const result = [{ transcript: '请帮我优化这段提示词' }];
        result.isFinal = true;
        this.onresult && this.onresult({ resultIndex: 0, results: [result] });
      }, 260);
    }
    stop() {
      setTimeout(() => this.onend && this.onend(), 60);
    }
  }
  window.SpeechRecognition = FakeSpeechRecognition;
  window.webkitSpeechRecognition = FakeSpeechRecognition;
});

const probe = () => page.evaluate(() => {
  const card = document.querySelector('.voice-dock-pill');
  const cs = card ? getComputedStyle(card) : null;
  const transcript = document.querySelector('.voice-transcript-text');
  const close = document.querySelector('.voice-btn-close');
  const modeBar = document.querySelector('.voice-mode-switch-bar');
  const ghost = document.querySelector('.voice-action-btn.ghost');
  return {
    theme: document.documentElement.dataset.theme,
    exists: !!card,
    cardBg: cs?.backgroundImage,
    cardColor: cs?.color,
    transcriptColor: transcript ? getComputedStyle(transcript).color : null,
    closeBg: close ? getComputedStyle(close).backgroundColor : null,
    modeBg: modeBar ? getComputedStyle(modeBar).backgroundColor : null,
    ghostBg: ghost ? getComputedStyle(ghost).backgroundColor : null,
  };
});

// 取亮度判断浅色 / 深色背景
const luminance = color => {
  const m = (color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return -1;
  return 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
};

const probeGuide = () => page.evaluate(() => {
  const guide = document.querySelector('.voice-mode-guide');
  if (!guide) return null;
  const cs = getComputedStyle(guide);
  const options = [...guide.querySelectorAll('.vmg-option')];
  return {
    bg: cs.backgroundColor,
    color: cs.color,
    optionCount: options.length,
    texts: options.map(o => o.textContent || ''),
    demos: guide.querySelectorAll('.vmg-demo').length,
    sendChip: !!guide.querySelector('.vmg-demo-send'),
    activeMode: options.find(o => o.classList.contains('on'))?.className || '',
  };
});

const shotGuideAndCard = async (path) => {
  const clip = await page.evaluate(() => {
    const g = document.querySelector('.voice-mode-guide')?.getBoundingClientRect();
    const b = document.querySelector('.voice-dock-pill')?.getBoundingClientRect();
    if (!g || !b) return null;
    const x = Math.min(g.x, b.x) - 10;
    const y = Math.min(g.y, b.y) - 10;
    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.max(g.right, b.right) - Math.min(g.x, b.x) + 20,
      height: Math.max(g.bottom, b.bottom) - Math.min(g.y, b.y) + 20,
    };
  });
  if (clip) await page.screenshot({ path, clip });
};

try {
  console.log('\n[1] 浅色模式：卡片跟随蓝白体系');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem('promptstudio:onboarded', '1');
    localStorage.setItem('promptstudio:lastEditingFile', JSON.stringify({ path: null }));
    localStorage.setItem('promptstudio:themeMode', 'light');
    ['editor', 'chat', 'workspace', 'eval', 'history', 'ruleset', 'diff']
      .forEach(id => localStorage.setItem(`promptstudio:tour:${id}`, '1'));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2400);

  await page.click('.voice-mic-btn');
  await sleep(900);
  check('打开语音卡片不再自动弹模式说明', !(await page.$('.voice-mode-guide')));

  console.log('  -- 两种模式说明/演示（手动「演示」）--');
  await page.click('.voice-mode-help');
  await sleep(300);
  const guideLight = await probeGuide();
  console.log('  guide(light):', JSON.stringify(guideLight));
  check('模式条「演示」打开两种模式说明',
    !!guideLight && guideLight.optionCount === 2 &&
    guideLight.texts[0].includes('安全模式') && guideLight.texts[1].includes('直出模式'),
    JSON.stringify(guideLight?.texts));
  check('两条模式各有模拟演示',
    !!guideLight && guideLight.demos === 2 && guideLight.sendChip,
    JSON.stringify({ demos: guideLight?.demos, send: guideLight?.sendChip }));
  check('浅色下说明面板为浅色',
    !!guideLight && luminance(guideLight.bg) > 200 && luminance(guideLight.color) < 120,
    JSON.stringify({ bg: guideLight?.bg, color: guideLight?.color }));
  await shotGuideAndCard(`${OUT}\\voice-mode-guide-light.png`);

  await page.click('.vmg-option.direct');
  await sleep(500);
  const afterDirect = await page.evaluate(() => ({
    guideGone: !document.querySelector('.voice-mode-guide'),
    indicator: document.querySelector('.voice-mode-indicator')?.textContent || '',
    saved: localStorage.getItem('voice-hotkey-config'),
  }));
  check('选直出后关闭说明并切到直出',
    afterDirect.guideGone && afterDirect.indicator.includes('直出') && (afterDirect.saved || '').includes('direct'),
    JSON.stringify(afterDirect));

  await page.click('.voice-mode-help');
  await sleep(300);
  check('模式条「演示」可重新打开说明', !!(await page.$('.voice-mode-guide')));
  await page.click('.vmg-option.safe');
  await sleep(500);
  const afterSafe = await page.evaluate(() => ({
    guideGone: !document.querySelector('.voice-mode-guide'),
    indicator: document.querySelector('.voice-mode-indicator')?.textContent || '',
    saved: localStorage.getItem('voice-hotkey-config'),
  }));
  check('选安全后关闭说明并切到安全',
    afterSafe.guideGone && afterSafe.indicator.includes('安全') && (afterSafe.saved || '').includes('safe'),
    JSON.stringify(afterSafe));

  const light = await probe();
  console.log('  light:', JSON.stringify(light));
  check('浅色下语音卡片出现', light.exists && light.theme === 'light', JSON.stringify(light));
  check('卡片改为浅色玻璃（不再黑底）',
    (light.cardBg ?? '').includes('255, 255, 255') && light.cardColor === 'rgb(29, 29, 31)',
    JSON.stringify({ bg: light.cardBg, color: light.cardColor }));
  check('正文与关闭按钮同步浅色',
    light.transcriptColor === 'rgb(29, 29, 31)' && (light.closeBg ?? '').includes('15, 23, 42'),
    JSON.stringify({ text: light.transcriptColor, close: light.closeBg }));
  check('模式条与 ghost 按钮同步浅色',
    (light.modeBg ?? '').includes('99, 102, 241') && (light.ghostBg ?? '').includes('15, 23, 42'),
    JSON.stringify({ mode: light.modeBg, ghost: light.ghostBg }));

  const barLight = await page.$('.voice-floating-bar');
  if (barLight) await barLight.screenshot({ path: `${OUT}\\voice-light.png` });

  console.log('\n[2] 深色模式：保持原有深色卡片');
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(600);
  const dark = await probe();
  console.log('  dark:', JSON.stringify(dark));
  check('切到深色后卡片恢复深色玻璃',
    dark.theme === 'dark' &&
    (dark.cardBg ?? '').includes('24, 26, 36') &&
    dark.cardColor === 'rgb(255, 255, 255)',
    JSON.stringify({ bg: dark.cardBg, color: dark.cardColor }));
  check('深色正文与关闭按钮保持白色',
    (dark.transcriptColor ?? '').includes('255, 255, 255') && (dark.closeBg ?? '').includes('255, 255, 255'),
    JSON.stringify({ text: dark.transcriptColor, close: dark.closeBg }));

  const barDark = await page.$('.voice-floating-bar');
  if (barDark) await barDark.screenshot({ path: `${OUT}\\voice-dark.png` });

  await page.click('.voice-mode-help');
  await sleep(300);
  const guideDark = await probeGuide();
  console.log('  guide(dark):', JSON.stringify(guideDark));
  check('深色下说明面板跟随深色',
    !!guideDark && luminance(guideDark.bg) < 70 && luminance(guideDark.color) > 180,
    JSON.stringify({ bg: guideDark?.bg, color: guideDark?.color }));
  await shotGuideAndCard(`${OUT}\\voice-mode-guide-dark.png`);
  await page.click('.vmg-close');
  await sleep(250);
  check('深色说明可关闭', !(await page.$('.voice-mode-guide')));

  console.log('\n[3] 切回浅色仍恢复浅色卡片');
  await page.evaluate(() => document.querySelector('.theme-toggle')?.click());
  await sleep(600);
  const back = await probe();
  check('来回切换不残留深色',
    back.theme === 'light' && (back.cardBg ?? '').includes('255, 255, 255'),
    JSON.stringify({ theme: back.theme, bg: back.cardBg }));

  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
