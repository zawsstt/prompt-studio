// T06c 官网 V3 验证：NANFU 转译层断言 + 截图存档
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
await new Promise(r => setTimeout(r, 4600)); // 等 hero 字母行进 + 首屏 IO

// 逐段滚动触发全部 IO
await page.evaluate(async () => {
  const step = () => new Promise(r => setTimeout(r, 260));
  for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await step(); }
  const bento = document.getElementById('bento');
  if (bento) bento.scrollIntoView({ block: 'center' });
});
await new Promise(r => setTimeout(r, 2600));
await page.evaluate(() => scrollTo(0, 0));
await new Promise(r => setTimeout(r, 800));

const probe = await page.evaluate(() => {
  const gs = (el, p) => (el ? getComputedStyle(el).getPropertyValue(p).trim() : null);
  const gps = (el, ps, p) => (el ? getComputedStyle(el, ps).getPropertyValue(p).trim() : null);
  const q = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];
  return {
    // 巨型字体
    heroFs: gs(q('#heroTitle'), 'font-size'),
    heroLs: gs(q('#heroTitle'), 'letter-spacing'),
    h2Fs: gs(q('#loop h2'), 'font-size'),
    // 烧穿渐变
    heroGrad: gs(q('#heroTitle .txt-grad'), 'background-image'),
    gradCount: all('.txt-grad').length,
    // 字母行进
    ltrTotal: all('.ltr').length,
    ltrVisible: all('#heroTitle .ltr').every(c => parseFloat(gs(c, 'opacity')) > 0.9),
    ltrTranslate: all('#heroTitle .ltr').slice(0, 3).map(c => gs(c, 'transform')),
    ltrCurve: all('#heroTitle .ltr')[0] ? getComputedStyle(all('#heroTitle .ltr')[0]).transitionTimingFunction : null,
    // 深色电影段落
    trustBg: gs(q('.trust'), 'background-color'),
    trustRadial: gs(q('.trust'), 'background-image').includes('radial-gradient'),
    trustH2Grad: gs(q('.trust h2'), 'background-image'),
    trustSpectrum: gps(q('.trust'), '::after', 'background-image').includes('linear-gradient'),
    chipDark: gs(q('.f-chip'), 'background-color'),
    // 深色 footer
    footerBg: gs(q('.footer'), 'background-color'),
    // 仪式细节
    fixBox: !!q('.fix-box a'),
    scrollHint: !!q('.scroll-hint .mouse'),
    leadLine: !!q('.lead-line path'),
    leadDash: q('.lead-line path') ? q('.lead-line path').getAttribute('stroke-dasharray') : null,
    // 既有机制回归
    marqueeAnim: gs(q('.marquee-track'), 'animation-name'),
    ringP: q('.b-ring').style.getPropertyValue('--p'),
    count90: q('[data-count="90"]').textContent,
    caretGradient: gs(q('.msg.ai .caret'), 'background-image'),
  };
});

console.log(JSON.stringify(probe, null, 2));
console.log('pageErrors:', errors.length ? errors : 'none');

// 截图
await page.screenshot({ path: `${OUT}\\t06c-full.png`, fullPage: true });
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}\\t06c-hero.png` });
for (const [id, name] of [['#loop','loop'], ['#diff','diff'], ['#trust-panel','trust'], ['#providers','providers'], ['#versions','versions'], ['.trust','formula'], ['.cta-final','cta'], ['.footer','footer']]) {
  await page.evaluate(sel => { const el = document.querySelector(sel); el && el.scrollIntoView({ block: 'start' }); }, id);
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: `${OUT}\\t06c-${name}.png` });
}
console.log('screenshots → docs/t06c-*.png');
await browser.close();
