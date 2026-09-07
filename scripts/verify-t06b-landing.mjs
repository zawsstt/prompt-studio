// T06b 官网落地页验证：样式断言 + 交互断言 + 截图存档
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000/promptstudio.html';
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
page.on('console', msg => { if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`); });

// 本机系统「动画效果」可能关闭 → 强制 no-preference 以验证动效路径
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4200)); // 等 BlurText 完成

// 逐段滚动触发全部 reveal + 计数 + 环形
await page.evaluate(async () => {
  const step = () => new Promise(r => setTimeout(r, 260));
  for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await step(); }
  const bento = document.getElementById('bento');
  if (bento) bento.scrollIntoView({ block: 'center' });
});
await new Promise(r => setTimeout(r, 2600));

const probe = await page.evaluate(() => {
  const gs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p).trim() : null);
  const gps = (el, ps, p) => (el ? getComputedStyle(el, ps).getPropertyValue(p).trim() : null);
  const q = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];
  return {
    // 品牌渐变归位（全页无 8B5CF6 紫尾）
    violetLeft: all('*').some(el => (gs(el, 'background-image') || '').includes('139, 92, 246')),
    markGradient: gs(q('.nav-logo .mark'), 'background-image'),
    ctaGradient: gs(q('.nav-cta'), 'background-image'),
    btnPrimaryGradient: gs(q('.btn-primary'), 'background-image'),
    // 导航品牌发丝线
    navHairline: gps(q('.nav'), '::after', 'background-image').includes('linear-gradient'),
    // 滚动进度条
    progressW: gs(q('#progress'), 'width'),
    // BlurText
    charCount: all('.hero h1 .char').length,
    charVisible: all('.hero h1 .char').every(c => parseFloat(gs(c, 'opacity')) > 0.9),
    // 跑马灯双份
    provCount: all('#marqueeTrack .prov').length,
    marqueeAnim: gs(q('.marquee-track'), 'animation-name'),
    // Bento
    ringP: q('.b-ring').style.getPropertyValue('--p'),
    count90: q('[data-count="90"]').textContent,
    count40: q('[data-count="40"]').textContent,
    barsScaled: all('.bento .b-bar').every(b => parseFloat(gs(b, 'transform').split(',')[5] || '1') > 0.9 || gs(b, 'transform').includes('matrix(1')),
    // 时间线光谱主轴
    tlAxis: gps(q('.timeline'), '::before', 'background-image').includes('linear-gradient'),
    tlCurNode: gs(q('.tl-node.cur .tl-dot'), 'background-image'),
    // 玻璃面板光谱左缘
    gtSpectrum: gps(q('.glass-tab'), '::before', 'background-image').includes('linear-gradient'),
    gtBlur: gs(q('.glass-tab'), 'backdrop-filter'),
    // 流式光标渐变呼吸
    caretGradient: gs(q('.msg.ai .caret'), 'background-image'),
    // 滚动条
    scrollbarW: gs(document.documentElement, 'scrollbar-width'),
    // 焦点环
    focusRule: [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n').includes(':focus-visible'),
    // 动效路径（emulate 后应全活）
    marqueeAnim: gs(q('.marquee-track'), 'animation-name'),
    caretAnim: gs(q('.msg.ai .caret'), 'animation-name'),
  };
});

console.log(JSON.stringify(probe, null, 2));
console.log('pageErrors:', errors.length ? errors : 'none');

// 截图存档
await page.screenshot({ path: `${OUT}\\t06b-full.png`, fullPage: true });
await page.evaluate(() => scrollTo(0, 0));
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: `${OUT}\\t06b-hero.png` });
for (const [id, name] of [['#loop','loop'], ['#diff','diff'], ['#trust-panel','trust'], ['#providers','providers'], ['#versions','versions'], ['.trust','formula'], ['.cta-final','cta']]) {
  await page.evaluate(sel => { const el = document.querySelector(sel); el && el.scrollIntoView({ block: 'start' }); }, id);
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: `${OUT}\\t06b-${name}.png` });
}
console.log('screenshots saved → docs/t06b-*.png');
await browser.close();
