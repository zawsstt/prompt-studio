import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import AppShell from './components/Layout/AppShell';
import ModLogTab from './components/ModLog/ModLogTab';
import SettingsModal from './components/Settings/SettingsModal';
import ConfirmDialog from './components/shared/ConfirmDialog';
import OnboardingModal from './components/shared/OnboardingModal';
import RulesetImportModal from './components/Ruleset/RulesetImportModal';
import ModuleTour from './components/shared/ModuleTour';
import { applyTheme, applyToolbarStyle } from './lib/theme';
import { GripVertical } from 'lucide-react';
import { ToastContainer, toast } from './components/shared/Toast';

/**
 * Two-column before/after module order comparison for the auto-organize
 * preview (P1-3). "整理后" 列表支持拖拽手柄自定义排序（用户批注需求），
 * 调整后的顺序写回 store，确认时按新顺序重排文档。
 */
function OrganizeOrderCompare({ before, after }: { before: string[]; after: string[] }) {
  const beforeIndex = new Map(before.map((name, i) => [name, i]));
  const setOrganizePreviewAfter = useStore(s => s.setOrganizePreviewAfter);
  const [items, setItems] = useState(after);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    setItems(next);
    setOrganizePreviewAfter(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="confirm-compare">
      <div className="confirm-col">
        <div className="confirm-col-title">整理前</div>
        <ol className="confirm-order-list">
          {before.map((name, i) => (
            <li key={`before-${name}-${i}`}>{name}</li>
          ))}
        </ol>
      </div>
      <div className="confirm-col">
        <div className="confirm-col-title">
          整理后
          <span className="confirm-col-hint">拖拽手柄可自定义顺序</span>
        </div>
        <ol className="confirm-order-list">
          {items.map((name, i) => (
            <li
              key={`after-${name}-${i}`}
              className={[
                beforeIndex.get(name) !== i ? 'confirm-moved' : '',
                dragIdx === i ? 'dragging' : '',
                overIdx === i && dragIdx !== null && dragIdx !== i ? 'drag-over' : '',
              ].filter(Boolean).join(' ')}
              draggable
              onDragStart={(e) => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIdx(i);
              }}
              onDragLeave={() => setOverIdx(cur => (cur === i ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(i);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setOverIdx(null);
              }}
              title="拖拽调整顺序"
            >
              <span className="drag-handle">
                <GripVertical size={11} />
              </span>
              <span>{name}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function App() {
  const init = useStore(s => s.init);
  const diffActive = useStore(s => s.diffActive);
  const settingsOpen = useStore(s => s.settingsOpen);
  const organizePreview = useStore(s => s.organizePreview);
  const confirmAutoOrganize = useStore(s => s.confirmAutoOrganize);
  const cancelAutoOrganize = useStore(s => s.cancelAutoOrganize);
  const showOnboarding = useStore(s => s.showOnboarding);
  const themeMode = useStore(s => s.themeMode);
  const toolbarStyle = useStore(s => s.toolbarStyle);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 发版清理入口：?reset=1 → 清空全部本地数据并回到首次使用（先清参数防 reload 循环）
    if (new URLSearchParams(location.search).get('reset') === '1') {
      history.replaceState(null, '', location.pathname);
      void useStore.getState().resetAllData();
      return;
    }
    init().finally(() => {
      // 官网入口（promptstudio.html ?first=1）：init() 内部已隔离到独立演示 docId 并
      // 跳过全部历史恢复（模型配置/Key/版本/对话/工作区/导入文件），状态已是「全新首次使用」。
      // 这里只需清掉地址栏参数，避免刷新后重复触发或参数常驻。
      if (new URLSearchParams(location.search).get('first') === '1') {
        history.replaceState(null, '', location.pathname);
      }
      setReady(true);
    });
  }, [init]);

  // 主题：明暗模式 + 划词工具条材质（跟随系统时监听系统切换）
  useEffect(() => {
    applyTheme(themeMode);
    applyToolbarStyle(toolbarStyle);
    if (themeMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themeMode, toolbarStyle]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Diff shortcuts
      if (diffActive) {
        const modLogOpen = useStore.getState().modLogOpen;
        if (modLogOpen) return;

        switch (e.key) {
          case 'n': case 'N':
            e.preventDefault();
            useStore.getState().nextChange();
            break;
          case 'p': case 'P':
            e.preventDefault();
            useStore.getState().prevChange();
            break;
          case 'a': case 'A':
            e.preventDefault();
            useStore.getState().acceptChange(useStore.getState().currentChangeIdx);
            break;
          case 'r': case 'R':
            e.preventDefault();
            useStore.getState().rejectChange(useStore.getState().currentChangeIdx);
            break;
          case 'Enter':
            e.preventDefault();
            useStore.getState().toggleModLog(true);
            useStore.getState().setModLogChange(useStore.getState().currentChangeIdx);
            break;
        }
      }

      // Esc to close mod log
      if (e.key === 'Escape') {
        const s = useStore.getState();
        if (s.modLogOpen && !s.modLogPinned) {
          s.toggleModLog(false);
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [diffActive]);

  // Brand spec §6.1: app init = three brand-dot staggered pulse
  // NOTE: keep after ALL hooks — conditional return between hooks breaks
  // the Rules of Hooks and crashes the app ("Rendered more hooks than...").
  if (!ready) {
    return (
      <div className="boot-loader" aria-label="加载中">
        <span className="brand-dot" />
        <span className="brand-dot" />
        <span className="brand-dot" />
      </div>
    );
  }

  return (
    <>
      {/* Brand spec §7: desktop-first notice below 1024px (CSS media query controls visibility) */}
      <div className="viewport-notice">
        <span className="brand-dot" />
        PromptStudio 为桌面工作台设计，建议窗口宽度 ≥1024px
      </div>
      <AppShell />
      <ModLogTab />
      <ModuleTour />
      {showOnboarding && <OnboardingModal />}
      {settingsOpen && <SettingsModal />}
      <RulesetImportModal />
      {organizePreview && (
        <ConfirmDialog
          title="自动整理模块顺序"
          confirmText="确认整理"
          cancelText="取消"
          onConfirm={() => { void confirmAutoOrganize(); }}
          onCancel={cancelAutoOrganize}
        >
          <OrganizeOrderCompare before={organizePreview.before} after={organizePreview.after} />
        </ConfirmDialog>
      )}
      <ToastContainer />
    </>
  );
}

// Export toast for use in components
export { toast };
