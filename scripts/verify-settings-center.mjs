// 设置中心 + 模型输入 + 顶栏速切 验收：
// - 设置分「模型与连接 / 数据与隐私 / 关于」，不再是顶栏胶囊的重复入口
// - 自定义模型名真的能输入、保存、回显
// - 顶栏胶囊是轻量速切面板，点模型立即生效
// - 供应商已更新，Ollama 换成智谱 GLM
//
//   node scripts/verify-settings-center.mjs

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

const openSettings = async () => {
  await page.evaluate(() => document.querySelector('.nav-group-bottom .nav-item')?.click());
  await sleep(600);
};
const closeSettings = async () => {
  await page.evaluate(() => document.querySelector('.settings-header button')?.click());
  await sleep(350);
};
const clickSection = async (label) => {
  await page.evaluate((text) => {
    const item = [...document.querySelectorAll('.settings-nav-item')]
      .find(n => (n.textContent || '').includes(text));
    item?.click();
  }, label);
  await sleep(300);
};
const modelProbe = () => page.evaluate(() => {
  const select = document.querySelector('.settings-form-group select.inp');
  const input = document.querySelector('input[aria-label="自定义模型名"]');
  const rect = input?.getBoundingClientRect();
  return {
    selectValue: select?.value ?? null,
    selectText: select ? (select.selectedOptions[0]?.textContent ?? '') : null,
    hasInput: !!input,
    inputVisible: !!input && !!rect && rect.width > 0 && rect.height > 0,
    inputValue: input?.value ?? null,
    saved: JSON.parse(localStorage.getItem('ps_model_config') || 'null'),
  };
});
const setSelect = value => page.evaluate((v) => {
  const select = document.querySelector('.settings-form-group select.inp');
  if (!select) return false;
  select.value = v;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, value);
const clickProvider = name => page.evaluate((n) => {
  const card = [...document.querySelectorAll('.provider-card')]
    .find(c => c.querySelector('.pc-name')?.textContent?.trim() === n);
  if (!card) return false;
  card.click();
  return true;
}, name);
const saveSettings = () => page.evaluate(() => {
  const btn = [...document.querySelectorAll('.settings-footer button')]
    .find(b => (b.textContent || '').includes('保存设置'));
  btn?.click();
});

try {
  console.log('\n[1] 设置中心：分类导航');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem('promptstudio:onboarded', '1');
    localStorage.setItem('promptstudio:lastEditingFile', JSON.stringify({ path: null }));
    ['editor', 'chat', 'workspace', 'eval', 'history', 'ruleset', 'diff']
      .forEach(id => localStorage.setItem(`promptstudio:tour:${id}`, '1'));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2800);
  await openSettings();

  const nav = await page.evaluate(() => ({
    sections: [...document.querySelectorAll('.settings-nav-item')].map(n => n.textContent.replace(/\s+/g, ' ').trim()),
    active: document.querySelector('.settings-nav-item.on')?.textContent?.replace(/\s+/g, ' ').trim(),
    width: Math.round(document.querySelector('.settings-dialog')?.getBoundingClientRect().width ?? 0),
  }));
  check('四个分区：模型与连接 / 外观 / 数据与隐私 / 关于',
    nav.sections.length === 4 &&
    nav.sections[0].includes('模型与连接') &&
    nav.sections[1].includes('外观') &&
    nav.sections[2].includes('数据与隐私') &&
    nav.sections[3].includes('关于'),
    JSON.stringify(nav));
  check('默认打开模型与连接', (nav.active ?? '').includes('模型与连接'), nav.active ?? null);
  check('设置改成宽面板（左导航 + 内容）', nav.width >= 800, String(nav.width));

  await clickSection('外观');
  const appearance = await page.evaluate(() => ({
    head: document.querySelector('.settings-section-head h3')?.textContent?.trim(),
    modes: document.querySelectorAll('.theme-seg button').length,
    styles: document.querySelectorAll('.toolbar-style-card').length,
    preview: !!document.querySelector('.st-toolbar-inline'),
  }));
  check('外观分区：3 种明暗 + 3 种材质 + 预览',
    appearance.head === '外观' && appearance.modes === 3 && appearance.styles === 3 && appearance.preview,
    JSON.stringify(appearance));

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.theme-seg button')]
      .find(b => (b.textContent || '').includes('深色'));
    btn?.click();
  });
  await sleep(400);
  const dark = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    dialogBg: getComputedStyle(document.querySelector('.settings-dialog')).backgroundColor,
    saved: localStorage.getItem('promptstudio:themeMode'),
  }));
  check('深色模式立即生效并持久化',
    dark.theme === 'dark' && dark.dialogBg === 'rgb(21, 26, 35)' && dark.saved === 'dark',
    JSON.stringify(dark));

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.toolbar-style-card')]
      .find(b => (b.textContent || '').includes('液态玻璃'));
    btn?.click();
  });
  await sleep(400);
  const liquid = await page.evaluate(() => ({
    toolbar: document.documentElement.dataset.toolbar,
    blur: getComputedStyle(document.querySelector('.appearance-stage .st-toolbar')).backdropFilter,
    saved: localStorage.getItem('promptstudio:toolbarStyle'),
  }));
  check('液态玻璃材质生效并持久化',
    liquid.toolbar === 'liquid' && (liquid.blur ?? '').includes('blur') && liquid.saved === 'liquid',
    JSON.stringify(liquid));
  await page.screenshot({ path: `${OUT}\\settings-appearance-dark.png` });

  // 回到浅色 + 磨砂，后续截图保持蓝白口径
  await page.evaluate(() => {
    const light = [...document.querySelectorAll('.theme-seg button')]
      .find(b => (b.textContent || '').includes('浅色'));
    light?.click();
    const frosted = [...document.querySelectorAll('.toolbar-style-card')]
      .find(b => (b.textContent || '').includes('磨砂'));
    frosted?.click();
  });
  await sleep(350);
  check('可切回浅色 / 磨砂',
    await page.evaluate(() => document.documentElement.dataset.theme === 'light' && document.documentElement.dataset.toolbar === 'frosted'));

  await clickSection('数据与隐私');
  const privacy = await page.evaluate(() => ({
    head: document.querySelector('.settings-section-head h3')?.textContent?.trim(),
    reset: [...document.querySelectorAll('.settings-danger-zone button')]
      .some(b => (b.textContent || '').includes('重置全部数据')),
    dataRows: document.querySelectorAll('.settings-data-list li').length,
  }));
  check('数据与隐私分区', privacy.head === '数据与隐私' && privacy.reset && privacy.dataRows === 3, JSON.stringify(privacy));
  await page.screenshot({ path: `${OUT}\\settings-center-privacy.png` });

  await clickSection('关于');
  const about = await page.evaluate(() => ({
    head: document.querySelector('.settings-section-head h3')?.textContent?.trim(),
    version: document.querySelector('.settings-about-grid b')?.textContent?.trim(),
    footer: document.querySelector('.settings-footer button')?.textContent?.trim(),
    tours: document.querySelectorAll('.settings-tour-row').length,
  }));
  check('关于分区显示版本与快捷键',
    (about.head ?? '').includes('关于 PromptStudio') && about.version === 'v0.1.0' && about.footer === '完成',
    JSON.stringify(about));
  check('关于页列出 7 个功能引导重播入口', about.tours === 7, String(about.tours));
  await page.screenshot({ path: `${OUT}\\settings-center-about.png` });

  await clickSection('模型与连接');
  const initial = await modelProbe();
  check('默认使用新的预设模型 deepseek-flash',
    initial.selectValue === 'deepseek-flash' && !initial.hasInput,
    JSON.stringify(initial));

  console.log('\n[2] 自定义模型名：能输入、能保存、能回显');
  check('选择「自定义模型名…」', await setSelect('__custom__'));
  await sleep(350);
  const custom = await modelProbe();
  check('出现可输入的模型名输入框', custom.inputVisible && custom.hasInput, JSON.stringify(custom));
  check('下拉框显示「自定义模型名…」', custom.selectText === '自定义模型名…', custom.selectText ?? 'null');

  await page.click('input[aria-label="自定义模型名"]', { clickCount: 3 });
  await page.type('input[aria-label="自定义模型名"]', 'my-custom-model-v9', { delay: 10 });
  await sleep(350);
  const typed = await modelProbe();
  check('输入的值进入状态', typed.inputValue === 'my-custom-model-v9', typed.inputValue ?? 'null');

  check('点已选中的 DeepSeek 卡片不会重置输入', await clickProvider('DeepSeek'));
  await sleep(300);
  const afterProviderClick = await modelProbe();
  check('自定义模型名保留', afterProviderClick.inputValue === 'my-custom-model-v9', JSON.stringify(afterProviderClick));

  await page.evaluate(() => document.querySelector('.settings-dialog')?.scrollIntoView({ block: 'start' }));
  await sleep(200);
  await page.screenshot({ path: `${OUT}\\settings-center-models.png` });

  await saveSettings();
  await sleep(700);
  check('保存后关闭设置页', await page.evaluate(() => !document.querySelector('.settings-overlay')));
  await openSettings();
  const reopened = await modelProbe();
  check('重开后回显自定义模型名', reopened.inputVisible && reopened.inputValue === 'my-custom-model-v9', JSON.stringify(reopened));
  check('模型名已持久化到配置', reopened.saved?.modelName === 'my-custom-model-v9', JSON.stringify(reopened.saved));

  console.log('\n[3] 空模型名拦截');
  await page.click('input[aria-label="自定义模型名"]', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await sleep(250);
  await saveSettings();
  await sleep(600);
  const blocked = await page.evaluate(() => ({
    stillOpen: !!document.querySelector('.settings-overlay'),
    message: document.querySelector('.settings-form-group .test-result.error')?.textContent?.trim(),
  }));
  check('空模型名不会保存关闭', blocked.stillOpen, JSON.stringify(blocked));
  check('给出明确提示', (blocked.message ?? '').includes('请先选择或输入模型名称'), blocked.message ?? 'null');

  check('选回预设模型', await setSelect('deepseek-v4-pro'));
  await sleep(350);
  const preset = await modelProbe();
  check('预设模型下隐藏输入框', !preset.hasInput && preset.selectValue === 'deepseek-v4-pro', JSON.stringify(preset));

  console.log('\n[4] 顶栏胶囊：轻量速切，不再重复设置弹窗');
  await closeSettings();
  await page.evaluate(() => document.querySelector('.model-pill')?.click());
  await sleep(600);
  const quick = await page.evaluate(() => ({
    menu: !!document.querySelector('.mq-menu'),
    settings: !!document.querySelector('.settings-overlay'),
    providers: [...document.querySelectorAll('.mq-provider-name')].map(n => n.textContent.trim()),
    models: [...document.querySelectorAll('.mq-model-name')].map(n => n.textContent.trim()),
    current: document.querySelector('.mq-current-main')?.textContent?.replace(/\s+/g, ' ').trim(),
  }));
  check('打开的是速切面板而非设置弹窗', quick.menu && !quick.settings, JSON.stringify(quick));
  check('供应商已更新：智谱 GLM 在列、Ollama 已移除',
    quick.providers.includes('智谱 (GLM)') && !quick.providers.some(p => p.includes('Ollama')),
    quick.providers.join(' | '));
  check('速切面板列出当前供应商模型',
    quick.models.includes('deepseek-flash') && quick.models.includes('deepseek-v4-pro'),
    quick.models.join(' | '));
  check('面板显示当前模型', (quick.current ?? '').includes('deepseek-v4-pro'), quick.current ?? null);

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.mq-model')]
      .find(b => (b.textContent || '').includes('deepseek-flash'));
    btn?.click();
  });
  await sleep(700);
  const afterSwitch = await page.evaluate(() => ({
    pill: document.querySelector('.model-pill .mn')?.textContent?.trim(),
    menu: !!document.querySelector('.mq-menu'),
    saved: JSON.parse(localStorage.getItem('ps_model_config') || 'null'),
  }));
  check('点模型立即切换并持久化',
    afterSwitch.pill === 'deepseek-flash' && !afterSwitch.menu && afterSwitch.saved?.modelName === 'deepseek-flash',
    JSON.stringify(afterSwitch));

  await page.evaluate(() => document.querySelector('.model-pill')?.click());
  await sleep(500);
  check('面板内可进入完整设置', await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.mq-foot button')]
      .find(b => (b.textContent || '').includes('模型与连接设置'));
    btn?.click();
    return true;
  }));
  await sleep(700);
  check('进入设置且停留在模型与连接',
    await page.evaluate(() => {
      const active = document.querySelector('.settings-nav-item.on')?.textContent || '';
      return !!document.querySelector('.settings-overlay') && active.includes('模型与连接');
    }));

  console.log('\n[5] 自定义供应商只有输入框');
  check('切换到自定义供应商', await clickProvider('自定义 (OpenAI 兼容)'));
  await sleep(400);
  const customProvider = await modelProbe();
  check('没有下拉框、只有输入框',
    customProvider.selectValue === null && customProvider.hasInput && customProvider.inputVisible,
    JSON.stringify(customProvider));

  await closeSettings();
  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
