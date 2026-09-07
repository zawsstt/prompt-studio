/* ============================================================
   PROMPTSTUDIO — Application Entry Point
   Bootstraps all modules, binds global events, initializes UI
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { INITIAL_STATE, RULES } from './data.js';
import { $, $$, toast } from './utils.js';

// Feature modules
import { initEditor, setEditorContent } from './editor.js';
import { initValidation } from './validation.js';
import { initChat, clearChat } from './chat.js';
import { initModelSelector } from './model-selector.js';
import { initDiff, openDiffView, closeDiffView, acceptAll, rejectAll } from './diff.js';
import { initModLog } from './mod-log.js';
import { initVersion } from './version.js';
import { initSettings, openSettings } from './settings.js';
import { initSelectionToolbar } from './selection-toolbar.js';

// ── Bootstrap ──

function init() {
  console.log('PromptStudio — Initializing...');

  // 1. Initialize state
  State.init(INITIAL_STATE);

  // 2. Wire global events
  wireEvents();

  // 3. Initialize all modules
  initEditor();
  initValidation();
  initChat();
  initModelSelector();
  initDiff();
  initModLog();
  initVersion();
  initSettings();
  initSelectionToolbar();

  // 4. Wire navigation (activity bar)
  wireNavigation();

  // 5. Wire topbar actions
  wireTopbar();

  // 6. Keyboard shortcuts
  wireKeyboard();

  // 7. Auto-organize button
  $('#btn-auto-organize')?.addEventListener('click', autoOrganize);

  // 8. Clear chat button
  $('#btn-clear-chat')?.addEventListener('click', clearChat);

  console.log('PromptStudio — Ready ✓');
}

function wireEvents() {
  // Toast notifications
  Events.on('toast', (msg) => toast(msg));

  // Model changed
  Events.on('model:changed', ({ modelId }) => {
    toast('已切换模型：' + modelId);
  });
}

function wireNavigation() {
  const navIcons = $$('#nav-column .nav-icon[data-view]');
  navIcons.forEach(icon => {
    icon.addEventListener('click', () => {
      const view = icon.dataset.view;
      switchView(view);
    });
  });

  // Default view
  switchView('editor');
}

function switchView(view) {
  State.set('ui.activeView', view);

  // Update nav icons
  $$('#nav-column .nav-icon[data-view]').forEach(icon => {
    icon.classList.toggle('active', icon.dataset.view === view);
  });

  // Show/hide views
  const editorView = $('#editor-view');
  const versionView = $('#version-view');
  const chatPanel = $('#chat-panel');

  if (editorView) editorView.classList.toggle('active', view === 'editor' || view === 'chat');
  if (editorView) editorView.classList.toggle('hidden', view === 'history');
  if (versionView) versionView.classList.toggle('active', view === 'history');
  if (chatPanel) chatPanel.classList.toggle('collapsed', view === 'history');
}

function wireTopbar() {
  // Diff toggle
  $('#btn-diff-toggle')?.addEventListener('click', () => {
    if (State.get('ui.diffActive')) {
      closeDiffView();
    } else {
      const hasCandidate = State.get('doc.candidateContent');
      if (!hasCandidate) {
        toast('请先在对话中点击「应用为候选修改」生成候选内容');
        return;
      }
      openDiffView();
    }
  });

  // Settings
  $('#btn-settings')?.addEventListener('click', openSettings);

  // Ruleset change
  $('#ruleset-select')?.addEventListener('change', (e) => {
    toast('已切换规则集：' + e.target.selectedOptions[0].text);
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K → command palette (future)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      // Future: open command palette
    }

    // Global Esc handling
    if (e.key === 'Escape') {
      if (State.get('ui.modLogOpen') && !State.get('ui.modLogPinned')) {
        // mod-log handles its own Esc
      } else if (State.get('ui.settingsOpen')) {
        // settings handles its own Esc
      }
    }
  });
}

function autoOrganize() {
  if (!confirm('将按规则集重排模块顺序。\n\n预览：frontmatter → Instructions → Output Format → Examples → References\n\n确认应用？')) return;
  toast('✨ 已按规则集自动整理模块顺序');
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);

// ── Expose globals for inline handlers ──
window.acceptAll = acceptAll;
window.rejectAll = rejectAll;
window.openSettings = openSettings;
window.toggleDiffView = () => {
  if (State.get('ui.diffActive')) closeDiffView();
  else openDiffView();
};

// Switch to chat view (called by selection toolbar)
window._switchToChat = () => {
  switchView('chat');
  // Expand chat panel if collapsed
  const chatPanel = document.getElementById('chat-panel');
  if (chatPanel) chatPanel.classList.remove('collapsed');
};
