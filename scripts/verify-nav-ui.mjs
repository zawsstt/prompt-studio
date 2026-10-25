// 导航对齐 / 无横向滚动条 / 智谱 logo / 顶栏速切面板 验收
//
//   node scripts/verify-nav-ui.mjs

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

const navMetrics = () => page.evaluate(() => {
  const items = [...document.querySelectorAll('.nav-group .nav-item')];
  const icons = items.map(item => item.querySelector('.nav-icon')).filter(Boolean);
  const rects = icons.map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      center: r.left + r.width / 2,
      top: r.top + r.height / 2,
      display: cs.display,
      opacity: cs.opacity,
      color: cs.color,
    };
  });
  const centers = rects.map(r => Math.round(r.center * 10) / 10);
  const group = document.querySelector('.nav-group');
  const column = document.querySelector('.nav-column');
  const hit = document.elementFromPoint(27.5, 153);
  return {
    count: items.length,
    centers,
    tops: rects.map(r => Math.round(r.top)),
    displays: rects.map(r => r.display),
    opacities: rects.map(r => r.opacity),
    colors: rects.map(r => r.color),
    svgColor: icons[0] ? getComputedStyle(icons[0].querySelector('svg')).color : null,
    svgStroke: icons[0] ? getComputedStyle(icons[0].querySelector('svg')).stroke : null,
    svgFill: icons[0] ? getComputedStyle(icons[0].querySelector('svg')).fill : null,
    svgRect: icons[0] ? (()=>{const r=icons[0].querySelector('svg').getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];})() : null,
    itemColor: items[0] ? getComputedStyle(items[0]).color : null,
    groupBg: getComputedStyle(group).backgroundColor,
    columnBg: getComputedStyle(column).backgroundColor,
    groupVisibility: getComputedStyle(group).visibility,
    itemVisibility: items[0] ? getComputedStyle(items[0]).visibility : null,
    iconVisibility: icons[0] ? getComputedStyle(icons[0]).visibility : null,
    hit: hit ? `${hit.tagName}.${hit.className}` : null,
    bodyClass: document.body.className,
    onboarding: !!document.querySelector('.onboarding-modal, .onboarding-overlay, .welcome-guide'),
    spread: centers.length ? Math.max(...centers) - Math.min(...centers) : 0,
    groupScrollW: group.scrollWidth,
    groupClientW: group.clientWidth,
    groupOverflowX: group.scrollWidth > group.clientWidth + 1,
    columnScrollW: column.scrollWidth,
    columnClientW: column.clientWidth,
    columnWidth: Math.round(column.getBoundingClientRect().width),
  };
});

try {
  console.log('\n[1] 折叠态：图标对齐 + 无横向滚动条');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem('promptstudio:onboarded', '1');
    localStorage.setItem('promptstudio:lastEditingFile', JSON.stringify({ path: null }));
    ['editor', 'chat', 'workspace', 'eval', 'history', 'ruleset', 'diff']
      .forEach(id => localStorage.setItem(`promptstudio:tour:${id}`, '1'));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2800);

  const collapsed = await navMetrics();
  console.log('  metrics:', JSON.stringify(collapsed));
  check('导航图标横向对齐（误差 ≤1px）', collapsed.spread <= 1, JSON.stringify(collapsed.centers));
  check('导航区没有横向溢出', !collapsed.groupOverflowX, JSON.stringify(collapsed));
  check('侧栏保持 56px 收缩态', collapsed.columnWidth === 56, String(collapsed.columnWidth));
  check('导航图标可见', collapsed.displays.every(d => d !== 'none') && collapsed.opacities.every(o => o !== '0'), JSON.stringify(collapsed));
  await page.screenshot({ path: `${OUT}\\nav-full.png` });

  console.log('\n[2] 悬停展开态：仍无横向滚动条');
  await page.hover('.nav-column');
  await sleep(500);
  const expanded = await navMetrics();
  check('展开后图标仍对齐', expanded.spread <= 1, JSON.stringify(expanded.centers));
  check('展开后无横向溢出', !expanded.groupOverflowX, JSON.stringify(expanded));
  check('展开宽度符合预期', expanded.columnWidth > 200, String(expanded.columnWidth));
  await page.screenshot({ path: `${OUT}\\nav-expanded.png`, clip: { x: 0, y: 0, width: 252, height: 900 } });

  console.log('\n[3] 智谱 GLM 供应商');
  await page.evaluate(() => document.querySelector('.nav-group-bottom .nav-item')?.click());
  await sleep(600);
  const zhipu = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.provider-card')]
      .find(c => (c.querySelector('.pc-name')?.textContent || '').includes('智谱'));
    const img = card?.querySelector('img');
    return {
      exists: !!card,
      name: card?.querySelector('.pc-name')?.textContent?.trim() ?? null,
      desc: card?.querySelector('.pc-desc')?.textContent?.trim() ?? null,
      logoLoaded: !!img && img.complete && img.naturalWidth > 0,
      logoSrc: img?.getAttribute('src') ?? null,
      hasOllama: [...document.querySelectorAll('.pc-name')].some(n => n.textContent.includes('Ollama')),
    };
  });
  check('供应商卡片里有智谱 (GLM)', zhipu.exists && zhipu.name === '智谱 (GLM)', JSON.stringify(zhipu));
  check('智谱 logo 成功加载', zhipu.logoLoaded, zhipu.logoSrc ?? 'no img');
  check('默认模型已更新为 GLM-5.3 系列', (zhipu.desc ?? '').includes('glm-5.3'), zhipu.desc ?? '');
  check('Ollama 已移除', !zhipu.hasOllama, JSON.stringify(zhipu));

  await page.evaluate(() => document.querySelector('.settings-header button')?.click());
  await sleep(350);

  console.log('\n[4] 顶栏速切面板');
  await page.evaluate(() => document.querySelector('.model-pill')?.click());
  await sleep(700);
  const quick = await page.evaluate(() => {
    const menu = document.querySelector('.mq-menu');
    const z = [...document.querySelectorAll('.mq-provider')]
      .find(b => (b.textContent || '').includes('智谱'));
    const img = z?.querySelector('img');
    return {
      open: !!menu,
      settingsOpen: !!document.querySelector('.settings-overlay'),
      providers: [...document.querySelectorAll('.mq-provider-name')].map(n => n.textContent.trim()),
      zhipuLogo: !!img && img.complete && img.naturalWidth > 0,
      models: [...document.querySelectorAll('.mq-model-name')].map(n => n.textContent.trim()),
      menuRect: menu ? { w: Math.round(menu.getBoundingClientRect().width), h: Math.round(menu.getBoundingClientRect().height) } : null,
    };
  });
  check('胶囊打开速切面板（非设置弹窗）', quick.open && !quick.settingsOpen, JSON.stringify(quick));
  check('速切面板含智谱 logo', quick.zhipuLogo, JSON.stringify(quick.providers));
  check('速切面板列出当前模型', quick.models.length > 0, quick.models.join(' | '));
  check('面板尺寸合理', (quick.menuRect?.w ?? 0) >= 320 && (quick.menuRect?.h ?? 0) > 240, JSON.stringify(quick.menuRect));

  await page.screenshot({ path: `${OUT}\\model-quick-menu.png` });

  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
