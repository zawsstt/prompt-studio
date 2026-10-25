// ── Model quick switcher (top bar pill) ──
//
// 顶栏胶囊不再直接打开完整设置，而是给一个轻量速切面板：
// 选供应商 → 点模型 → 立即生效并持久化；Key 状态就地可见。
// 真正需要配置端点/Key/Base URL 时，再进「模型与连接」设置。

import { useEffect, useRef, useState } from 'react';
import { Check, KeyRound, X } from 'lucide-react';
import { PROVIDER_TEMPLATES, CUSTOM_TEMPLATE, getTemplate } from '../../data/providers';
import type { ProviderTemplate } from '../../types';
import { useStore } from '../../store/useStore';

const PROVIDERS: ProviderTemplate[] = [...PROVIDER_TEMPLATES, CUSTOM_TEMPLATE];

function ProviderIcon({ provider, size = 18 }: { provider: ProviderTemplate; size?: number }) {
  return (
    <span
      className="mq-picon"
      style={{
        width: size,
        height: size,
        background: provider.iconUrl ? 'transparent' : provider.iconBg,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {provider.iconUrl
        ? <img src={provider.iconUrl} alt="" />
        : provider.iconText}
    </span>
  );
}

export default function ModelQuickMenu({ onClose }: { onClose: () => void }) {
  const selectedProviderId = useStore(s => s.selectedProviderId);
  const selectedModelName = useStore(s => s.selectedModelName);
  const apiKeyInput = useStore(s => s.apiKeyInput);
  const quickSwitchModel = useStore(s => s.quickSwitchModel);
  const loadProviderKeyStatus = useStore(s => s.loadProviderKeyStatus);
  const openSettings = useStore(s => s.openSettings);

  const [activeProviderId, setActiveProviderId] = useState(selectedProviderId);
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [customModel, setCustomModel] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void loadProviderKeyStatus().then(map => { if (alive) setKeyStatus(map); });

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!ref.current) return;
      if (ref.current.contains(target as Node)) return;
      // 胶囊自己负责 toggle，不在这里关
      if (target?.closest?.('.model-pill')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [loadProviderKeyStatus, onClose]);

  const activeTemplate = getTemplate(activeProviderId);
  const activeProviderName = activeTemplate?.name ?? '供应商';
  const currentProviderName = getTemplate(selectedProviderId)?.name ?? selectedProviderId;
  const currentKeyReady = keyStatus[selectedProviderId]
    ?? (!!apiKeyInput && !apiKeyInput.includes('•'));

  const switchTo = async (providerId: string, modelName: string) => {
    await quickSwitchModel(providerId, modelName);
    onClose();
  };

  const activeKeyReady = keyStatus[activeProviderId];
  const isCustomEndpoint = (activeTemplate?.defaultModels.length ?? 0) === 0;

  return (
    <div className="mq-menu" ref={ref} role="dialog" aria-label="快速切换模型">
      <div className="mq-head">
        <span className="mq-title">快速切换模型</span>
        <button className="btn btn-icon btn-ghost btn-xs" onClick={onClose} title="关闭">
          <X size={12} />
        </button>
      </div>

      <div className="mq-current">
        <span className={`mq-dot ${currentKeyReady ? 'ok' : ''}`} />
        <span className="mq-current-main">
          <b>{currentProviderName}</b>
          <span>{selectedModelName || '未选择模型'}</span>
        </span>
        <span className={`mq-key ${currentKeyReady ? 'ok' : ''}`}>
          {currentKeyReady ? 'Key 已配置' : '未配置 Key'}
        </span>
      </div>

      <div className="mq-sec">供应商</div>
      <div className="mq-providers">
        {PROVIDERS.map(p => (
          <button
            key={p.providerId}
            className={`mq-provider ${activeProviderId === p.providerId ? 'on' : ''}`}
            onClick={() => setActiveProviderId(p.providerId)}
            title={p.name}
          >
            <ProviderIcon provider={p} />
            <span className="mq-provider-name">{p.name}</span>
            {keyStatus[p.providerId] && <Check size={10} className="mq-provider-ok" />}
          </button>
        ))}
      </div>

      <div className="mq-sec">
        {activeProviderName} 的模型
        {activeKeyReady === false && (
          <button
            className="mq-config-link"
            onClick={() => { onClose(); void openSettings('models'); }}
          >
            配置 Key
          </button>
        )}
      </div>

      {isCustomEndpoint ? (
        <div className="mq-custom">
          <input
            className="ws-input"
            value={customModel}
            onChange={e => setCustomModel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customModel.trim()) void switchTo(activeProviderId, customModel);
            }}
            placeholder="输入模型名，如 glm-5.3"
            aria-label="快速切换自定义模型名"
          />
          <button
            className="btn btn-primary btn-xs"
            disabled={!customModel.trim()}
            onClick={() => void switchTo(activeProviderId, customModel)}
          >
            切换
          </button>
        </div>
      ) : (
        <div className="mq-models">
          {activeTemplate?.defaultModels.map(model => {
            const current = activeProviderId === selectedProviderId && model === selectedModelName;
            return (
              <button
                key={model}
                className={`mq-model ${current ? 'on' : ''}`}
                onClick={() => void switchTo(activeProviderId, model)}
                title={current ? '当前模型' : `切换到 ${model}`}
              >
                <span className="mq-model-name">{model}</span>
                {current && <Check size={12} />}
              </button>
            );
          })}
        </div>
      )}

      <div className="mq-foot">
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => { onClose(); void openSettings('models'); }}
        >
          <KeyRound size={11} /> 模型与连接设置
        </button>
        <span className="mq-foot-hint">点模型立即生效</span>
      </div>
    </div>
  );
}
