// T06 验证脚本：断言关键视觉规则已在渲染页面中生效
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.argv[2] || 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4000));

const probe = await page.evaluate(() => {
  const gs = (el, prop) => {
    if (!el) return null;
    return getComputedStyle(el).getPropertyValue(prop).trim();
  };
  const results = {};
  const q = sel => document.querySelector(sel);

  // 1. 画布环境光
  results.canvasBg = gs(q('.content-area'), 'background-image')?.includes('radial-gradient') || false;
  // 2. 顶栏玻璃 + 品牌发丝线
  results.topbarBg = gs(q('.topbar'), 'background-color');
  results.topbarBlur = gs(q('.topbar'), 'backdrop-filter');
  results.topbarHairline = q('.topbar') ? getComputedStyle(q('.topbar'), '::after').getPropertyValue('background-image').includes('linear-gradient') : false;
  // 3. 品牌渐变修正（不再含 #8B5CF6 紫尾）
  results.brandGradient = getComputedStyle(q('.sb-head .mark')).getPropertyValue('background-image');
  // 4. 主按钮渐变
  results.btnPrimaryBg = getComputedStyle(q('.btn-primary')).getPropertyValue('background-image');
  // 5. 发送按钮渐变
  results.sendBtnBg = q('.send-btn') ? getComputedStyle(q('.send-btn')).getPropertyValue('background-image') : null;
  // 6. tabular-nums
  const paneMeta = q('.pane-meta');
  results.tabular = paneMeta ? getComputedStyle(paneMeta).getPropertyValue('font-variant-numeric') : null;
  // 7. Diff 光谱条
  const spec = q('.diff-spectrum');
  results.spectrumH = spec ? getComputedStyle(spec).getPropertyValue('height') : null;
  // 8. 侧栏玻璃
  results.sidebarBg = gs(q('.nav-column'), 'background-color');
  // 9. 焦点环样式存在
  const styleSheets = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
  results.focusRingRule = styleSheets.includes('focus-visible') && styleSheets.includes('outline-offset: 2px');
  results.psAcceptRule = styleSheets.includes('ps-accept');
  results.wgEnterRule = styleSheets.includes('wg-enter');
  results.breatheRule = styleSheets.includes('ps-breathe');
  // 10. typing-cursor 渐变
  const tc = q('.typing-cursor');
  results.typingCursorBg = tc ? getComputedStyle(tc).getPropertyValue('background-image') : null;
  // 11. 滚动条宽度
  results.scrollbarW = getComputedStyle(document.documentElement).getPropertyValue('scrollbar-width');
  // 12. view-head
  const vh = q('.view-head');
  results.viewHead = vh ? getComputedStyle(vh).getPropertyValue('padding') : null;
  // 13. mod-log 光谱左缘
  const ml = q('.mod-log-panel');
  results.modlogSpectrum = ml ? getComputedStyle(ml, '::before').getPropertyValue('background-image').includes('linear-gradient') : null;
  // 14. 版本时间线光谱主轴
  const vi = q('.version-item');
  results.versionAxisSpectrum = vi ? getComputedStyle(vi, '::before').getPropertyValue('background-image').includes('linear-gradient') : null;

  // 15. 控制台无报错计数（页面加载期）
  return results;
});

console.log(JSON.stringify(probe, null, 2));
await browser.close();
