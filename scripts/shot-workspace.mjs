// 截图工作区页面（含文件树 + 范围卡片）
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-first-run', '--disable-gpu', '--window-size=1366,768'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1366, height: 768 });
page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));

await page.evaluate(async () => {
  const m = await import('/src/store/useStore.ts');
  const s = m.useStore.getState();
  s.createScope('核心业务逻辑', '主文档模块范围', s.parseDocumentModules());
  await s.importFile(new File(['## 根模块\n内容'], 'api-client.md', { type: 'text/markdown' }));
  const f1 = new File(['## 数据模型\n内容'], 'models.ts.md', { type: 'text/markdown' });
  Object.defineProperty(f1, 'webkitRelativePath', { value: 'src/models.ts.md' });
  await s.importFile(f1);
  const f2 = new File(['## 工具函数\n内容'], 'utils.ts.md', { type: 'text/markdown' });
  Object.defineProperty(f2, 'webkitRelativePath', { value: 'src/utils.ts.md' });
  await s.importFile(f2);
  const f3 = new File(['## 指标定义\n内容'], 'fields.md', { type: 'text/markdown' });
  Object.defineProperty(f3, 'webkitRelativePath', { value: 'references/fields.md' });
  await s.importFile(f3);
  m.useStore.setState({ activeView: 'workspace' });
});
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: 'D:\\Users\\ex_xiejr5\\Desktop\\DIFF_prompt - 副本\\docs\\workspace-final.png' });
console.log('saved');
await browser.close();
