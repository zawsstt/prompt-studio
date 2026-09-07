/* ============================================================
   PROMPTSTUDIO — Model Selector Dropdown
   Rich dropdown with provider icons, model names, and descriptions
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { MODEL_LIST, PROVIDERS } from './data.js';
import { escapeHtml } from './utils.js';

let dropdownEl = null;
let triggerEl = null;
let isOpen = false;

export function initModelSelector() {
  triggerEl = document.getElementById('model-selector-trigger');
  dropdownEl = document.getElementById('model-dropdown');

  if (!triggerEl || !dropdownEl) return;

  // Render dropdown content
  renderDropdown();

  // Toggle on trigger click
  triggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !dropdownEl.contains(e.target) && !triggerEl.contains(e.target)) {
      closeDropdown();
    }
  });

  // Update trigger display when model changes
  State.subscribe('chat.selectedModel', updateTrigger);

  // Initial trigger display
  updateTrigger();
}

function renderDropdown() {
  // Group models by provider
  const grouped = {};
  MODEL_LIST.forEach(m => {
    if (!grouped[m.provider]) grouped[m.provider] = [];
    grouped[m.provider].push(m);
  });

  let html = '';
  Object.entries(grouped).forEach(([providerId, models]) => {
    const provider = PROVIDERS.find(p => p.id === providerId);
    const providerName = provider ? provider.name : providerId;

    html += `<div class="model-dropdown-section">${escapeHtml(providerName)}</div>`;

    models.forEach(model => {
      const isActive = State.get('chat.selectedModel') === model.id;
      html += `
        <div class="model-option${isActive ? ' active' : ''}" data-model="${escapeHtml(model.id)}">
          <div class="mo-icon" style="background:${provider?.iconBg || '#555'};color:#fff">${provider?.iconText || '?'}</div>
          <div class="mo-info">
            <div class="mo-name">${escapeHtml(model.name)}</div>
            <div class="mo-desc">${escapeHtml(model.desc)}</div>
          </div>
          <div class="mo-check">✓</div>
        </div>
      `;
    });
  });

  // Footer
  html += `
    <div class="model-dropdown-footer">
      <button class="btn btn-ghost btn-xs" id="dropdown-settings-link">⚙ 管理模型接入…</button>
    </div>
  `;

  dropdownEl.innerHTML = html;

  // Bind click handlers
  dropdownEl.querySelectorAll('.model-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const modelId = opt.dataset.model;
      selectModel(modelId);
    });
  });

  // Settings link
  const settingsLink = dropdownEl.querySelector('#dropdown-settings-link');
  if (settingsLink) {
    settingsLink.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
      Events.emit('settings:open');
    });
  }
}

function selectModel(modelId) {
  State.set('chat.selectedModel', modelId);

  // Update UI
  dropdownEl.querySelectorAll('.model-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.model === modelId);
  });

  closeDropdown();
  Events.emit('model:changed', { modelId });
}

function updateTrigger() {
  if (!triggerEl) return;
  const modelId = State.get('chat.selectedModel') || 'deepseek-chat';
  const model = MODEL_LIST.find(m => m.id === modelId);
  const provider = PROVIDERS.find(p => p.id === model?.provider);

  triggerEl.innerHTML = `
    <span class="model-icon" style="background:${provider?.iconBg || '#555'};color:#fff">${provider?.iconText || '?'}</span>
    <span>${escapeHtml(model?.name || modelId)}</span>
    <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
  `;
}

function toggleDropdown() {
  if (isOpen) closeDropdown();
  else openDropdown();
}

function openDropdown() {
  dropdownEl.classList.add('open');
  isOpen = true;
}

function closeDropdown() {
  dropdownEl.classList.remove('open');
  isOpen = false;
}

export default { initModelSelector };
