import { useStore } from '../../store/useStore';
import { FileUp, FolderTree, Send } from 'lucide-react';

/**
 * 首次打开 / 无最近编辑记录时的引导欢迎页。
 * 仅渲染于编辑器区域（code-pane 内），不超出区域、不影响其他元素布局。
 */
export default function WelcomeGuide() {
  const setEditingFile = useStore(s => s.setEditingFile);
  const setActiveView = useStore(s => s.setActiveView);

  const steps = [
    { icon: FileUp, title: '导入 Prompt 文件', desc: '从工作区导入 .md 文件，或直接编辑主文档' },
    { icon: FolderTree, title: '勾选工作区范围', desc: '把相关文件/模块组合为范围，锁定保护' },
    { icon: Send, title: '应用到 AI 对话', desc: '勾选范围并应用，AI 修改自动联动检查' },
  ];

  return (
    <div className="welcome-guide">
      <div className="wg-mark">P</div>
      <h2 className="wg-title">欢迎使用 PromptStudio</h2>
      <p className="wg-sub">选择一个内容开始编辑，或按以下步骤搭建你的工作区</p>

      <div className="wg-steps">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="wg-step">
              <div className="wg-step-icon"><Icon size={16} /></div>
              <div className="wg-step-info">
                <div className="wg-step-title">{i + 1}. {s.title}</div>
                <div className="wg-step-desc">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="wg-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setEditingFile(null)}
          title="打开并编辑你的第一个 Prompt 文档"
        >
          打开主文档
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setActiveView('workspace')}
          title="前往工作区导入文件、创建范围"
        >
          前往工作区
        </button>
      </div>
    </div>
  );
}
