import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { RULESETS } from '../../data/rulesets';
import NavColumn from './NavColumn';
import TopBar from './TopBar';
import CodeEditor from '../Editor/CodeEditor';
import WelcomeGuide from '../Editor/WelcomeGuide';
import ValidationPanel from '../Editor/ValidationPanel';
import ChatPanel from '../Chat/ChatPanel';
import DiffView from '../Diff/DiffView';
import VersionTimeline from '../Version/VersionTimeline';
import WorkspaceScope from '../Workspace/WorkspaceScope';
import RulesetManager from '../Ruleset/RulesetManager';
import { FileText, ArrowLeft, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';

export default function AppShell() {
  const activeView = useStore(s => s.activeView);
  const showEditor = activeView !== 'history' && activeView !== 'workspace' && activeView !== 'ruleset';
  const showChat = activeView === 'chat' || activeView === 'editor';
  const diffActive = useStore(s => s.diffActive);
  const rulesetId = useStore(s => s.rulesetId);
  const customRulesets = useStore(s => s.customRulesets);
  const validationIssues = useStore(s => s.validationIssues);
  const docContent = useStore(s => s.docContent);
  const editingFilePath = useStore(s => s.editingFilePath);
  const importedFiles = useStore(s => s.importedFiles);
  const setEditingFile = useStore(s => s.setEditingFile);
  const scopeSyncIssues = useStore(s => s.scopeSyncIssues);
  const fileValidationIssues = useStore(s => s.fileValidationIssues);
  const showWelcome = useStore(s => s.showWelcome);

  // 对话框宽度自由拖拽调整逻辑（默认 420px，极限边界 300px ~ 760px）
  const [chatWidth, setChatWidth] = useState(420);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(420);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = chatWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      // 向左拖动增加宽度，向右拖动缩小宽度
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, 300), 760);
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [chatWidth]);

  const editingFile = editingFilePath ? importedFiles.find(f => f.path === editingFilePath) : null;
  const rulesetName =
    RULESETS[rulesetId]?.name ?? customRulesets.find(rs => rs.id === rulesetId)?.name ?? '规则集';
  const activeIssues = editingFilePath ? fileValidationIssues : validationIssues;
  const errorCount = activeIssues.filter(i => i.severity === 'error').length;
  const warnCount = activeIssues.filter(i => i.severity === 'warning').length;
  const lineCount = editingFile ? editingFile.content.split('\n').length : (docContent ? docContent.split('\n').length : 0);

  return (
    <div className="app-shell">
      <NavColumn />
      <div className="main-content">
        <TopBar />
        <div className="content-area">
          {showEditor && (
            <div className="editor-view active">
              <div className="code-pane">
                <div className="pane-head">
                  {showWelcome ? (
                    <span className="pane-head-welcome"><Sparkles size={12} /> 尚未开始编辑 — 选择一个文件，或按引导搭建工作区</span>
                  ) : editingFile ? (
                    <>
                      <span className="chip-file">
                        <FileText size={11} /> {editingFile.name}
                      </span>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setEditingFile(null)}
                        title="返回主文档"
                      >
                        <ArrowLeft size={11} /> 返回主文档
                      </button>
                    </>
                  ) : (
                    <span className="chip-ruleset">⛨ {rulesetName}</span>
                  )}
                  {!showWelcome && (errorCount + warnCount > 0 ? (
                    <span className="chip-warn">⚠ 实时校验 · {errorCount + warnCount} 处提醒</span>
                  ) : (
                    <span className="chip-ok">✓ 规则校验通过</span>
                  ))}
                  {!showWelcome && <span className="pane-meta">{lineCount} 行 · Markdown</span>}
                </div>
                {scopeSyncIssues.length > 0 && (
                  <div className="sync-check-bar">
                    <AlertTriangle size={12} />
                    <span>
                      工作区联动：{scopeSyncIssues.length} 处引用需同步检查
                    </span>
                    <span className="sync-check-list">
                      {scopeSyncIssues.map((iss, i) => (
                        <button
                          key={i}
                          className="sync-check-item"
                          onClick={() => setEditingFile(iss.filePath)}
                          title={`${iss.reason}（点击打开该文件）`}
                        >
                          {iss.kind === 'file' ? <FileText size={10} /> : <RefreshCw size={10} />}
                          {iss.fileLabel}
                        </button>
                      ))}
                    </span>
                  </div>
                )}
                <div className="editor-wrapper">
                  <CodeEditor />
                  {/* 首次打开：引导欢迎页（仅编辑器区域） */}
                  {showWelcome && !editingFilePath && <WelcomeGuide />}
                </div>
                {/* 首次打开不展示校验面板 */}
                {!showWelcome && <ValidationPanel />}
              </div>
              {/* 左右拖拽自由调整宽度的分割手柄 */}
              <div
                className={`panel-resize-handle ${isDraggingRef.current ? 'active' : ''}`}
                onMouseDown={handleMouseDown}
                title="按住向左/向右拖拽调整对话框宽度"
              >
                <div className="panel-resize-line" />
              </div>
              <ChatPanel width={chatWidth} />
            </div>
          )}
          {/* Diff 视图只在内容区内展开（顶栏/侧边栏保持可见） */}
          {diffActive && <DiffView />}
          {activeView === 'workspace' && (
            <div className="version-view active">
              <div className="view-head">
                <span>工作区范围选取</span>
              </div>
              <WorkspaceScope />
            </div>
          )}
          {activeView === 'history' && (
            <div className="version-view active">
              <div className="view-head">
                <span>版本时间线</span>
              </div>
              <VersionTimeline />
            </div>
          )}
          {activeView === 'ruleset' && (
            <div className="version-view active">
              <RulesetManager />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
