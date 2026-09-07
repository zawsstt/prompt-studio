import { useStore } from '../../store/useStore';
import { PROVIDER_TEMPLATES, CUSTOM_TEMPLATE, getTemplate } from '../../data/providers';
import { Shield, Check, Plug, X, Trash2, KeyRound, EyeOff, Plus } from 'lucide-react';
import { useState } from 'react';

export default function SettingsModal() {
  const selectedProviderId = useStore(s => s.selectedProviderId);
  const selectedModelName = useStore(s => s.selectedModelName);
  const apiKeyInput = useStore(s => s.apiKeyInput);
  const baseUrlOverride = useStore(s => s.baseUrlOverride);
  const connectionStatus = useStore(s => s.connectionStatus);
  const connectionMessage = useStore(s => s.connectionMessage);

  const setProvider = useStore(s => s.setProvider);
  const setModelName = useStore(s => s.setModelName);
  const setApiKeyInput = useStore(s => s.setApiKeyInput);
  const setBaseUrlOverride = useStore(s => s.setBaseUrlOverride);
  const doTestConnection = useStore(s => s.doTestConnection);
  const doSaveSettings = useStore(s => s.doSaveSettings);
  const closeSettings = useStore(s => s.closeSettings);
  const resetAllData = useStore(s => s.resetAllData);
  const sensitiveTerms = useStore(s => s.sensitiveTerms);
  const setSensitiveTerms = useStore(s => s.setSensitiveTerms);
  const maskEnabled = useStore(s => s.maskEnabled);
  const setMaskEnabled = useStore(s => s.setMaskEnabled);
  const maskRegistry = useStore(s => s.maskRegistry);

  const currentTemplate = getTemplate(selectedProviderId);
  const allProviders = [...PROVIDER_TEMPLATES, CUSTOM_TEMPLATE];

  const step = connectionStatus === 'success' ? 4 : 3;

  // 词条编辑草稿（每行一条）
  const [termsDraft, setTermsDraft] = useState(sensitiveTerms.join('\n'));
  const applyTerms = () => {
    const terms = termsDraft.split('\n').map(t => t.trim()).filter(Boolean);
    setSensitiveTerms(terms);
  };

  return (
    <div className="settings-overlay active" onClick={(e) => {
      if (e.target === e.currentTarget) closeSettings();
    }}>
      <div className="settings-dialog animate-scaleIn">
        {/* Header */}
        <div className="settings-header">
          <span className="sd-title">⚙ 模型接入设置</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={closeSettings}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">
          {/* Step 1: Select Provider */}
          <div className="settings-form-group">
            <label>
              ① 选择供应商
            </label>
            <div className="provider-list">
              {allProviders.map(p => (
                <div
                  key={p.providerId}
                  className={`provider-card ${selectedProviderId === p.providerId ? 'active' : ''}`}
                  onClick={() => setProvider(p.providerId)}
                >
                  <div className="pc-icon" style={{ background: p.iconUrl ? 'transparent' : p.iconBg, color: '#fff' }}>
                    {p.iconUrl ? <img src={p.iconUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : p.iconText}
                  </div>
                  <div className="pc-info">
                    <div className="pc-name">{p.name}</div>
                    <div className="pc-desc">
                      {p.defaultModels.join(' / ') || '自定义端点'}
                    </div>
                  </div>
                  {selectedProviderId === p.providerId && (
                    <Check size={16} style={{ color: 'var(--brand-light)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="settings-divider" />

          {/* Step 2: Model Name */}
          <div className="settings-form-group">
            <label>② 选择 / 输入模型名</label>
            {currentTemplate && currentTemplate.defaultModels.length > 0 ? (
              <select
                className="inp"
                value={selectedModelName}
                onChange={(e) => setModelName(e.target.value)}
              >
                {currentTemplate.defaultModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="">自定义模型名…</option>
              </select>
            ) : (
              <input
                className="inp"
                value={selectedModelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="输入模型名称，如 gpt-4o"
              />
            )}
            {selectedModelName && !currentTemplate?.defaultModels.includes(selectedModelName) && (
              <input
                className="inp"
                style={{ marginTop: '4px' }}
                value={selectedModelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="自定义模型名"
              />
            )}
          </div>

          {/* Step 3: API Key */}
          {currentTemplate?.auth.type === 'none' ? (
            <div className="settings-form-group">
              <label>③ API Key</label>
              <div className="test-result success" style={{ marginTop: 0 }}>
                ✓ 本地 Ollama 无需 API Key，将直连 {currentTemplate.baseUrl}
              </div>
            </div>
          ) : (
            <div className="settings-form-group">
              <label>③ 粘贴 API Key</label>
              <div className="key-row">
                <input
                  className="inp"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="粘贴 API Key（不会明文回显）"
                />
                {apiKeyInput && (
                  <button
                    className="btn btn-ghost btn-xs key-clear"
                    onClick={() => setApiKeyInput('')}
                    title="清除已保存的 API Key（保存设置后生效）"
                  >
                    <Trash2 size={12} /> 清除
                  </button>
                )}
              </div>
              {apiKeyInput.includes('•') ? (
                <div className="key-status configured">
                  <KeyRound size={11} /> 已保存（AES-256-GCM 加密于本机）· 可重新输入替换，或点「清除」
                </div>
              ) : (
                <div className="key-status empty">尚未保存 API Key</div>
              )}
              {currentTemplate?.auth.type === 'query-key' && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  提示：Gemini 的 Key 将以 URL 参数形式发送（Google 官方鉴权方式）
                </div>
              )}
            </div>
          )}

          {/* Base URL override (for custom) */}
          {selectedProviderId === 'custom' && (
            <div className="settings-form-group">
              <label>Base URL（OpenAI 兼容端点）</label>
              <input
                className="inp"
                value={baseUrlOverride}
                onChange={(e) => setBaseUrlOverride(e.target.value)}
                placeholder="https://your-endpoint.com/v1"
              />
            </div>
          )}

          {/* Step 4: Test Connection */}
          <div className="settings-form-group">
            <label>④ 测试连接</label>
            <button
              className="btn btn-secondary btn-sm"
              onClick={doTestConnection}
              disabled={connectionStatus === 'testing'}
              style={{ alignSelf: 'flex-start' }}
            >
              {connectionStatus === 'testing' ? (
                <><span className="ps-spinner" /> 测试中...</>
              ) : (
                <><Plug size={12} /> 测试连接</>
              )}
            </button>
            {connectionMessage && (
              <div className={`test-result ${connectionStatus}`}>
                {connectionStatus === 'success' && '✓ '}
                {connectionStatus === 'error' && '✗ '}
                {connectionMessage}
              </div>
            )}
          </div>

          {/* Step 5: Sensitive Data Sanitization */}
          <div className="settings-divider" />
          <div className="settings-form-group">
            <label>⑤ 敏感数据脱敏（AI 不可见原文）</label>
            <div className="key-row">
              <button
                className={`btn btn-sm ${maskEnabled ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setMaskEnabled(!maskEnabled)}
                title="发送给 AI 前按编号替换敏感数据，确认修改时还原"
              >
                <EyeOff size={12} /> {maskEnabled ? '脱敏已开启' : '脱敏已关闭'}
              </button>
              <span className="key-status" style={maskEnabled ? { color: 'var(--success)' } : {}}>
                {maskEnabled
                  ? (maskRegistry ? `本会话已建立 ${maskRegistry.byId.size} 条编号映射` : '发送消息时自动建立编号映射')
                  : '开启后：SQL 底表名 / 手机号 / 身份证 / 邮箱 / 内网 IP 与自定义词条将被编号替换'}
              </span>
            </div>
            <textarea
              className="inp"
              style={{ minHeight: '72px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.6 }}
              value={termsDraft}
              onChange={e => setTermsDraft(e.target.value)}
              onBlur={applyTerms}
              placeholder={'自定义敏感词条（每行一条，全局同编号替换）\n例如：\n详细指标A\nods_user_info_daily\n张某某'}
            />
            <div className="hint">
              词条在多个文档中引用时同步改写为同一编号（如 SENS-001）；AI 优化完成后，在确认编辑窗口按编号还原为真实内容，全程 AI 不可见原文。
            </div>
          </div>

          {/* Security Note */}
          <div className="security-note">
            <Shield size={12} style={{ color: 'var(--brand-light)' }} />
            <span>
              API Key 使用 AES-256-GCM 加密存储于本机（WebCrypto），密钥不出设备；
              纯网页环境无法访问系统凭据库，桌面版将提供更强保护。
              <strong>直连厂商端点，无任何中间代理，永不上传。</strong>
              输入后打码显示，可"重新输入"替换。
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button
            className="btn btn-danger btn-sm"
            style={{ marginRight: 'auto' }}
            onClick={() => {
              if (confirm('重置将清空本机全部数据（文档/版本/对话/工作区/导入文件/API Key/配置），并回到全新首次使用状态。确定重置？')) {
                void resetAllData();
              }
            }}
          >
            重置全部数据
          </button>
          <button className="btn btn-ghost btn-sm" onClick={closeSettings}>取消</button>
          <button className="btn btn-primary btn-sm" onClick={doSaveSettings}>
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
