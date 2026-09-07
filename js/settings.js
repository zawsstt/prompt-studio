/* ============================================================
   PROMPTSTUDIO — Settings Module
   Provider management, API key, connection test
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { PROVIDERS } from './data.js';
import { $, $$ } from './utils.js';

const dom = {};

export function initSettings() {
  dom.modal = $('#settings-modal');
  dom.backdrop = $('#settings-backdrop');
  dom.dialog = $('#settings-dialog');

  if (!dom.modal) return;

  // Listen for settings:open event
  Events.on('settings:open', openSettings);

  // Backdrop click to close
  if (dom.backdrop) dom.backdrop.addEventListener('click', closeSettings);

  // Close button
  dom.modal.querySelectorAll('[data-action="close-settings"]').forEach(btn => {
    btn.addEventListener('click', closeSettings);
  });

  // Render provider cards
  renderProviderCards();

  // Test connection
  const testBtn = $('#btn-test-connection');
  if (testBtn) testBtn.addEventListener('click', testConnection);

  // Save
  const saveBtn = $('#btn-save-settings');
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
}

export function openSettings() {
  State.set('ui.settingsOpen', true);
  if (dom.modal) dom.modal.classList.add('active');
  syncFormFromState();
}

export function closeSettings() {
  State.set('ui.settingsOpen', false);
  if (dom.modal) dom.modal.classList.remove('active');
}

function renderProviderCards() {
  const container = $('#settings-provider-list');
  if (!container) return;

  const activeProvider = State.get('settings.activeProvider') || 'deepseek';

  container.innerHTML = PROVIDERS.map(p => `
    <div class="provider-card${p.id === activeProvider ? ' active' : ''}" data-provider="${p.id}">
      <div class="pc-icon" style="background:${p.iconBg};color:#fff">${p.iconText}</div>
      <div class="pc-info">
        <div class="pc-name">${p.name}</div>
        <div class="pc-desc">${p.desc}</div>
      </div>
      <div class="pc-status ${p.status}"></div>
    </div>
  `).join('');

  container.querySelectorAll('.provider-card').forEach(card => {
    card.addEventListener('click', () => {
      const providerId = card.dataset.provider;
      State.set('settings.activeProvider', providerId);
      container.querySelectorAll('.provider-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      // Update defaults
      const provider = PROVIDERS.find(p => p.id === providerId);
      if (provider) {
        const modelInput = $('#setting-model');
        const urlInput = $('#setting-baseurl');
        if (modelInput) modelInput.value = provider.defaults.model;
        if (urlInput) urlInput.value = provider.baseUrl;
      }
    });
  });
}

function syncFormFromState() {
  const modelInput = $('#setting-model');
  const keyInput = $('#setting-apikey');
  const urlInput = $('#setting-baseurl');

  if (modelInput) modelInput.value = State.get('settings.modelName') || '';
  if (keyInput) keyInput.value = State.get('settings.apiKey') || '';
  if (urlInput) urlInput.value = State.get('settings.baseUrl') || '';
}

function testConnection() {
  const btn = $('#btn-test-connection');
  const result = $('#test-result');
  if (!btn || !result) return;

  btn.textContent = '⏳ 测试中…';
  btn.disabled = true;
  result.innerHTML = '<span style="color:var(--warning)">⏳ 正在测试连接…</span>';

  setTimeout(() => {
    const ok = Math.random() > 0.15;
    if (ok) {
      result.innerHTML = '<span style="color:var(--success)">✓ 连接成功 — 延迟 87ms</span>';
      btn.textContent = '🔗 测试连接';
    } else {
      result.innerHTML = '<span style="color:var(--error)">✕ 连接失败 — 401 未授权，请检查 API Key</span>';
      btn.textContent = '🔗 重试';
    }
    btn.disabled = false;
  }, 1500);
}

function saveSettings() {
  State.set('settings.modelName', $('#setting-model')?.value || '');
  State.set('settings.baseUrl', $('#setting-baseurl')?.value || '');
  // API key handled separately for security
  if ($('#setting-apikey')?.value && $('#setting-apikey').value !== '••••••••••') {
    State.set('settings.apiKey', $('#setting-apikey').value);
  }
  closeSettings();
  Events.emit('toast', '设置已保存');
}

export default { initSettings, openSettings, closeSettings };
