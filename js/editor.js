/* ============================================================
   PROMPTSTUDIO — Editor Module
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { debounce } from './utils.js';

const dom = {};

export function initEditor() {
  dom.editor = document.getElementById('editor');
  dom.validationCount = document.getElementById('validation-count');
  dom.validationPanel = document.getElementById('validation-panel');
  dom.rulesetSelect = document.getElementById('ruleset-select');

  if (!dom.editor) return;

  // Set initial content
  dom.editor.value = State.get('doc.content') || '';

  // Input handler with debounced validation
  const handleInput = debounce(() => {
    const content = dom.editor.value;
    State.set('doc.content', content);
    Events.emit('editor:content-changed', { content });
  }, 500);

  dom.editor.addEventListener('input', handleInput);

  // Ruleset change
  if (dom.rulesetSelect) {
    dom.rulesetSelect.addEventListener('change', () => {
      Events.emit('ruleset:changed', { ruleset: dom.rulesetSelect.value });
    });
  }

  // Subscribe to external content changes (e.g., version rollback)
  State.subscribe('doc.content', (content) => {
    if (content !== dom.editor.value) {
      dom.editor.value = content;
    }
  });
}

export function getEditorContent() {
  return dom.editor ? dom.editor.value : '';
}

export function setEditorContent(content) {
  State.set('doc.content', content);
  if (dom.editor) dom.editor.value = content;
}

export default { initEditor, getEditorContent, setEditorContent };
