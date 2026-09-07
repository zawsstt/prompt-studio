import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, Settings, FileUp, FolderTree, Send, Check, ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * 新手指引弹窗（首次打开强提醒，可跳过）。
 * 步骤 1：模型 API 配置（未配置时重点指引）；步骤 2：工作区；步骤 3：编辑与 AI 对话。
 * 关闭（完成/跳过）后写入 localStorage，后续不再弹出。
 */
export default function OnboardingModal() {
  const dismissOnboarding = useStore(s => s.dismissOnboarding);
  const openSettings = useStore(s => s.openSettings);
  const apiKeyInput = useStore(s => s.apiKeyInput);
  const selectedModelName = useStore(s => s.selectedModelName);

  const [step, setStep] = useState(0);
  // 仅以「真实保存过 API Key」为准（apiKeyInput 为空字符串 = 未配置）。
  // 注意：selectedModelName 有默认值 'deepseek-chat'，绝不能作为已配置依据。
  const configured = !!apiKeyInput;

  const steps = [
    {
      icon: Settings,
      title: '接入模型供应商',
      desc: configured
        ? `已配置 ${selectedModelName || '模型'}。可在设置中随时切换供应商或修改 Key。`
        : '使用 AI 修改前，需要先接入模型供应商（API Key 仅加密存储在本机，不出设备）。',
      action: !configured ? { label: '去配置模型', onClick: () => openSettings() } : undefined,
    },
    {
      icon: FileUp,
      title: '导入文件 · 搭建工作区',
      desc: '在「工作区」导入你的 Prompt 文件（支持单文件/文件夹），勾选相关模块组成范围，可锁定保护。',
    },
    {
      icon: Send,
      title: '编辑 · 对比 · 应用',
      desc: '编辑内容 → 在「AI 对话」描述修改意图 → 生成候选 → 对比视图逐块接受/拒绝。同一范围的多个文件会联动检查引用并逐一对比。',
    },
  ];

  const finish = () => dismissOnboarding();

  return (
    <div
      className="settings-overlay"
      onClick={e => { if (e.target === e.currentTarget) finish(); }}
    >
      <div className="settings-dialog animate-scaleIn" style={{ width: 560 }}>
        <div className="settings-header">
          <span className="sd-title">👋 欢迎使用 PromptStudio</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={finish} title="跳过">
            <X size={14} />
          </button>
        </div>

        {/* 步骤指示 */}
        <div className="ob-steps">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`ob-step ${i === step ? 'cur' : i < step ? 'done' : ''}`}
              onClick={() => setStep(i)}
            >
              <i>{i < step ? '✓' : i + 1}</i>
              <span>{s.title}</span>
            </div>
          ))}
        </div>

        <div className="ob-body">
          {(() => {
            const s = steps[step];
            const Icon = s.icon;
            return (
              <div className="ob-pane" key={step}>
                <div className="ob-pane-icon"><Icon size={22} /></div>
                <div className="ob-pane-title">{s.title}</div>
                <div className="ob-pane-desc">{s.desc}</div>
                {s.action && (
                  <button className="btn btn-primary btn-sm" onClick={s.action.onClick}>
                    {s.action.label}
                  </button>
                )}
                {step === 0 && configured && (
                  <div className="ob-configured"><Check size={12} /> 模型已配置完成</div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="settings-footer">
          <button className="btn btn-ghost btn-sm" onClick={finish} style={{ marginRight: 'auto' }}>
            跳过（不再提示）
          </button>
          {step > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={12} /> 上一步
            </button>
          )}
          {step < steps.length - 1 ? (
            <button className="btn btn-primary btn-sm" onClick={() => setStep(step + 1)}>
              下一步 <ChevronRight size={12} />
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={finish}>
              开始使用 <Check size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
