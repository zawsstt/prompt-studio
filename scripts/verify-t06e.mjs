// T06e 验证：①官网文字渲染修复（词级拆分/渐变裁剪/特殊字符）②双入口首次引导 ③交互稳定性
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errs = [];
page.on('pageerror', e => errs.push(`[pageerror] ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errs.push(`[console.error] ${m.text()}`); });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

// ══ 官网 ══
await page.goto('http://localhost:3000/promptstudio.html', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 3500));
await page.evaluate(async () => {
  const step = () => new Promise(r => setTimeout(r, 180));
  for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await step(); }
  scrollTo(0, 0);
});
await new Promise(r => setTimeout(r, 1000));

const land = await page.evaluate(async () => {
  const q = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];
  // 词级拆分验证：hero 标题里的 "Prompt" 必须是一个整词 span，且不存在单字母碎片
  const heroWords = all('#heroTitle .ltr').map(s => s.textContent);
  const promptWhole = heroWords.includes('Prompt');
  const singleLetterFrag = heroWords.some(t => /^[A-Za-z]$/.test(t));
  const partialFrag = heroWords.some(t => /^(Pr|Pro|mpt|ompt)$/.test(t));
  // 渐变字母自带裁剪（修复后应有 ltr-grad）
  const gradLtr = all('#heroTitle .ltr-grad');
  const gradBg = gradLtr.length ? getComputedStyle(gradLtr[0]).backgroundImage : null;
  const gradClip = gradLtr.length ? getComputedStyle(gradLtr[0]).webkitBackgroundClip : null;
  // 特殊字符已替换为 SVG
  const noGlyph = !document.body.textContent.includes('⌕') && !document.body.textContent.includes('⛨');
  // 字距补偿
  const h1LtrMr = gradLtr.length ? getComputedStyle(gradLtr[0]).marginRight : null;
  // 滚动联动
  const navOn = () => all('.nav-links a.on').length;
  const navs = [];
  for (const y of [1500, 2600, 3800, 5200]) { scrollTo(0, y); await new Promise(r => setTimeout(r, 350)); navs.push(navOn()); }
  scrollTo(0, 0);
  return {
    ltrTotal: all('.ltr').length,
    promptWhole, singleLetterFrag, partialFrag,
    gradLtr: gradLtr.length, gradBg: gradBg && gradBg.startsWith('linear-gradient'), gradClip,
    h1LtrMr,
    noGlyph,
    navs,
    heroVisible: all('#heroTitle .ltr').every(s => parseFloat(getComputedStyle(s).opacity) > 0.9),
  };
});
console.log('LANDING:', JSON.stringify(land, null, 1));

// 交互稳定性：hover 磁性按钮 + marquee 动画推进
await page.evaluate(() => { scrollTo(0, 0); });
const heroBtn = await page.$('.btn-primary');
await heroBtn.hover();
await new Promise(r => setTimeout(r, 400));
const inter = await page.evaluate(() => ({
  btnTranslate: getComputedStyle(document.querySelector('.btn-primary')).translate,
  marqueeRunning: getComputedStyle(document.querySelector('.marquee-track')).animationName === 'marquee',
}));
console.log('INTERACTION:', JSON.stringify(inter));

// ══ 双入口：first=1 首次引导 ══
await page.goto('http://localhost:3000/index.html?first=1', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4200));
const first = await page.evaluate(() => ({
  url: location.href,                       // 参数应已被 replaceState 清除
  onboarding: !!document.querySelector('.ob-steps'),           // OnboardingModal
  welcome: !!document.querySelector('.welcome-guide'),          // WelcomeGuide
  welcomeTitle: document.querySelector('.wg-title')?.textContent || null,
  chatEmpty: !!document.querySelector('.chat-empty'),          // 对话空态
  chatMsgCount: document.querySelectorAll('.chat-message').length,
  docIndicator: document.querySelector('.doc-indicator')?.textContent || null,
}));
console.log('FIRST-ENTRY:', JSON.stringify(first, null, 1));

// ══ 双入口：有历史数据的用户 → 无参数进入应恢复历史形态（对照验证） ══
// 先在无痕 profile 中制造「老用户」状态：完成 onboarding + 有过编辑记录
await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4000));
await page.evaluate(() => {
  /* 真实 key 见 useStore.ts：promptstudio:onboarded / promptstudio:lastEditingFile */
  localStorage.setItem('promptstudio:onboarded', '1');
  localStorage.setItem('promptstudio:lastEditingFile', JSON.stringify({ path: null }));
});
await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 4200));
const normal = await page.evaluate(() => ({
  onboarding: !!document.querySelector('.ob-steps'),
  welcome: !!document.querySelector('.welcome-guide'),
  chatEmpty: !!document.querySelector('.chat-empty'),
  docIndicator: document.querySelector('.doc-indicator')?.textContent || null,
}));
console.log('NORMAL-ENTRY(returning-user):', JSON.stringify(normal, null, 1));

console.log('pageErrors:', errs.length ? errs : 'none');
await browser.close();
