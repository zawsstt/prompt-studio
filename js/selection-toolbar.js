/* ============================================================
   PROMPTSTUDIO — Selection Toolbar
   划词圈选 → 浮动工具栏 → 一键发送到 AI 对话
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { escapeHtml, $ } from './utils.js';

const dom = {};
let currentSelection = null;
let currentSource = null; // 'editor' | 'diff-left' | 'diff-right'

export function initSelectionToolbar() {
  dom.toolbar = $('#selection-toolbar');
  dom.editor = $('#editor');
  dom.charCount = $('#st-char-count');

  if (!dom.toolbar || !dom.editor) return;

  // Listen for text selection in editor
  dom.editor.addEventListener('mouseup', handleEditorSelection);
  dom.editor.addEventListener('keyup', handleEditorSelection);

  // Listen for selection in diff panes
  document.addEventListener('mouseup', handleDiffSelection);

  // Toolbar action buttons
  dom.toolbar.querySelectorAll('.st-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      executeAction(action);
      hideToolbar();
    });
  });

  // Hide toolbar when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (!dom.toolbar.contains(e.target) && !isInsideSelection(e)) {
      hideToolbar();
    }
  });

  // Hide on scroll
  document.addEventListener('scroll', () => {
    if (dom.toolbar.classList.contains('visible')) {
      hideToolbar();
    }
  }, true);

  // Hide on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.toolbar.classList.contains('visible')) {
      hideToolbar();
    }
  });
}

function handleEditorSelection(e) {
  // Small delay to let selection finalize
  setTimeout(() => {
    const editor = $('#editor');
    if (!editor || document.activeElement !== editor) return;

    const sel = window.getSelection();
    const text = sel.toString().trim();

    if (!text || text.length < 2) {
      hideToolbar();
      return;
    }

    // Verify the selection is inside the editor
    if (!editor.contains(sel.anchorNode)) return;

    currentSelection = text;
    currentSource = 'editor';

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    showToolbar(rect, text);
  }, 50);
}

function handleDiffSelection(e) {
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel.toString().trim();

    if (!text || text.length < 2) return;

    // Check if selection is in diff panes
    let source = null;
    const leftPane = $('#diff-left-content');
    const rightPane = $('#diff-right-content');

    if (leftPane && leftPane.contains(sel.anchorNode)) {
      source = 'diff-left';
    } else if (rightPane && rightPane.contains(sel.anchorNode)) {
      source = 'diff-right';
    }

    if (!source) return;

    currentSelection = text;
    currentSource = source;

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    showToolbar(rect, text);
  }, 50);
}

function showToolbar(rect, text) {
  if (!dom.toolbar) return;

  // Position above or below the selection
  const toolbarHeight = 38;
  let top = rect.top - toolbarHeight - 8;
  let showAbove = true;

  // If not enough space above, show below
  if (top < 60) {
    top = rect.bottom + 8;
    showAbove = false;
  }

  // Center horizontally on the selection
  let left = rect.left + rect.width / 2;
  const toolbarWidth = dom.toolbar.offsetWidth || 340;
  left = Math.max(8, Math.min(left - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8));

  dom.toolbar.style.left = left + 'px';
  dom.toolbar.style.top = top + 'px';
  dom.toolbar.classList.add('visible');

  // Update char count
  if (dom.charCount) {
    dom.charCount.textContent = text.length + ' 字符';
  }
}

function hideToolbar() {
  if (dom.toolbar) {
    dom.toolbar.classList.remove('visible');
  }
  currentSelection = null;
  currentSource = null;
}

function isInsideSelection(e) {
  // Don't hide if clicking on the selection itself
  return false;
}

function executeAction(action) {
  const text = currentSelection;
  if (!text) return;

  const sourceLabel = currentSource === 'editor' ? '编辑器' :
    currentSource === 'diff-left' ? '修改前（左）' : '修改后（右）';

  const prompts = {
    ask: `请针对以下从${sourceLabel}中选中的内容，回答我的问题：\n\n---\n${text}\n---`,
    explain: `请解释以下从${sourceLabel}中选中的 Prompt/Skill 内容的含义和设计意图：\n\n---\n${text}\n---`,
    improve: `请优化以下从${sourceLabel}中选中的内容，使其更清晰、更符合 Prompt Engineering 最佳实践（如使用祈使句、明确输出格式、减少歧义等），并说明你的修改理由：\n\n---\n${text}\n---`,
    fix: `请检查以下从${sourceLabel}中选中的内容是否存在问题（如歧义、格式错误、规则冲突等），并给出修正建议：\n\n---\n${text}\n---`,
  };

  const prompt = prompts[action] || prompts.ask;

  // Switch to chat view
  if (window._switchToChat) window._switchToChat();

  // Set the input value
  const chatInput = $('#chat-input');
  if (chatInput) {
    chatInput.value = prompt;
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    chatInput.focus();
  }

  // Send immediately for quick actions
  if (action === 'explain' || action === 'improve') {
    // Trigger send after a brief delay to let the UI update
    setTimeout(() => {
      const sendBtn = $('#btn-send');
      if (sendBtn) sendBtn.click();
    }, 100);
  }

  Events.emit('toast', `已从${sourceLabel}选中 ${text.length} 字符 → AI 对话`);
}

export default { initSelectionToolbar };
