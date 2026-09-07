// 官网元素普查：每个区块的关键元素是否真实可见（rect/opacity/内容）
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000/promptstudio.html';
const W = parseInt(process.argv[2] || '1600', 10);
const H = parseInt(process.argv[3] || '900', 10);

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 5000));

const audit = await page.evaluate(() => {
  const checks = [
    ['hero-eyebrow', '.hero-eyebrow'],
    ['hero-h1', '#heroTitle'],
    ['hero-sub', '.hero .sub'],
    ['hero-actions', '.hero-actions'],
    ['hero-stage', '.hero-stage'],
    ['hero-window', '#heroWindow'],
    ['scroll-hint', '.scroll-hint'],
    ['nav', '.nav'],
    ['nav-links', '.nav-links'],
    ['loop-h2', '#loop h2'],
    ['loop-lead', '#loop .lead'],
    ['loop-steps', '.loop-step'],
    ['diff-h2', '#diff h2'],
    ['diff-window', '#diff .window'],
    ['diff-grid', '.diff-grid'],
    ['trust-h2', '#trust-panel h2'],
    ['trust-feats', '.feat-item'],
    ['trust-window', '.hover-demo'],
    ['glass-tab', '.glass-tab'],
    ['lead-line', '.lead-line'],
    ['providers-h2', '#providers h2'],
    ['marquee', '.marquee'],
    ['prov-chips', '.prov'],
    ['step-cards', '.step-card'],
    ['versions-h2', '#versions h2'],
    ['tl-nodes', '.tl-node'],
    ['bento', '#bento'],
    ['b-m-cells', '.b-m'],
    ['b-ring', '.b-ring'],
    ['trust-h2', '.trust h2'],
    ['formula-chips', '.f-chip'],
    ['trust-note', '.trust .note'],
    ['cta-h2', '.cta-final h2'],
    ['cta-actions', '.cta-final .hero-actions'],
    ['footer', '.footer'],
    ['fix-box', '.fix-box'],
  ];
  const out = {};
  for (const [name, sel] of checks) {
    const els = [...document.querySelectorAll(sel)];
    out[name] = els.map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        n: el.children.length || (el.textContent || '').trim().length,
        visible: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05,
        rect: [Math.round(r.width), Math.round(r.height)],
      };
    });
  }
  // 巨型标题是否真的有字
  const h1 = document.querySelector('#heroTitle');
  out.heroH1TextLen = h1 ? h1.textContent.replace(/\s/g, '').length : -1;
  out.heroH1LtrCount = document.querySelectorAll('#heroTitle .ltr').length;
  const h1Rect = h1 ? h1.getBoundingClientRect() : null;
  out.heroH1Rect = h1Rect ? [Math.round(h1Rect.width), Math.round(h1Rect.height)] : null;
  return out;
});

console.log(`viewport ${W}x${H}`);
console.log(JSON.stringify(audit, null, 1));
await browser.close();
