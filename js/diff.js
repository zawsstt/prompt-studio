/* ============================================================
   PROMPTSTUDIO — Diff Engine + View
   Line-level Myers-style diff + view rendering
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { escapeHtml, $, $$ } from './utils.js';

const dom = {};
let hoverTimer = null;
let fadeTimer = null;

export function initDiff() {
  dom.overlay = $('#diff-overlay');
  dom.leftContent = $('#diff-left-content');
  dom.rightContent = $('#diff-right-content');
  dom.hoverContainer = $('#hover-bubble-container');
  dom.toolbar = $('#diff-toolbar');

  if (!dom.overlay) return;

  // Listen for diff:open event from chat
  Events.on('diff:open', () => openDiffView());

  // Keyboard navigation in diff mode
  document.addEventListener('keydown', handleDiffKeyboard);

  // Exit button
  const exitBtn = dom.overlay.querySelector('#btn-diff-exit');
  if (exitBtn) exitBtn.addEventListener('click', closeDiffView);
}

function handleDiffKeyboard(e) {
  if (!State.get('ui.diffActive')) return;
  if (State.get('ui.modLogOpen')) return;

  switch (e.key) {
    case 'Escape': e.preventDefault(); closeDiffView(); break;
    case 'n': case 'N': e.preventDefault(); nextChange(); break;
    case 'p': case 'P': e.preventDefault(); prevChange(); break;
    case 'a': case 'A': e.preventDefault(); acceptCurrentChange(); break;
    case 'r': case 'R': e.preventDefault(); rejectCurrentChange(); break;
  }
}

export function openDiffView() {
  State.set('ui.diffActive', true);
  dom.overlay.classList.add('active');
  renderDiff();
  setupSyncScroll();
}

export function closeDiffView() {
  const allResolved = (State.get('diff.changeBlocks') || []).every(b => b.accepted !== null);
  if (!allResolved) {
    const unresolved = (State.get('diff.changeBlocks') || []).filter(b => b.accepted === null).length;
    if (!confirm(`还有 ${unresolved} 处修改未处理。确定退出对比？`)) return;
  }
  State.set('ui.diffActive', false);
  dom.overlay.classList.remove('active');
  removeAllBubbles();
}

function renderDiff() {
  const oldText = State.get('doc.content') || '';
  const newText = State.get('doc.candidateContent') || oldText;
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const diffBlocks = computeLineDiff(oldLines, newLines);

  // Count how many change groups we'll have (for indexing)
  const changeGroupCount = diffBlocks.filter(b => b.type === 'insert' || b.type === 'replace').length;

  // Align AI explanations to diff blocks
  const alignedExps = alignExplanations(diffBlocks, State.get('diff.changeBlocks') || [], changeGroupCount);

  let leftHtml = '';
  let rightHtml = '';
  let addCount = 0;
  let delCount = 0;
  let changeIdx = 0;

  diffBlocks.forEach(block => {
    if (block.type === 'equal') {
      block.oldLines.forEach(l => { leftHtml += `<div class="diff-line">${escapeHtml(l)}</div>`; });
      block.newLines.forEach(l => { rightHtml += `<div class="diff-line">${escapeHtml(l)}</div>`; });
    } else if (block.type === 'delete') {
      block.oldLines.forEach(l => {
        leftHtml += `<div class="diff-line del">${escapeHtml(l)}</div>`;
        delCount++;
      });
    } else if (block.type === 'insert') {
      const exp = alignedExps[changeIdx] || {};
      block.newLines.forEach(l => {
        rightHtml += `<div class="diff-line add changed" data-change-idx="${changeIdx}" data-why="${escapeAttr(exp.why || '')}" data-how="${escapeAttr(exp.how || '')}" data-effect="${escapeAttr(exp.effect || '')}">${escapeHtml(l)}</div>`;
        addCount++;
      });
      block.newLines.forEach(() => { leftHtml += '<div class="diff-line empty-placeholder">…</div>'; });
      changeIdx++;
    } else if (block.type === 'replace') {
      const exp = alignedExps[changeIdx] || {};
      const expAttrs = `data-why="${escapeAttr(exp.why || '')}" data-how="${escapeAttr(exp.how || '')}" data-effect="${escapeAttr(exp.effect || '')}"`;

      // Pair old/new lines and compute character-level diffs
      const maxLen = Math.max(block.oldLines.length, block.newLines.length);
      for (let k = 0; k < maxLen; k++) {
        const oldLine = block.oldLines[k] || '';
        const newLine = block.newLines[k] || '';

        if (oldLine && newLine) {
          // Both exist — compute character-level diff
          const charDiffs = computeCharDiff(oldLine, newLine);
          leftHtml += `<div class="diff-line replace">${renderCharDiffLine(charDiffs, 'old')}</div>`;
          rightHtml += `<div class="diff-line replace changed" data-change-idx="${changeIdx}" ${expAttrs}>${renderCharDiffLine(charDiffs, 'new')}</div>`;
        } else if (oldLine) {
          // Only old — deleted line
          leftHtml += `<div class="diff-line del">${escapeHtml(oldLine)}</div>`;
          rightHtml += '<div class="diff-line empty-placeholder">…</div>';
          delCount++;
        } else {
          // Only new — added line
          leftHtml += '<div class="diff-line empty-placeholder">…</div>';
          rightHtml += `<div class="diff-line add changed" data-change-idx="${changeIdx}" ${expAttrs}>${escapeHtml(newLine)}</div>`;
          addCount++;
        }
      }
      changeIdx++;
    }
  });

  dom.leftContent.innerHTML = leftHtml || '<div style="color:var(--text-muted);text-align:center;padding:40px">无内容</div>';
  dom.rightContent.innerHTML = rightHtml || '<div style="color:var(--text-muted);text-align:center;padding:40px">无内容</div>';

  // Update stats
  const statAdd = $('#stat-add');
  const statDel = $('#stat-del');
  const statTokens = $('#stat-tokens');
  if (statAdd) statAdd.textContent = addCount;
  if (statDel) statDel.textContent = delCount;
  if (statTokens) statTokens.textContent = '~' + Math.round(newText.length / 4);

  // Attach hover handlers
  $$('#diff-right-content .diff-line.changed').forEach(line => {
    line.addEventListener('mouseenter', showHoverBubble);
    line.addEventListener('mouseleave', hideHoverBubble);
    line.addEventListener('click', () => {
      const idx = parseInt(line.dataset.changeIdx);
      if (!isNaN(idx)) {
        State.set('diff.currentChangeIdx', idx);
        Events.emit('diff:block-selected', { changeIdx: idx });
      }
    });
  });

  // Build change-summary panel in toolbar
  renderChangeSummary(alignedExps, changeGroupCount);
}

export function computeLineDiff(oldLines, newLines) {
  const blocks = [];
  let i = 0, j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      const eqOld = [], eqNew = [];
      while (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        eqOld.push(oldLines[i]); eqNew.push(newLines[j]); i++; j++;
      }
      blocks.push({ type: 'equal', oldLines: eqOld, newLines: eqNew });
    } else if (i < oldLines.length && j < newLines.length) {
      let syncNew = -1, syncOld = -1;
      // Increased look-ahead from 5 to 12 for better alignment
      for (let k = 1; k < 12 && (i + k < oldLines.length || j + k < newLines.length); k++) {
        if (j + k < newLines.length && oldLines[i] === newLines[j + k]) { syncNew = j + k; break; }
        if (i + k < oldLines.length && oldLines[i + k] === newLines[j]) { syncOld = i + k; break; }
      }
      // Allow up to 8 inserted/deleted lines before treating as replace
      if (syncNew !== -1 && syncNew - j <= 8) {
        blocks.push({ type: 'insert', oldLines: [], newLines: newLines.slice(j, syncNew) });
        j = syncNew;
      } else if (syncOld !== -1 && syncOld - i <= 8) {
        blocks.push({ type: 'delete', oldLines: oldLines.slice(i, syncOld), newLines: [] });
        i = syncOld;
      } else {
        blocks.push({ type: 'replace', oldLines: [oldLines[i]], newLines: [newLines[j]] });
        i++; j++;
      }
    } else if (i < oldLines.length) {
      blocks.push({ type: 'delete', oldLines: [oldLines[i]], newLines: [] });
      i++;
    } else {
      blocks.push({ type: 'insert', oldLines: [], newLines: [newLines[j]] });
      j++;
    }
  }
  return blocks;
}

// ── Character-level diff (LCS) ──

/**
 * Compute character-level diff between two strings using LCS algorithm.
 * Returns array of { text, type } where type is 'equal' | 'add' | 'del'.
 */
function computeCharDiff(oldStr, newStr) {
  const oldChars = [...oldStr];
  const newChars = [...newStr];
  const m = oldChars.length;
  const n = newChars.length;

  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldChars[i - 1] === newChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Trace back to produce diff tokens
  const rawDiff = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      rawDiff.unshift({ text: oldChars[i - 1], type: 'equal' });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.unshift({ text: newChars[j - 1], type: 'add' });
      j--;
    } else {
      rawDiff.unshift({ text: oldChars[i - 1], type: 'del' });
      i--;
    }
  }

  // Merge consecutive same-type tokens
  const merged = [];
  for (const token of rawDiff) {
    const last = merged[merged.length - 1];
    if (last && last.type === token.type) {
      last.text += token.text;
    } else {
      merged.push({ text: token.text, type: token.type });
    }
  }

  return merged;
}

/**
 * Render a line with character-level diff highlights.
 * @param {Array} charDiffs - from computeCharDiff
 * @param {'old'|'new'} side - which side to render
 * @returns {string} HTML string
 */
function renderCharDiffLine(charDiffs, side) {
  let html = '';
  for (const token of charDiffs) {
    const esc = escapeHtml(token.text);
    if (token.type === 'equal') {
      html += esc;
    } else if (side === 'old' && token.type === 'del') {
      html += `<span class="diff-char-del">${esc}</span>`;
    } else if (side === 'new' && token.type === 'add') {
      html += `<span class="diff-char-add">${esc}</span>`;
    }
    // 'del' on 'new' side or 'add' on 'old' side = not rendered (gap in alignment)
  }
  return html || '&nbsp;';
}

/**
 * Escape a string for use in HTML attribute value.
 */
function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ');
}

/**
 * Align AI explanation blocks to actual diff change groups.
 * If counts don't match, try content-based fuzzy matching.
 */
function alignExplanations(diffBlocks, explanations, changeCount) {
  if (explanations.length === changeCount) return explanations;

  // Build change-group list from diff blocks
  const changeGroups = [];
  for (const block of diffBlocks) {
    if (block.type === 'insert') {
      changeGroups.push({ type: 'insert', snippet: block.newLines.slice(0, 2).join(' ').slice(0, 80) });
    } else if (block.type === 'replace') {
      changeGroups.push({ type: 'replace', snippet: block.newLines[0] ? block.newLines[0].slice(0, 80) : '' });
    }
  }

  // Try to match each explanation to a change group by snippet similarity
  const result = new Array(changeCount).fill(null).map(() => ({}));
  const used = new Set();

  for (const exp of explanations) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < changeGroups.length; i++) {
      if (used.has(i)) continue;
      const score = snippetSimilarity(exp.newSnippet || '', changeGroups[i].snippet || '');
      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      result[bestIdx] = exp;
      used.add(bestIdx);
    }
  }

  return result;
}

/**
 * Simple snippet similarity (substring overlap ratio).
 */
function snippetSimilarity(a, b) {
  if (!a || !b) return 0;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  let overlap = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) overlap++;
  }
  return overlap / Math.max(shorter.length, 1);
}

// ── Hover Bubble ──

function showHoverBubble(e) {
  const line = e.currentTarget;
  const rect = line.getBoundingClientRect();
  clearTimeout(hoverTimer);
  clearTimeout(fadeTimer);
  removeAllBubbles();

  hoverTimer = setTimeout(() => {
    // Read explanations directly from DOM data attributes (set at render time)
    const why = line.dataset.why || '';
    const how = line.dataset.how || '';
    const effect = line.dataset.effect || '';
    const idx = parseInt(line.dataset.changeIdx);

    const bubble = document.createElement('div');
    bubble.className = 'hover-bubble';

    if (why || how || effect) {
      // Show Why/How/Effect from AI explanations
      bubble.innerHTML = [
        why ? `<div class="hbe-row"><span class="hbe-label">Why</span><span class="hbe-text">${escapeHtml(why)}</span></div>` : '',
        how ? `<div class="hbe-row"><span class="hbe-label">How</span><span class="hbe-text">${escapeHtml(how)}</span></div>` : '',
        effect ? `<div class="hbe-row"><span class="hbe-label">Effect</span><span class="hbe-text">${escapeHtml(effect)}</span></div>` : '',
      ].filter(Boolean).join('');
      // Wrap in explain container
      bubble.innerHTML = `<div class="hover-bubble-explain">${bubble.innerHTML}</div>`;
    } else {
      // Fallback: no explanation available
      bubble.innerHTML = '查看修改详情 <span style="font-size:10px;color:var(--text-muted);margin-left:4px">Enter</span>';
    }

    bubble.style.left = Math.min(rect.right + 12, window.innerWidth - 340) + 'px';
    bubble.style.top = Math.max(rect.top, 60) + 'px';
    bubble.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!isNaN(idx)) {
        State.set('diff.currentChangeIdx', idx);
        Events.emit('diff:block-selected', { changeIdx: idx });
      }
    });
    dom.hoverContainer.appendChild(bubble);

    fadeTimer = setTimeout(() => {
      bubble.classList.add('fading');
      setTimeout(() => bubble.remove(), 400);
    }, 8000);
  }, 150);
}

function hideHoverBubble() {
  clearTimeout(hoverTimer);
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(removeAllBubbles, 400);
}

function removeAllBubbles() {
  if (dom.hoverContainer) dom.hoverContainer.innerHTML = '';
}

// ── Change Summary Panel (in toolbar) ──

/**
 * Render a collapsible summary panel in the diff toolbar showing
 * all change blocks with Why/How/Effect. Clicking an item scrolls
 * to that change in the diff and selects it.
 */
function renderChangeSummary(alignedExps, totalChanges) {
  const toolbar = dom.toolbar;
  if (!toolbar) return;

  // Remove previous summary if any
  const oldSummary = toolbar.querySelector('.change-summary');
  if (oldSummary) oldSummary.remove();

  if (totalChanges === 0) return;

  // Count changes with explanations
  const withExplanations = alignedExps.filter(e => e.why || e.how || e.effect).length;

  // Build summary container
  const container = document.createElement('div');
  container.className = 'change-summary';

  // Header: clickable toggle
  const header = document.createElement('div');
  header.className = 'cs-header';
  header.innerHTML = `
    <svg class="cs-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    <span class="cs-count">${totalChanges} 处修改</span>
    ${withExplanations > 0 ? `<span class="cs-badge">${withExplanations} 有说明</span>` : ''}
  `;
  header.addEventListener('click', () => {
    container.classList.toggle('expanded');
  });
  container.appendChild(header);

  // Dropdown body
  const body = document.createElement('div');
  body.className = 'cs-body';

  let hasAnyExplanation = false;
  alignedExps.forEach((exp, idx) => {
    const hasExp = exp.why || exp.how || exp.effect;
    if (hasExp) hasAnyExplanation = true;

    const item = document.createElement('div');
    item.className = 'cs-item';
    const typeLabel = { add: '新增', del: '删除', replace: '替换', reorder: '重排' }[exp.type] || '修改';
    const snippet = (exp.newSnippet || exp.oldSnippet || '').slice(0, 60);

    item.innerHTML = `
      <span class="cs-type cs-type-${exp.type || 'replace'}">${typeLabel}</span>
      <span class="cs-snippet">${escapeHtml(snippet)}${snippet.length >= 60 ? '…' : ''}</span>
      ${hasExp ? `
        <div class="cs-why">
          ${exp.why ? `<div class="cs-why-row"><span class="cs-why-label">Why</span>${escapeHtml(exp.why.slice(0, 100))}${exp.why.length > 100 ? '…' : ''}</div>` : ''}
          ${exp.how ? `<div class="cs-why-row"><span class="cs-why-label">How</span>${escapeHtml(exp.how.slice(0, 100))}${exp.how.length > 100 ? '…' : ''}</div>` : ''}
          ${exp.effect ? `<div class="cs-why-row"><span class="cs-why-label">Effect</span>${escapeHtml(exp.effect.slice(0, 100))}${exp.effect.length > 100 ? '…' : ''}</div>` : ''}
        </div>
      ` : ''}
    `;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      State.set('diff.currentChangeIdx', idx);
      Events.emit('diff:block-selected', { changeIdx: idx });
      scrollToChange(idx);
      // Visual feedback
      item.classList.add('cs-item-active');
      setTimeout(() => item.classList.remove('cs-item-active'), 1200);
    });

    body.appendChild(item);
  });

  container.appendChild(body);

  // Insert before spacer in toolbar (or at end)
  const spacer = toolbar.querySelector('.spacer');
  if (spacer) {
    spacer.before(container);
  } else {
    toolbar.insertBefore(container, toolbar.firstChild);
  }
}

// ── Sync Scroll ──

function setupSyncScroll() {
  const left = dom.leftContent?.parentElement;
  const right = dom.rightContent?.parentElement;
  if (!left || !right) return;

  let syncing = false;
  left.onscroll = () => { if (!syncing) { syncing = true; right.scrollTop = left.scrollTop; setTimeout(() => { syncing = false; }, 10); } };
  right.onscroll = () => { if (!syncing) { syncing = true; left.scrollTop = right.scrollTop; setTimeout(() => { syncing = false; }, 10); } };
}

// ── Navigation ──

function nextChange() {
  const blocks = State.get('diff.changeBlocks') || [];
  if (blocks.length === 0) return;
  const idx = (State.get('diff.currentChangeIdx') + 1) % blocks.length;
  State.set('diff.currentChangeIdx', idx);
  Events.emit('diff:block-selected', { changeIdx: idx });
  scrollToChange(idx);
}

function prevChange() {
  const blocks = State.get('diff.changeBlocks') || [];
  if (blocks.length === 0) return;
  const idx = (State.get('diff.currentChangeIdx') - 1 + blocks.length) % blocks.length;
  State.set('diff.currentChangeIdx', idx);
  Events.emit('diff:block-selected', { changeIdx: idx });
  scrollToChange(idx);
}

function scrollToChange(idx) {
  const line = $(`#diff-right-content .diff-line.changed[data-change-idx="${idx}"]`);
  if (line) line.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function acceptCurrentChange() {
  const idx = State.get('diff.currentChangeIdx');
  if (idx < 0) return;
  const blocks = State.get('diff.changeBlocks') || [];
  blocks[idx].accepted = true;
  State.set('diff.changeBlocks', [...blocks]);
  updateLineStatus(idx, 'accepted');
  Events.emit('toast', '✓ 已接受修改 #' + (idx + 1));
  checkAllResolved();
}

function rejectCurrentChange() {
  const idx = State.get('diff.currentChangeIdx');
  if (idx < 0) return;
  const blocks = State.get('diff.changeBlocks') || [];
  blocks[idx].accepted = false;
  State.set('diff.changeBlocks', [...blocks]);
  updateLineStatus(idx, 'rejected');
  Events.emit('toast', '✗ 已拒绝修改 #' + (idx + 1));
  checkAllResolved();
}

export function acceptAll() {
  const blocks = State.get('diff.changeBlocks') || [];
  if (!confirm(`确定接受全部 ${blocks.length} 处修改？`)) return;
  blocks.forEach((b, i) => { b.accepted = true; updateLineStatus(i, 'accepted'); });
  State.set('diff.changeBlocks', [...blocks]);
  Events.emit('toast', '✓ 已接受全部修改');
  checkAllResolved();
}

export function rejectAll() {
  const blocks = State.get('diff.changeBlocks') || [];
  if (!confirm('确定拒绝全部修改？')) return;
  blocks.forEach((b, i) => { b.accepted = false; updateLineStatus(i, 'rejected'); });
  State.set('diff.changeBlocks', [...blocks]);
  Events.emit('toast', '✗ 已拒绝全部修改');
  checkAllResolved();
}

function updateLineStatus(idx, status) {
  $$(`#diff-right-content .diff-line.changed[data-change-idx="${idx}"]`).forEach(line => {
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
        closeDiffView();
      }
    }, 400);
  }
}

// Expose navigation functions globally for toolbar onclick handlers
window._prevChange = prevChange;
window._nextChange = nextChange;

export default { initDiff, openDiffView, closeDiffView, acceptAll, rejectAll, computeLineDiff };
