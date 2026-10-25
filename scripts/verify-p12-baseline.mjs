// P1-2 回归基线：真实浏览器验收（生产构建，直写 IndexedDB 造历史版本与运行记录）
//
//   node scripts/verify-p12-baseline.mjs
//
// 验证点：
// 1. 版本时间线出现分数曲线（v1 50 → v2 100 → v3 75）与涨跌标记
// 2. 打开历史运行后，评测页出现「回归基线 v2 100 分 → v3 75 分」
// 3. 点击退化用例能展开失败断言 + 疑似 changeBlock（含命中依据）
// 4. 全流程 0 条 console 错误

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

const CASES = [
  {
    id: 'case-1', name: '明确结论 + 禁止模糊词', input: '退款多久到账？', vars: {},
    asserts: [
      { id: 'as-1', type: 'contains', value: '工作日' },
      { id: 'as-2', type: 'not-contains', value: '大概' },
    ],
  },
  {
    id: 'case-2', name: '结构化输出', input: '用 JSON 返回 answer', vars: {},
    asserts: [{ id: 'as-3', type: 'json-valid', value: 'answer' }],
  },
  {
    id: 'case-3', name: '语气一致', input: '介绍一下服务', vars: {},
    asserts: [{ id: 'as-4', type: 'llm-rubric', value: '语气专业、不推销', threshold: 0.7 }],
  },
  {
    id: 'case-4', name: '响应速度', input: '退款多久到账？', vars: {},
    asserts: [{ id: 'as-5', type: 'max-latency', value: '20000' }],
  },
];

const now = Date.now();
const versionRecords = (v1Id, v1Content) => [
  {
    id: 'ver-p12-v2', docId: 'doc-default', versionNumber: 2, label: 'v2',
    content: `${v1Content}\n\n> v2 调整：补充时效说明与禁用模糊词。`,
    parentId: v1Id, note: 'AI 修改（接受 2/2）', createdAt: now - 7200_000, summaryStatus: 'none',
    changeBlocks: [
      {
        id: 'cb-v2-1', type: 'replaced', oldStartLine: 10, oldEndLine: 12, newStartLine: 10, newEndLine: 12,
        oldSnippet: '回答退款问题。', newSnippet: '退款到账时间需说明「7 个工作日」内的处理时效。',
        accepted: true,
        explanation: { why: '补充时效信息', how: '加入工作日说明', effect: '回答更具体' },
        versionFrom: 'v1', versionTo: 'v2',
      },
      {
        id: 'cb-v2-2', type: 'added', oldStartLine: 0, oldEndLine: 0, newStartLine: 13, newEndLine: 13,
        oldSnippet: '', newSnippet: '禁止使用模糊限定词（大概、可能）。',
        accepted: true,
        explanation: { why: '避免模糊表达', how: '新增禁用词约束', effect: '回答更确定' },
        versionFrom: 'v1', versionTo: 'v2',
      },
    ],
  },
  {
    id: 'ver-p12-v3', docId: 'doc-default', versionNumber: 3, label: 'v3',
    content: `${v1Content}\n\n> v3 调整：压缩长度，先给结论。`,
    parentId: 'ver-p12-v2', note: 'AI 修改（接受 3/3）', createdAt: now - 3600_000, summaryStatus: 'none',
    changeBlocks: [
      {
        id: 'cb-v3-1', type: 'replaced', oldStartLine: 10, oldEndLine: 12, newStartLine: 10, newEndLine: 11,
        oldSnippet: '退款到账时间需说明「7 个工作日」内的处理时效。',
        newSnippet: '直接给出处理结论，不展开时效细节。',
        accepted: true,
        explanation: { why: '压缩长度，先给结论', how: '删掉时效描述', effect: '回答更短，但可能丢失关键信息' },
        versionFrom: 'v2', versionTo: 'v3',
      },
      {
        id: 'cb-v3-2', type: 'replaced', oldStartLine: 13, oldEndLine: 13, newStartLine: 12, newEndLine: 12,
        oldSnippet: '禁止使用模糊限定词（大概、可能）。', newSnippet: '语气保持自然。',
        accepted: true,
        explanation: { why: '精简语气约束', how: '删掉禁用词清单', effect: '表达更自由' },
        versionFrom: 'v2', versionTo: 'v3',
      },
      {
        id: 'cb-v3-3', type: 'replaced', oldStartLine: 20, oldEndLine: 20, newStartLine: 19, newEndLine: 19,
        oldSnippet: '### 示例标题', newSnippet: '### 示例小标题',
        accepted: true,
        explanation: { why: '层级更清楚', how: '调整标题措辞', effect: '无行为变化' },
        versionFrom: 'v2', versionTo: 'v3',
      },
    ],
  },
];

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  protocolTimeout: 120000,
  args: ['--no-first-run', '--disable-gpu', '--window-size=1600,1000'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`));
page.on('dialog', dialog => { dialog.accept().catch(() => {}); });

const clickByText = (text, selector = 'button') => page.evaluate((t, sc) => {
  const el = [...document.querySelectorAll(sc)].find(e => (e.textContent || '').trim().includes(t));
  if (!el) return false;
  el.click();
  return true;
}, text, selector);

try {
  console.log('\n[1] 首次加载（生产构建）');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(3500);

  const v1 = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('PromptStudioDB');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = await new Promise((resolve, reject) => {
      const req = db.transaction('versions').objectStore('versions').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.find(v => v.versionNumber === 1) ?? null;
  });
  check('初始化生成 v1 版本', !!v1?.id, JSON.stringify(v1?.id));

  console.log('\n[2] 造数据：v2 / v3 + 三次运行（50 → 100 → 75）');
  await page.evaluate(({ cases, versions, v1Content }) => {
    localStorage.setItem('promptstudio:evalCases', JSON.stringify(cases));
    localStorage.setItem('promptstudio:evalPromptRole', 'system');
    localStorage.setItem('promptstudio:onboarded', '1');
    localStorage.setItem('promptstudio:lastEditingFile', JSON.stringify({ path: null }));
    ['editor', 'chat', 'workspace', 'eval', 'history', 'ruleset', 'diff']
      .forEach(id => localStorage.setItem(`promptstudio:tour:${id}`, '1'));
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('PromptStudioDB');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['versions', 'evalRuns'], 'readwrite');
        versions.forEach(v => tx.objectStore('versions').put({ ...v, content: v.content || v1Content }));
        [
          {
            id: 'run-p12-v1', docId: 'doc-default', docName: 'untitled-prompt.md', providerId: 'deepseek',
            modelName: 'deepseek-chat', promptRole: 'system', promptSnapshot: v1Content,
            createdAt: Date.now() - 5400_000, durationMs: 6100, total: 4, passed: 2,
            versionId: versions[0].parentId ?? 'ver-v1', versionLabel: 'v1', versionNumber: 1, score: 50,
            cases: [
              { caseId: 'case-1', caseName: '明确结论 + 禁止模糊词', output: '7 个工作日内到账。', assertions: [], passed: true, durationMs: 1400, tokensEst: 110, costEst: 0.0002 },
              { caseId: 'case-2', caseName: '结构化输出', output: '不是 JSON', assertions: [{ assertionId: 'as-3', type: 'json-valid', passed: false, detail: '输出中找不到可解析的 JSON' }], passed: false, durationMs: 1100, tokensEst: 90, costEst: 0.0002 },
              { caseId: 'case-3', caseName: '语气一致', output: '很专业。', assertions: [], passed: true, durationMs: 900, tokensEst: 80, costEst: 0.0001 },
              { caseId: 'case-4', caseName: '响应速度', output: '7 个工作日内到账。', assertions: [{ assertionId: 'as-5', type: 'max-latency', passed: false, detail: '24000ms 超出 20000ms' }], passed: false, durationMs: 24000, tokensEst: 100, costEst: 0.0002 },
            ],
          },
          {
            id: 'run-p12-v2', docId: 'doc-default', docName: 'untitled-prompt.md', providerId: 'deepseek',
            modelName: 'deepseek-chat', promptRole: 'system', promptSnapshot: versions[0].content,
            createdAt: Date.now() - 3600_000, durationMs: 4800, total: 4, passed: 4,
            versionId: versions[0].id, versionLabel: 'v2', versionNumber: 2, score: 100,
            dataset: cases,
            cases: [
              { caseId: 'case-1', caseName: '明确结论 + 禁止模糊词', output: '结论：7 个工作日内到账。', assertions: [{ assertionId: 'as-1', type: 'contains', passed: true, detail: '已包含「工作日」' }, { assertionId: 'as-2', type: 'not-contains', passed: true, detail: '未出现「大概」' }], passed: true, durationMs: 1200, tokensEst: 120, costEst: 0.0002 },
              { caseId: 'case-2', caseName: '结构化输出', output: '{"answer":"7 个工作日"}', assertions: [{ assertionId: 'as-3', type: 'json-valid', passed: true, detail: 'JSON 合法，1 个字段齐全' }], passed: true, durationMs: 1300, tokensEst: 130, costEst: 0.0002 },
              { caseId: 'case-3', caseName: '语气一致', output: '我们会在 7 个工作日内处理。', assertions: [{ assertionId: 'as-4', type: 'llm-rubric', passed: true, score: 0.9, detail: '0.90 ≥ 0.7 · 语气专业' }], passed: true, durationMs: 1500, tokensEst: 140, costEst: 0.0003 },
              { caseId: 'case-4', caseName: '响应速度', output: '7 个工作日内到账。', assertions: [{ assertionId: 'as-5', type: 'max-latency', passed: true, detail: '1200ms ≤ 20000ms' }], passed: true, durationMs: 1200, tokensEst: 100, costEst: 0.0002 },
            ],
          },
          {
            id: 'run-p12-v3b', docId: 'doc-default', docName: 'untitled-prompt.md', providerId: 'deepseek',
            modelName: 'deepseek-chat', promptRole: 'system', promptSnapshot: versions[1].content,
            createdAt: Date.now() - 2400_000, durationMs: 4600, total: 5, passed: 4,
            versionId: versions[1].id, versionLabel: 'v3', versionNumber: 3, score: 80,
            dataset: (() => {
              const ds = JSON.parse(JSON.stringify(cases));
              // 改一条断言、加一条用例：演示「用例集变了，分数不能直接比」
              ds[2] = { ...ds[2], asserts: ds[2].asserts.map(a => ({ ...a, threshold: 0.9 })) };
              ds.push({
                id: 'case-5', name: '到账通知', input: '退款到账后如何通知？', vars: {},
                asserts: [{ id: 'as-6', type: 'contains', value: '短信' }],
              });
              return ds;
            })(),
            cases: [
              { caseId: 'case-1', caseName: '明确结论 + 禁止模糊词', output: '结论：大概 7 天左右会到账。', assertions: [
                { assertionId: 'as-1', type: 'contains', passed: false, detail: '未找到「工作日」' },
                { assertionId: 'as-2', type: 'not-contains', passed: false, detail: '出现了不该有的「大概」' },
              ], passed: false, durationMs: 1100, tokensEst: 118, costEst: 0.0002 },
              { caseId: 'case-2', caseName: '结构化输出', output: '{"answer":"7 个工作日"}', assertions: [{ assertionId: 'as-3', type: 'json-valid', passed: true, detail: 'JSON 合法，1 个字段齐全' }], passed: true, durationMs: 1200, tokensEst: 128, costEst: 0.0002 },
              { caseId: 'case-3', caseName: '语气一致', output: '会尽快为您处理。', assertions: [{ assertionId: 'as-4', type: 'llm-rubric', passed: true, score: 0.85, detail: '0.85 ≥ 0.9 · 语气专业' }], passed: true, durationMs: 1000, tokensEst: 96, costEst: 0.0002 },
              { caseId: 'case-4', caseName: '响应速度', output: '结论：大概 7 天。', assertions: [{ assertionId: 'as-5', type: 'max-latency', passed: true, detail: '1050ms ≤ 20000ms' }], passed: true, durationMs: 1050, tokensEst: 88, costEst: 0.0001 },
              { caseId: 'case-5', caseName: '到账通知', output: '到账后会通过短信通知您。', assertions: [{ assertionId: 'as-6', type: 'contains', passed: true, detail: '已包含「短信」' }], passed: true, durationMs: 980, tokensEst: 92, costEst: 0.0001 },
            ],
          },
          {
            id: 'run-p12-v3', docId: 'doc-default', docName: 'untitled-prompt.md', providerId: 'deepseek',
            modelName: 'deepseek-chat', promptRole: 'system', promptSnapshot: versions[1].content,
            createdAt: Date.now() - 1200_000, durationMs: 4400, total: 4, passed: 3,
            versionId: versions[1].id, versionLabel: 'v3', versionNumber: 3, score: 75,
            dataset: cases,
            cases: [
              { caseId: 'case-1', caseName: '明确结论 + 禁止模糊词', output: '结论：大概 7 天左右会到账，具体以银行为准。', assertions: [
                { assertionId: 'as-1', type: 'contains', passed: false, detail: '未找到「工作日」' },
                { assertionId: 'as-2', type: 'not-contains', passed: false, detail: '出现了不该有的「大概」' },
              ], passed: false, durationMs: 1100, tokensEst: 118, costEst: 0.0002 },
              { caseId: 'case-2', caseName: '结构化输出', output: '{"answer":"7 个工作日"}', assertions: [{ assertionId: 'as-3', type: 'json-valid', passed: true, detail: 'JSON 合法，1 个字段齐全' }], passed: true, durationMs: 1200, tokensEst: 128, costEst: 0.0002 },
              { caseId: 'case-3', caseName: '语气一致', output: '会尽快为您处理。', assertions: [{ assertionId: 'as-4', type: 'llm-rubric', passed: true, score: 0.85, detail: '0.85 ≥ 0.7 · 语气专业' }], passed: true, durationMs: 1000, tokensEst: 96, costEst: 0.0002 },
              { caseId: 'case-4', caseName: '响应速度', output: '结论：大概 7 天。', assertions: [{ assertionId: 'as-5', type: 'max-latency', passed: true, detail: '1050ms ≤ 20000ms' }], passed: true, durationMs: 1050, tokensEst: 88, costEst: 0.0001 },
            ],
          },
        ].forEach(r => tx.objectStore('evalRuns').put(r));
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, { cases: CASES, versions: versionRecords(v1.id, v1.content), v1Content: v1.content });

  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(3500);

  console.log('\n[3] 版本时间线：分数曲线');
  check('切到历史视图', await clickByText('历史', 'button.tab'));
  await sleep(900);

  const curve = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.vb-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    scores: [...document.querySelectorAll('.version-eval')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    baselineCard: !!document.querySelector('.version-baseline'),
  }));
  check('基线卡片渲染', curve.baselineCard);
  check('曲线包含 v1/v2/v3', curve.rows.length === 3 && curve.rows.join('|').includes('v1') && curve.rows.join('|').includes('v3'), curve.rows.join(' | '));
  check('v2 涨 50、v3 跌 25', curve.rows[1]?.includes('100 分') && curve.rows[1]?.includes('+50') && curve.rows[2]?.includes('75 分') && curve.rows[2]?.includes('-25'), curve.rows.join(' | '));
  check('版本卡片带分数徽标', curve.scores.some(s => s.includes('100 分')) && curve.scores.some(s => s.includes('75 分')), curve.scores.join(' / '));
  await page.screenshot({ path: `${OUT}\\p12-version-curve.png` });

  console.log('\n[4] 评测页：基线对比 + 退化用例定位');
  check('切到评测视图', await clickByText('评测', 'button.tab'));
  await sleep(900);
  check('点开最近一次运行（v3）', await page.evaluate(() => {
    const row = document.querySelector('.ev-history-row');
    if (!row) return false;
    row.click();
    return true;
  }));
  await sleep(600);

  const panel = await page.evaluate(() => {
    const el = document.querySelector('.ev-baseline');
    return el ? {
      flow: [...el.querySelectorAll('.ev-baseline-run')].map(n => n.textContent.replace(/\s+/g, ' ').trim()),
      delta: el.querySelector('.ev-baseline-delta')?.textContent?.trim(),
      regressed: [...el.querySelectorAll('.ev-bl-case.regressed')].map(n => n.textContent.replace(/\s+/g, ' ').trim()),
      fixed: el.querySelectorAll('.ev-bl-case.fixed').length,
      datasetState: el.querySelector('.ev-bl-dataset-state')?.textContent?.trim(),
    } : null;
  });
  check('出现回归基线面板', !!panel);
  check('基线 v2 100 分 → 本次 v3 75 分', panel?.flow.join(' | ').includes('v2') && panel?.flow.join(' | ').includes('100 分') && panel?.flow.join(' | ').includes('75 分'), panel?.flow.join(' | '));
  check('分数差标为 -25', panel?.delta === '-25', panel?.delta ?? 'null');
  check('同一套用例标为一致', panel?.datasetState === '一致', panel?.datasetState ?? 'null');
  check('列出退化用例', (panel?.regressed.length ?? 0) === 1, (panel?.regressed ?? []).join(' | '));

  check('展开退化用例', await page.evaluate(() => {
    const head = document.querySelector('.ev-bl-case.regressed .ev-bl-case-head');
    if (!head) return false;
    head.click();
    return true;
  }));
  await sleep(500);

  const detail = await page.evaluate(() => {
    const el = document.querySelector('.ev-bl-case.regressed');
    return {
      asserts: [...(el?.querySelectorAll('.ev-bl-asserts li') ?? [])].map(n => n.textContent.replace(/\s+/g, ' ').trim()),
      blocks: [...(el?.querySelectorAll('.ev-bl-block') ?? [])].map(n => ({
        conf: n.querySelector('.ev-bl-conf')?.textContent?.trim(),
        why: n.querySelector('.ev-bl-why')?.textContent?.trim(),
        old: n.querySelector('.ev-bl-old')?.textContent?.trim().slice(0, 30),
        new: n.querySelector('.ev-bl-new')?.textContent?.trim().slice(0, 30),
        signals: n.querySelector('.ev-bl-signals')?.textContent?.trim(),
      })),
    };
  });
  check('展开后显示失败断言', detail.asserts.length === 2, detail.asserts.join(' | '));
  check('定位到变更块', detail.blocks.length >= 1, JSON.stringify(detail.blocks));
  check('首个变更块为高相关且指向删除「工作日」', detail.blocks[0]?.conf === '高相关' && (detail.blocks[0]?.signals ?? '').includes('工作日'), JSON.stringify(detail.blocks[0]));
  check('变更块展示 why 与新旧片段', !!detail.blocks[0]?.why && !!detail.blocks[0]?.old && !!detail.blocks[0]?.new, JSON.stringify(detail.blocks[0]));

  await page.evaluate(() => document.querySelector('.ev-baseline')?.scrollIntoView({ block: 'center' }));
  await sleep(400);
  await page.screenshot({ path: `${OUT}\\p12-regression.png` });

  console.log('\n[5] 版本时间线 → 评测此版本（无 Key 应打开设置）');
  check('回到历史视图', await clickByText('历史', 'button.tab'));
  await sleep(800);
  check('点击 v2 的「评测此版本」', await page.evaluate(() => {
    const items = [...document.querySelectorAll('.version-item')];
    const v2 = items.find(el => el.querySelector('.version-label')?.textContent?.trim() === 'v2');
    const btn = [...(v2?.querySelectorAll('.version-actions button') ?? [])]
      .find(b => (b.textContent || '').includes('评测此版本'));
    if (!btn) return false;
    btn.click();
    return true;
  }));
  await sleep(800);
  const wiring = await page.evaluate(() => ({
    view: document.querySelector('.tab.on')?.textContent?.trim(),
    chips: [...document.querySelectorAll('.ev-chip')].map(n => n.textContent.replace(/\s+/g, ' ').trim()),
    banner: document.querySelector('.ev-banner')?.textContent?.replace(/\s+/g, ' ').trim(),
    settings: !!document.querySelector('.settings-overlay'),
  }));
  check('切到评测视图并标出历史版本对象',
    (wiring.view ?? '').includes('评测') && wiring.chips.some(c => c.includes('v2 · 历史版本')),
    JSON.stringify(wiring));
  check('提示正在评测历史版本 v2', (wiring.banner ?? '').includes('历史版本 v2'), wiring.banner ?? '');
  check('未配置 Key 时打开设置面板', wiring.settings === true, String(wiring.settings));

  console.log('\n[6] 用例集快照：改过用例后按共同用例比较');
  await page.evaluate(() => document.querySelector('.settings-header button')?.click());
  await sleep(300);
  check('点开改了用例集的 v3 运行', await page.evaluate(() => {
    const row = [...document.querySelectorAll('.ev-history-row')][1];
    if (!row) return false;
    row.click();
    return true;
  }));
  await sleep(600);

  const mismatch = await page.evaluate(() => {
    const el = document.querySelector('.ev-baseline');
    return {
      runLabel: document.querySelector('.ev-results .ev-pane-hint')?.textContent?.replace(/\s+/g, ' ').trim(),
      dataset: el?.querySelector('.ev-bl-dataset')?.textContent?.replace(/\s+/g, ' ').trim(),
      datasetState: el?.querySelector('.ev-bl-dataset-state')?.textContent?.trim(),
      delta: el?.querySelector('.ev-baseline-delta')?.textContent?.trim(),
      warn: el?.querySelector('.ev-bl-note-warn')?.textContent?.replace(/\s+/g, ' ').trim(),
      changedRows: [...(el?.querySelectorAll('.ev-bl-case.changed') ?? [])]
        .map(n => n.textContent.replace(/\s+/g, ' ').trim()),
    };
  });
  check('打开的是 5 条用例的运行', (mismatch.runLabel ?? '').includes('v3') && (mismatch.runLabel ?? '').includes('80 分'), mismatch.runLabel ?? null);
  check('用例集标为已变化', mismatch.datasetState === '已变化', mismatch.datasetState ?? null);
  check('涨跌改用共同用例（共同 -33）', mismatch.delta === '共同 -33', mismatch.delta ?? null);
  check('说明新增/修改与整体分数的关系',
    (mismatch.warn ?? '').includes('新增 1') &&
    (mismatch.warn ?? '').includes('修改 1') &&
    (mismatch.warn ?? '').includes('共同 3 条用例') &&
    (mismatch.warn ?? '').includes('100 → 67') &&
    (mismatch.warn ?? '').includes('100 → 80'),
    mismatch.warn ?? '');
  check('改过的用例标为改动且不参与比较',
    mismatch.changedRows.length === 1 &&
    mismatch.changedRows[0].includes('改动') &&
    mismatch.changedRows[0].includes('断言已修改'),
    mismatch.changedRows.join(' | '));

  await page.evaluate(() => document.querySelector('.ev-bl-dataset')?.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await page.screenshot({ path: `${OUT}\\p12-dataset-mismatch.png` });

  console.log('\n[7] 结果栏滚动（回归基线不能被压缩）');
  check('展开一条结果明细撑高内容', await page.evaluate(() => {
    const row = document.querySelector('.ev-row');
    if (!row) return false;
    row.click();
    return true;
  }));
  await sleep(500);
  const scrollCheck = await page.evaluate(() => {
    const pane = document.querySelector('.ev-results');
    const baseline = document.querySelector('.ev-baseline');
    if (!pane || !baseline) return null;
    pane.scrollTop = pane.scrollHeight;
    const pr = pane.getBoundingClientRect();
    const br = baseline.getBoundingClientRect();
    return {
      baselineHeight: Math.round(br.height),
      scrollable: pane.scrollHeight > pane.clientHeight + 1,
      fullyVisible: br.bottom <= pr.bottom + 1 && br.top >= pr.top - 1,
      scrollTop: Math.round(pane.scrollTop),
    };
  });
  check('基线卡片保持完整高度（不被 flex 压扁）', (scrollCheck?.baselineHeight ?? 0) > 150, JSON.stringify(scrollCheck));
  check('结果栏可滚到底看到完整基线', !!scrollCheck?.scrollable && !!scrollCheck?.fullyVisible, JSON.stringify(scrollCheck));
  await page.screenshot({ path: `${OUT}\\p12-eval-scroll.png` });

  console.log('\n[8] 载入本次用例集快照');
  check('点击「载入本次用例集」', await page.evaluate(() => {
    const btn = document.querySelector('.ev-bl-restore');
    if (!btn) return false;
    btn.click();
    return true;
  }));
  await sleep(700);
  const restored = await page.evaluate(() => ({
    head: document.querySelector('.ev-pane.ev-cases .ev-pane-head')?.textContent?.replace(/\s+/g, ' ').trim(),
    saved: JSON.parse(localStorage.getItem('promptstudio:evalCases') || '[]').length,
    names: [...document.querySelectorAll('.ev-case-name')].map(n => n.textContent.trim()),
  }));
  check('用例集被替换为 5 条', restored.saved === 5 && (restored.head ?? '').includes('用例 · 5'), JSON.stringify(restored));
  check('新增的「到账通知」已载入', restored.names.includes('到账通知'), restored.names.join(' | '));

  check('全程 0 条 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length > 0) process.exit(1);
