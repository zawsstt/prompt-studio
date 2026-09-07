/* ============================================================
   PROMPTSTUDIO — Version Management
   Timeline, rollback, AI summary, version creation
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { escapeHtml, $, $$, spawnConfetti } from './utils.js';

const dom = {};

export function initVersion() {
  dom.timeline = $('#version-timeline');
  dom.summaryOverlay = $('#summary-overlay');
  dom.summaryContent = $('#summary-content');

  if (!dom.timeline) return;

  // Listen for version creation
  Events.on('version:create', ({ note, content }) => addVersion(note, content));

  // Listen for diff close
  Events.on('diff:close', () => {
    const diffOverlay = $('#diff-overlay');
    if (diffOverlay) diffOverlay.classList.remove('active');
    State.set('ui.diffActive', false);
  });

  // Initial render
  renderTimeline();

  // Subscribe to version changes
  State.subscribe('versions', renderTimeline);
}

function renderTimeline() {
  if (!dom.timeline) return;
  const versions = State.get('versions.list') || [];
  const current = State.get('versions.current');

  dom.timeline.innerHTML = versions.slice().reverse().map(v => `
    <div class="version-node${v.id === current ? ' active current' : ''}" data-version="${v.id}">
      <span class="v-label">${v.label}</span> ${v.id === current ? '<span style="font-size:10px;color:var(--brand)">当前</span>' : ''}
      <span class="v-time">${v.time}</span>
      ${v.id > 1 ? `<span class="v-summary-badge" data-action="summary" data-vid="${v.id}" title="AI 摘要">AI摘要</span>` : ''}
      <span class="v-rollback" data-action="rollback" data-vid="${v.id}" title="回滚到此版本">↩</span>
    </div>
  `).join('');

  // Event delegation
  dom.timeline.querySelectorAll('.version-node').forEach(node => {
    node.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      const vId = parseInt(e.target.dataset.vid);
      if (action === 'summary') {
        e.stopPropagation();
        showSummary(vId);
      } else if (action === 'rollback') {
        e.stopPropagation();
        rollbackVersion(vId);
      } else {
        selectVersion(parseInt(node.dataset.version));
      }
    });
  });
}

function selectVersion(vId) {
  State.set('versions.current', vId);
  const ver = (State.get('versions.list') || []).find(v => v.id === vId);
  if (ver && ver.content) {
    State.set('doc.content', ver.content);
  }
  renderTimeline();
  Events.emit('toast', `已切换到版本 ${ver?.label || 'v' + vId}`);
}

function rollbackVersion(vId) {
  const ver = (State.get('versions.list') || []).find(v => v.id === vId);
  if (!ver) return;
  if (!confirm(`回滚到 ${ver.label}？\n\n回滚会生成新版本（不覆盖历史），内容将变为 ${ver.label} 的快照。\n\n${ver.note || ''}`)) return;

  State.set('doc.content', ver.content);
  addVersion(`回滚到 ${ver.label} — ${ver.note || '手动回滚'}`, ver.content);
}

export function addVersion(note, content) {
  const versions = [...(State.get('versions.list') || [])];
  const newId = versions.length + 1;
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  versions.push({
    id: newId,
    label: 'v' + newId,
    time,
    content: content || State.get('doc.content'),
    note,
  });

  State.set({
    'versions.list': versions,
    'versions.current': newId,
    'doc.content': content || State.get('doc.content'),
  });

  renderTimeline();
  spawnConfetti();
  Events.emit('toast', `🎉 版本 v${newId} 已生成！`);
}

function showSummary(vId) {
  const ver = (State.get('versions.list') || []).find(v => v.id === vId);
  if (!ver || !dom.summaryOverlay || !dom.summaryContent) return;

  const summaryHtml = vId >= 3
    ? `<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">AI 生成，仅供参考 · 可编辑</div>
      <div style="padding:10px 14px;background:var(--surface-3);border-radius:var(--radius-md);font-size:12px;line-height:1.6">
        <strong>简要（3 处修改）：</strong><br>
        ① 指令语气从陈述式改为祈使式<br>
        ② 新增输出格式示例章节<br>
        ③ 调整模块顺序符合 Anthropic Skill 标准
      </div>
      <details style="font-size:12px;cursor:pointer;margin-top:8px">
        <summary style="color:var(--brand);padding:4px 0">查看全部详细说明</summary>
        <div style="padding:8px 0;display:flex;flex-direction:column;gap:10px">
          <div style="background:var(--surface-3);padding:10px 12px;border-radius:var(--radius-sm);border-left:3px solid var(--diff-replace)">
            <strong>① 指令语气</strong>（替换）— 祈使句更直接，减少"你"字冗余，模型遵循率更高
          </div>
          <div style="background:var(--surface-3);padding:10px 12px;border-radius:var(--radius-sm);border-left:3px solid var(--diff-add)">
            <strong>② 输出校验步骤</strong>（新增）— 新增第5步确保JSON格式合规，减少下游解析错误
          </div>
          <div style="background:var(--surface-3);padding:10px 12px;border-radius:var(--radius-sm);border-left:3px solid var(--diff-reorder)">
            <strong>③ 示例扩充</strong>（新增）— 覆盖多指标对比场景，丰富 Few-shot 样本
          </div>
        </div>
      </details>`
    : `<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">AI 生成，仅供参考</div>
      <div style="padding:10px 14px;background:var(--surface-3);border-radius:var(--radius-md);font-size:12px;line-height:1.6">
        <strong>简要（1 处修改）：</strong><br>
        ① 增加财务指标定义章节
      </div>`;

  dom.summaryContent.innerHTML = summaryHtml;
  dom.summaryOverlay.style.display = 'flex';

  // Close on outside click
  dom.summaryOverlay.onclick = function (e) {
    if (e.target === dom.summaryOverlay) closeSummary();
  };
}

function closeSummary() {
  if (dom.summaryOverlay) dom.summaryOverlay.style.display = 'none';
}

// Expose for inline onclick
window.closeSummary = closeSummary;

export default { initVersion, addVersion };
