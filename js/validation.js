/* ============================================================
   PROMPTSTUDIO — Validation Engine
   Rule checking + panel rendering
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { RULES } from './data.js';
import { escapeHtml } from './utils.js';

const dom = {};

export function initValidation() {
  dom.panel = document.getElementById('validation-panel');
  dom.count = document.getElementById('validation-count');
  dom.editor = document.getElementById('editor');

  // Listen for content changes
  Events.on('editor:content-changed', () => runValidation());
  Events.on('ruleset:changed', () => runValidation());

  // Initial run
  setTimeout(runValidation, 100);
}

export function runValidation() {
  const editor = document.getElementById('editor');
  const content = editor ? editor.value : State.get('doc.content') || '';
  const rulesetKey = document.getElementById('ruleset-select')?.value || 'anthropic';
  const ruleset = RULES[rulesetKey] || RULES.anthropic;

  const results = [];
  const allRules = [...(ruleset.structure || []), ...(ruleset.format || []), ...(ruleset.style || [])];

  allRules.forEach(rule => {
    try {
      if (!rule.check(content)) {
        results.push({
          ...rule,
          loc: guessLocation(content, rule.msg),
        });
      }
    } catch (e) {
      // Rule check threw — skip
    }
  });

  State.set('validation.results', results);
  renderValidation(results);
}

function guessLocation(content, msg) {
  if (msg.includes('frontmatter')) return 'L1-5';
  if (msg.includes('Instructions')) return '~L10';
  if (msg.includes('代码块')) {
    const idx = content.indexOf('```');
    if (idx >= 0) {
      const lineNum = content.slice(0, idx).split('\n').length;
      return 'L' + lineNum;
    }
  }
  return '';
}

function renderValidation(results) {
  if (!dom.panel || !dom.count) return;

  const errors = results.filter(r => r.level === 'error');
  const warnings = results.filter(r => r.level === 'warning');
  const infos = results.filter(r => r.level === 'info');

  if (results.length === 0) {
    dom.panel.classList.remove('visible');
    dom.panel.innerHTML = '';
    dom.count.style.display = 'none';
    dom.count.className = '';
    return;
  }

  dom.panel.classList.add('visible');
  const parts = [];
  if (errors.length) parts.push(`${errors.length} 错误`);
  if (warnings.length) parts.push(`${warnings.length} 警告`);

  dom.count.style.display = 'flex';
  dom.count.textContent = '⚠ ' + parts.join(' · ');
  dom.count.className = errors.length ? 'has-errors' : 'has-warnings';

  dom.panel.innerHTML = results.map((r, i) => `
    <div class="validation-item ${r.level}" data-idx="${i}">
      <span class="v-icon">${r.level === 'error' ? '✕' : r.level === 'warning' ? '⚠' : 'ℹ'}</span>
      <span class="v-msg">${escapeHtml(r.msg)}</span>
      <span class="v-loc">${r.loc || ''}</span>
    </div>
  `).join('');

  // Click to jump to location
  dom.panel.querySelectorAll('.validation-item').forEach(item => {
    item.addEventListener('click', () => {
      const loc = item.querySelector('.v-loc').textContent;
      if (loc) {
        const editor = document.getElementById('editor');
        if (editor) editor.focus();
      }
    });
  });
}

export default { initValidation, runValidation };
