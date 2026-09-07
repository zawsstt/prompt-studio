/* ============================================================
   PROMPTSTUDIO — Modification Log Panel (Glassmorphism)
   Slide-in panel: Why/How/Effect + Accept/Reject
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { escapeHtml, $ } from './utils.js';

const dom = {};

export function initModLog() {
  dom.overlay = $('#mod-log-overlay');
  dom.panel = $('#mod-log-panel');
  dom.body = $('#mod-log-body');
  dom.footer = $('#mod-log-footer');
  dom.btnPin = $('#btn-pin-log');

  if (!dom.panel) return;

  // Listen for diff block selection
  Events.on('diff:block-selected', ({ changeIdx }) => openModLog(changeIdx));

  // Overlay click to close
  if (dom.overlay) {
    dom.overlay.addEventListener('click', (e) => {
      if (e.target === dom.overlay) closeModLog();
    });
  }

  // Pin button
  if (dom.btnPin) {
    dom.btnPin.addEventListener('click', togglePin);
  }

  // Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && State.get('ui.modLogOpen') && !State.get('ui.modLogPinned')) {
      closeModLog();
    }
  });

  // Accept all from diff view
  Events.on('diff:accept-all', acceptCurrent);
  Events.on('diff:reject-all', rejectCurrent);
}

export function openModLog(changeIdx) {
  const blocks = State.get('diff.changeBlocks') || [];
  const block = blocks[changeIdx];
  if (!block) return;

  State.set('diff.currentChangeIdx', changeIdx);
  State.set('ui.modLogOpen', true);

  renderModLog(block);

  dom.overlay.classList.add('active');
  dom.panel.classList.add('active');
}

export function closeModLog() {
  if (State.get('ui.modLogPinned')) return;
  State.set('ui.modLogOpen', false);
  dom.overlay?.classList.remove('active');
  dom.panel?.classList.remove('active');
}

function togglePin() {
  const pinned = !State.get('ui.modLogPinned');
  State.set('ui.modLogPinned', pinned);
  if (dom.btnPin) {
    dom.btnPin.classList.toggle('pinned', pinned);
    dom.btnPin.title = pinned ? '已钉住 — 点击取消' : '钉住';
  }
  if (pinned) {
    dom.overlay.style.pointerEvents = 'none';
  } else {
    dom.overlay.style.pointerEvents = '';
  }
}

function renderModLog(block) {
  if (!dom.body) return;

  dom.body.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span class="type-badge ${block.type}">${typeLabel(block.type)}</span>
      <span style="font-size:11px;color:var(--text-muted)">${block.oldRange} → ${block.newRange}</span>
    </div>

    <div class="ml-section">
      <div class="ml-label">修改前</div>
      <div class="ml-diff-preview" style="border-left:3px solid var(--diff-del)">${escapeHtml(block.oldSnippet || '')}</div>
    </div>
    <div class="ml-section">
      <div class="ml-label">修改后</div>
      <div class="ml-diff-preview" style="border-left:3px solid var(--diff-add)">${escapeHtml(block.newSnippet || '')}</div>
    </div>

    <div class="ml-section">
      <div class="ml-label">为何修改（Why）</div>
      <div class="ml-value more" id="ml-why">${escapeHtml(block.why || '')}</div>
      <button class="ml-expand" onclick="window._expandML('ml-why')">展开全部</button>
    </div>

    <div class="ml-section">
      <div class="ml-label">如何修改（How）</div>
      <div class="ml-value">${escapeHtml(block.how || '')}</div>
    </div>

    <div class="ml-section">
      <div class="ml-label">用途与效果（Effect）</div>
      <div class="ml-value">${escapeHtml(block.effect || '')}</div>
    </div>

    <div class="ml-section">
      <div class="ml-label">元信息</div>
      <div class="ml-meta">
        <span class="ml-meta-item">🤖 ${escapeHtml(block.model || '')}</span>
        <span class="ml-meta-item">📊 ${escapeHtml(block.tokens || '')}</span>
        <span class="ml-meta-item">💰 ${escapeHtml(block.cost || '')}</span>
        <span class="ml-meta-item">📝 ${escapeHtml(block.version || '')}</span>
      </div>
    </div>

    <div class="ml-disclaimer">⚠ AI 生成说明，仅供参考。如与实际不符，可编辑修正。</div>
  `;

  // Footer buttons
  if (dom.footer) {
    const accepted = block.accepted;
    dom.footer.innerHTML = `
      <button class="btn btn-success btn-sm" id="btn-accept-change" style="flex:1" ${accepted === true ? 'disabled' : ''}>
        ✓ ${accepted === true ? '已接受' : '接受此修改'}
      </button>
      <button class="btn btn-danger btn-sm" id="btn-reject-change" style="flex:1" ${accepted === false ? 'disabled' : ''}>
        ✗ ${accepted === false ? '已拒绝' : '拒绝此修改'}
      </button>
      <button class="btn btn-secondary btn-sm" id="btn-edit-explain">✎ 编辑说明</button>
    `;

    $('#btn-accept-change')?.addEventListener('click', acceptCurrent);
    $('#btn-reject-change')?.addEventListener('click', rejectCurrent);
    $('#btn-edit-explain')?.addEventListener('click', editExplanation);
  }
}

// Expose expandML globally (called from inline onclick)
window._expandML = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('more');
  let btn = el.nextElementSibling;
  while (btn && !btn.classList.contains('ml-expand')) btn = btn.nextElementSibling;
  if (btn) btn.textContent = el.classList.contains('more') ? '展开全部' : '收起';
};

function acceptCurrent() {
  const idx = State.get('diff.currentChangeIdx');
  if (idx < 0) return;
  const blocks = [...(State.get('diff.changeBlocks') || [])];
  blocks[idx].accepted = true;
  State.set('diff.changeBlocks', blocks);
  updateDiffLineUI(idx, 'accepted');
  closeModLog();
  Events.emit('toast', '✓ 已接受修改 #' + (idx + 1));
  checkAllResolved();
}

function rejectCurrent() {
  const idx = State.get('diff.currentChangeIdx');
  if (idx < 0) return;
  const blocks = [...(State.get('diff.changeBlocks') || [])];
  blocks[idx].accepted = false;
  State.set('diff.changeBlocks', blocks);
  updateDiffLineUI(idx, 'rejected');
  closeModLog();
  Events.emit('toast', '✗ 已拒绝修改 #' + (idx + 1));
  checkAllResolved();
}

function updateDiffLineUI(idx, status) {
  const lines = document.querySelectorAll(`#diff-right-content .diff-line.changed[data-change-idx="${idx}"]`);
  lines.forEach(line => {
    line.classList.remove('accepted-line', 'rejected-line');
    line.classList.add(status === 'accepted' ? 'accepted-line' : 'rejected-line');
  });
}

function checkAllResolved() {
  const blocks = State.get('diff.changeBlocks') || [];
  if (blocks.every(b => b.accepted !== null)) {
    const accepted = blocks.filter(b => b.accepted).length;
    setTimeout(() => {
      if (confirm(`所有修改已处理完毕。\n\n已接受：${accepted} 处\n已拒绝：${blocks.length - accepted} 处\n\n生成版本 v${(State.get('versions.list') || []).length + 1}？`)) {
        Events.emit('version:create', {
          note: `AI 修改（接受 ${accepted}/${blocks.length}）`,
          content: State.get('doc.candidateContent'),
        });
        Events.emit('diff:close');
      }
    }, 400);
  }
}

function editExplanation() {
  const idx = State.get('diff.currentChangeIdx');
  if (idx < 0) return;
  const blocks = [...(State.get('diff.changeBlocks') || [])];
  const newWhy = prompt('编辑修改原因（Why）：', blocks[idx].why || '');
  if (newWhy !== null) {
    blocks[idx].why = newWhy;
    State.set('diff.changeBlocks', blocks);
    renderModLog(blocks[idx]);
    Events.emit('toast', '说明已更新');
  }
}

function typeLabel(type) {
  return { add: '新增', del: '删除', replace: '替换', reorder: '重排' }[type] || type;
}

// Expose for mod-log close button in HTML
window._closeModLog = closeModLog;

export default { initModLog, openModLog, closeModLog };
