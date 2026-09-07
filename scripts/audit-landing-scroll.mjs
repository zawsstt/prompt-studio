// 官网完整性 + 滚动联动验证：滚动整页后所有元素必须可见；验证视差/章节指示/倾斜
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000/promptstudio.html';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu'],
});

for (const [W, H] of [[1600, 900], [1366, 768]]) {
  for (const motion of ['no-preference', 'reduce']) {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: motion }]);
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    // 滚动整页
    await page.evaluate(async () => {
      const step = () => new Promise(r => setTimeout(r, 200));
      for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await step(); }
      scrollTo(0, 0); await step();
    });
    await new Promise(r => setTimeout(r, 1200));

    const res = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const all = s => [...document.querySelectorAll(s)];
      const vis = el => {
        if (!el) return 'ABSENT';
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.05) ? 'OK' : 'HIDDEN';
      };
      const missing = [];
      const check = (name, sel) => { const v = vis(q(sel)); if (v !== 'OK') missing.push(`${name}:${v}`); };
      check('hero-eyebrow', '.hero-eyebrow');
      check('hero-h1', '#heroTitle');
      check('hero-sub', '.hero .sub');
      check('hero-actions', '.hero-actions');
      check('hero-stage', '.hero-stage');
      check('scroll-hint', '.scroll-hint');
      check('loop-h2', '#loop h2');
      check('loop-lead', '#loop .lead');
      all('.loop-step').forEach((el, i) => { if (vis(el) !== 'OK') missing.push(`loop-step${i}`); });
      check('diff-h2', '#diff h2');
      check('diff-window', '#diff .window');
      check('diff-grid', '.diff-grid');
      check('trust-h2', '#trust-panel h2');
      all('.feat-item').forEach((el, i) => { if (vis(el) !== 'OK') missing.push(`feat${i}`); });
      check('trust-window', '.hover-demo');
      check('glass-tab', '.glass-tab');
      check('lead-line', '.lead-line');
      check('providers-h2', '#providers h2');
      check('marquee', '.marquee');
      all('.step-card').forEach((el, i) => { if (vis(el) !== 'OK') missing.push(`step${i}`); });
      check('versions-h2', '#versions h2');
      all('.tl-node').forEach((el, i) => { if (vis(el) !== 'OK') missing.push(`tl${i}`); });
      check('bento', '#bento');
      check('b-ring', '.b-ring');
      check('trust-h2', '.trust h2');
      all('.f-chip').forEach((el, i) => { if (vis(el) !== 'OK') missing.push(`chip${i}`); });
      check('trust-note', '.trust .note');
      check('cta-h2', '.cta-final h2');
      check('cta-actions', '.cta-final .hero-actions');
      check('footer', '.footer');
      check('fix-box', '.fix-box');
      // ltr 字母全部可见（所有 data-ltr 元素）
      const ltrEls = all('[data-ltr]');
      const ltrHidden = ltrEls.filter(el => all('.ltr', el).some(s => parseFloat(getComputedStyle(s).opacity) < 0.9)).length;
      // 滚动联动
      const h1 = q('#heroTitle');
      const win = q('#heroWindow');
      const navOn = all('.nav-links a').filter(a => a.classList.contains('on')).length;
      const speedApplied = (h1.style.translate && h1.style.translate !== '0 0px') || h1.style.translate !== '';
      const winTilted = !!win.style.rotate || !!win.style.translate;
      const hintGone = q('.scroll-hint').classList.contains('gone');
      return {
        missing, ltrHidden, navOn, speedApplied, winTilted, hintGone,
        ltrTotal: all('.ltr').length,
      };
    });
    console.log(`[${W}x${H} · motion=${motion}] missing=${res.missing.length ? res.missing.join(',') : 'NONE'} | ltrHidden=${res.ltrHidden}/${res.ltrTotal} | navOn=${res.navOn} | speedApplied=${res.speedApplied} | winTilt=${res.winTilted} | hintGone=${res.hintGone} | pageErrors=${errs.length ? errs.join(';') : 'none'}`);
    await page.close();
  }
}
await browser.close();
