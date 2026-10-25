import { useStore } from '../../store/useStore';
import type { SettingsSection } from '../../store/useStore';
import { PROVIDER_TEMPLATES, CUSTOM_TEMPLATE, getTemplate } from '../../data/providers';
import {
  Shield, Check, Plug, X, Trash2, KeyRound, EyeOff, Plus, Info, Database,
  Palette, Sun, Moon, Monitor, Compass,
} from 'lucide-react';
import { useState } from 'react';
import { THEME_MODES, TOOLBAR_STYLES } from '../../lib/theme';
import { TOUR_IDS, TOUR_LABELS } from '../../lib/tours';

const SECTIONS: { id: SettingsSection; label: string; desc: string; icon: typeof Plug }[] = [
  { id: 'models', label: '模型与连接', desc: '供应商 / 模型 / Key', icon: Plug },
  { id: 'appearance', label: '外观', desc: '明暗 / 玻璃材质', icon: Palette },
  { id: 'privacy', label: '数据与隐私', desc: '脱敏 / 本地数据', icon: Shield },
  { id: 'about', label: '关于', desc: '版本 / 快捷键', icon: Info },
];

const APP_VERSION = 'v0.1.0';

export default function SettingsModal() {
  const selectedProviderId = useStore(s => s.selectedProviderId);
  const selectedModelName = useStore(s => s.selectedModelName);
  const apiKeyInput = useStore(s => s.apiKeyInput);
  const baseUrlOverride = useStore(s => s.baseUrlOverride);
  const connectionStatus = useStore(s => s.connectionStatus);
  const connectionMessage = useStore(s => s.connectionMessage);
  const settingsSection = useStore(s => s.settingsSection);
  const setSettingsSection = useStore(s => s.setSettingsSection);
  const themeMode = useStore(s => s.themeMode);
  const toolbarStyle = useStore(s => s.toolbarStyle);
  const setThemeMode = useStore(s => s.setThemeMode);
  const setToolbarStyle = useStore(s => s.setToolbarStyle);
  const startTour = useStore(s => s.startTour);
  const setActiveView = useStore(s => s.setActiveView);

  /** 从设置里重播：先切到对应模块，再启动，保证聚光灯能对准真实元素 */
  const replayTour = (id: typeof TOUR_IDS[number]) => {
    closeSettings();
    if (id === 'editor' || id === 'chat') setActiveView('editor');
    else if (id === 'workspace') setActiveView('workspace');
    else if (id === 'eval') setActiveView('eval');
    else if (id === 'history') setActiveView('history');
    else if (id === 'ruleset') setActiveView('ruleset');
    // diff 需要具体对比内容，无法从设置直接构造；保持居中演示
    window.setTimeout(() => startTour(id), 240);
  };

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
  const defaultModels = currentTemplate?.defaultModels ?? [];

  /** 已保存的模型名不在预设列表里 → 打开设置就直接进输入态 */
  const [customModel, setCustomModel] = useState(
    () => defaultModels.length === 0 || !defaultModels.includes(selectedModelName)
  );

  const handleProvider = (id: string) => {
    // 点已选中的供应商不应重置已输入的自定义模型名
    if (id === selectedProviderId) return;
    setProvider(id);
    setCustomModel(false);
  };

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
      <div className="settings-dialog settings-center animate-scaleIn">
        {/* Header */}
        <div className="settings-header">
          <div>
            <span className="sd-title">设置</span>
            <div className="sd-sub">模型连接、数据与隐私，只在本机生效</div>
          </div>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={closeSettings} title="关闭设置">
            <X size={14} />
          </button>
        </div>

        <div className="settings-layout">
          {/* Left rail */}
          <nav className="settings-nav" aria-label="设置分类">
            {SECTIONS.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  className={`settings-nav-item ${settingsSection === section.id ? 'on' : ''}`}
                  onClick={() => setSettingsSection(section.id)}
                >
                  <span className="sn-icon"><Icon size={15} /></span>
                  <span className="sn-text">
                    <b>{section.label}</b>
                    <small>{section.desc}</small>
                  </span>
                </button>
              );
            })}
            <div className="settings-nav-foot">
              数据全部留在本机<br />直连厂商端点
            </div>
          </nav>

          {/* Content */}
          <div className="settings-body">
            {settingsSection === 'models' && (
              <>
                <div className="settings-section-head">
                  <h3>模型与连接</h3>
                  <p>选一个供应商，填上 Key 就能用。换模型也可以直接用顶栏的模型胶囊。</p>
                </div>

                <div className="settings-form-group">
                  <label>供应商</label>
                  <div className="provider-list">
                    {allProviders.map(p => (
                      <div
                        key={p.providerId}
                        className={`provider-card ${selectedProviderId === p.providerId ? 'active' : ''}`}
                        onClick={() => handleProvider(p.providerId)}
                      >
                        <div className="pc-icon" style={{ background: p.iconUrl ? 'transparent' : p.iconBg, color: '#fff' }}>
                          {p.iconUrl
                            ? <img src={p.iconUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : p.iconText}
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

                <div className="settings-form-group">
                  <label>模型</label>
                  {defaultModels.length > 0 && (
                    <select
                      className="inp"
                      value={customModel ? '__custom__' : selectedModelName}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          // 保留当前值：用户可直接改，也可选回预设模型
                          setCustomModel(true);
                          return;
                        }
                        setCustomModel(false);
                        setModelName(e.target.value);
                      }}
                    >
                      {defaultModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="__custom__">自定义模型名…</option>
                    </select>
                  )}
                  {(customModel || defaultModels.length === 0) && (
                    <input
                      className="inp"
                      style={defaultModels.length > 0 ? { marginTop: '6px' } : undefined}
                      value={selectedModelName}
                      onChange={(e) => setModelName(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      placeholder="输入模型名称，如 gpt-4o"
                      aria-label="自定义模型名"
                    />
                  )}
                  <div className="hint">
                    {defaultModels.length > 0
                      ? '常用模型可直接选；新发布的模型选「自定义模型名…」后输入。'
                      : '该端点没有预设模型，请直接输入模型名。'}
                  </div>
                </div>

                {currentTemplate?.auth.type === 'none' ? (
                  <div className="settings-form-group">
                    <label>API Key</label>
                    <div className="test-result success" style={{ marginTop: 0 }}>
                      ✓ 本地端点无需 API Key，将直连 {currentTemplate.baseUrl}
                    </div>
                  </div>
                ) : (
                  <div className="settings-form-group">
                    <label>API Key</label>
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
                      <div className="hint">
                        提示：Gemini 的 Key 将以 URL 参数形式发送（Google 官方鉴权方式）
                      </div>
                    )}
                  </div>
                )}

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

                <div className="settings-form-group">
                  <label>连接测试</label>
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

                <div className="security-note">
                  <Shield size={12} style={{ color: 'var(--brand-light)' }} />
                  <span>
                    API Key 使用 AES-256-GCM 加密存储于本机（WebCrypto），密钥不出设备；
                    直连厂商端点，无任何中间代理，永不上传。输入后打码显示，可"重新输入"替换。
                  </span>
                </div>
              </>
            )}

            {settingsSection === 'appearance' && (
              <>
                <div className="settings-section-head">
                  <h3>外观</h3>
                  <p>只调整明暗与材质，品牌靛蓝保持不变。设置立即生效，也会同步到编辑器与对比视图。</p>
                </div>

                <div className="settings-form-group">
                  <label>明暗模式</label>
                  <div className="theme-seg">
                    {THEME_MODES.map(mode => {
                      const Icon = mode.id === 'light' ? Sun : mode.id === 'dark' ? Moon : Monitor;
                      return (
                        <button
                          key={mode.id}
                          className={themeMode === mode.id ? 'on' : ''}
                          onClick={() => setThemeMode(mode.id)}
                        >
                          <Icon size={14} />
                          <b>{mode.label}</b>
                          <small>{mode.hint}</small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="hint">深色模式保留品牌靛蓝，只把画布、卡片和文字做低亮度适配。</div>
                </div>

                <div className="settings-form-group">
                  <label>划词工具条材质</label>
                  <div className="toolbar-style-grid">
                    {TOOLBAR_STYLES.map(style => (
                      <button
                        key={style.id}
                        className={`toolbar-style-card ${toolbarStyle === style.id ? 'on' : ''}`}
                        onClick={() => setToolbarStyle(style.id)}
                      >
                        <span className={`toolbar-preview ${style.id}`}>
                          <i />
                          <span>询问</span>
                          <span>解释</span>
                          <span className="primary">优化</span>
                        </span>
                        <b>{style.label}</b>
                        <small>{style.hint}</small>
                      </button>
                    ))}
                  </div>
                  <div className="hint">选中文字后出现的工具条；液态玻璃会带流动高光与更强折射。</div>
                </div>

                <div className="settings-form-group">
                  <label>实时预览</label>
                  <div className="appearance-stage">
                    <div className="st-toolbar st-toolbar-inline">
                      <span className="st-source">编辑器</span>
                      <span className="st-char-count">37 字符</span>
                      <span className="st-divider" />
                      <button className="st-action" type="button">询问</button>
                      <button className="st-action" type="button">解释</button>
                      <button className="st-action primary" type="button">优化</button>
                      <button className="st-action" type="button">修复</button>
                    </div>
                    <div className="appearance-stage-caption">当前：{themeMode === 'dark' ? '深色' : themeMode === 'system' ? '跟随系统' : '浅色'} · {TOOLBAR_STYLES.find(s => s.id === toolbarStyle)?.label}</div>
                  </div>
                </div>
              </>
            )}

            {settingsSection === 'privacy' && (
              <>
                <div className="settings-section-head">
                  <h3>数据与隐私</h3>
                  <p>PromptStudio 默认本地优先：没有账号、没有云端同步，所有内容留在当前浏览器。</p>
                </div>

                <div className="settings-form-group">
                  <label>发送前脱敏（AI 不可见原文）</label>
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
                    style={{ minHeight: '86px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.6 }}
                    value={termsDraft}
                    onChange={e => setTermsDraft(e.target.value)}
                    onBlur={applyTerms}
                    placeholder={'自定义敏感词条（每行一条，全局同编号替换）\n例如：\n详细指标A\nods_user_info_daily\n张某某'}
                  />
                  <div className="hint">
                    词条在多个文档中引用时同步改写为同一编号（如 SENS-001）；AI 优化完成后，在确认编辑窗口按编号还原为真实内容。
                  </div>
                </div>

                <div className="settings-divider" />

                <div className="settings-form-group">
                  <label>本地数据</label>
                  <ul className="settings-data-list">
                    <li>
                      <Database size={12} />
                      <div><b>文档 / 版本 / 对话 / 工作区 / 评测运行</b><span>IndexedDB · 仅当前浏览器</span></div>
                    </li>
                    <li>
                      <KeyRound size={12} />
                      <div><b>API Key</b><span>AES-256-GCM 加密（WebCrypto），密钥不出设备</span></div>
                    </li>
                    <li>
                      <Plus size={12} />
                      <div><b>评测用例</b><span>localStorage · 每次运行另存一份用例快照</span></div>
                    </li>
                  </ul>
                </div>

                <div className="settings-danger-zone">
                  <div>
                    <b>重置全部数据</b>
                    <p>清空本机全部数据（文档 / 版本 / 对话 / 工作区 / 导入文件 / API Key / 配置），并回到全新首次使用状态。</p>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm('重置将清空本机全部数据（文档/版本/对话/工作区/导入文件/API Key/配置），并回到全新首次使用状态。确定重置？')) {
                        void resetAllData();
                      }
                    }}
                  >
                    重置全部数据
                  </button>
                </div>
              </>
            )}

            {settingsSection === 'about' && (
              <>
                <div className="settings-section-head">
                  <h3>关于 PromptStudio</h3>
                  <p>本地优先的 Prompt 工作台：编辑、对话改稿、diff 审阅、版本时间线与可复现的评测闭环。</p>
                </div>

                <div className="settings-about-grid">
                  <div><b>{APP_VERSION}</b><span>当前版本</span></div>
                  <div><b>本地优先</b><span>无账号 / 无中间代理</span></div>
                  <div><b>7 类断言</b><span>确定性判定 + AI 评分</span></div>
                </div>

                <div className="settings-form-group">
                  <label>快捷键</label>
                  <ul className="settings-kbd-list">
                    <li><kbd>N</kbd><span>下一个变更</span></li>
                    <li><kbd>P</kbd><span>上一个变更</span></li>
                    <li><kbd>A</kbd><span>接受当前变更</span></li>
                    <li><kbd>R</kbd><span>拒绝当前变更</span></li>
                    <li><kbd>Enter</kbd><span>打开修改说明</span></li>
                  </ul>
                  <div className="hint">快捷键在对比审阅（diff）视图内生效。</div>
                </div>

                <div className="settings-divider" />

                <div className="settings-form-group">
                  <label>功能引导</label>
                  <div className="settings-tour-list">
                    {TOUR_IDS.map(id => (
                      <div key={id} className="settings-tour-row">
                        <span>{TOUR_LABELS[id]}</span>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => replayTour(id)}
                        >
                          <Compass size={11} /> 重播
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="hint">每个模块首次打开会自动播放一次；模块右上角的「?」也可以随时重播。</div>
                </div>

                <div className="settings-divider" />

                <div className="settings-form-group">
                  <label>技术栈</label>
                  <div className="settings-stack">
                    React 18 · TypeScript · Vite · Zustand · Dexie · CodeMirror 6
                  </div>
                  <div className="hint">
                    所有模型调用由浏览器直连厂商 API；评测的 token / 成本为估算值，UI 已标注「估」。
                  </div>
                </div>

                <div className="security-note">
                  <Shield size={12} style={{ color: 'var(--brand-light)' }} />
                  <span>纯网页环境无法访问系统凭据库；桌面版会提供更强的本地保护。</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          {settingsSection === 'models' ? (
            <>
              <span className="settings-footer-hint">Key 加密保存在本机，不会上传</span>
              <button className="btn btn-ghost btn-sm" onClick={closeSettings}>取消</button>
              <button className="btn btn-primary btn-sm" onClick={doSaveSettings}>
                保存设置
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={closeSettings}>完成</button>
          )}
        </div>
      </div>
    </div>
  );
}
