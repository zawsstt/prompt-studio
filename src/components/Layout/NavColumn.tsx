import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { MessageSquare, FolderTree, Clock, Settings as SettingsIcon, FileText, CheckSquare, ChevronDown, ChevronRight, ListTree, FlaskConical } from 'lucide-react';

export default function NavColumn() {
  const activeView = useStore(s => s.activeView);
  const setActiveView = useStore(s => s.setActiveView);
  const openSettings = useStore(s => s.openSettings);
  const closeDiff = useStore(s => s.closeDiff);
  const workspaceScopes = useStore(s => s.workspaceScopes);
  const importedFiles = useStore(s => s.importedFiles);
  const setEditingFile = useStore(s => s.setEditingFile);
  const editingFilePath = useStore(s => s.editingFilePath);

  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  const appliedScopes = workspaceScopes.filter(s => s.applied);

  // 点击文件 → 在编辑区打开该文件
  const openFile = (path: string) => {
    setEditingFile(path);
    closeDiff();
    setActiveView('editor');
    document.body.classList.remove('sb-open');
  };

  const navItems = [
    { id: 'chat' as const, icon: MessageSquare, label: 'AI 对话', desc: '修改助手', submenu: true },
    { id: 'workspace' as const, icon: FolderTree, label: '工作区范围', desc: '上下文引用' },
    { id: 'eval' as const, icon: FlaskConical, label: '提示词评测', desc: '用例与断言' },
    { id: 'history' as const, icon: Clock, label: '版本历史', desc: '时间线回溯' },
    { id: 'ruleset' as const, icon: ListTree, label: '规则集', desc: '配置与编辑' },
  ];

  const go = (id: 'chat' | 'workspace' | 'history' | 'ruleset' | 'eval') => {
    closeDiff();
    setActiveView(id);
    document.body.classList.remove('sb-open');
  };

  return (
    <nav className="nav-column">
      <div className="sb-head">
        <span className="mark">P</span>
        <span className="sb-name">PromptStudio</span>
        <span className="sb-ver">React v0.1</span>
      </div>
      <div className="sb-sec">工作区</div>
      <div className="nav-group">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <div key={item.id}>
              <div
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => go(item.id)}
                title={item.label}
              >
                <span className="nav-icon">
                  <Icon size={18} />
                </span>
                <span className="nav-label-wrap">
                  <div style={{ fontSize: '12.5px', fontWeight: active ? 600 : 550, lineHeight: 1.3 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    {item.desc}
                  </div>
                </span>
                {item.submenu && (
                  <span
                    className="nav-sub-toggle"
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatMenuOpen(!chatMenuOpen);
                    }}
                    title={chatMenuOpen ? '收起已应用区域' : '展开已应用区域'}
                  >
                    {chatMenuOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                )}
              </div>
              {item.submenu && chatMenuOpen && (
                <div className="nav-submenu">
                  <div className="nav-submenu-sec">已应用区域</div>
                  {appliedScopes.length === 0 && (
                    <div className="nav-submenu-empty">
                      未应用任何范围
                      <span className="nav-submenu-hint">在工作区中点「应用到 AI 对话」</span>
                    </div>
                  )}
                  {appliedScopes.map(s => (
                    <div
                      key={s.id}
                      className="nav-submenu-item"
                      onClick={() => go('workspace')}
                      title="跳转至工作区范围"
                    >
                      <CheckSquare size={11} className="nav-submenu-ok" />
                      <span className="nav-submenu-name">{s.name}</span>
                      <span className="nav-submenu-count">
                        {s.modules.filter(m => m.selected).length}/{s.modules.length}
                      </span>
                    </div>
                  ))}
                  <div className="nav-submenu-sec">文件 ({importedFiles.length})</div>
                  {importedFiles.length === 0 && (
                    <div className="nav-submenu-empty">暂无导入文件</div>
                  )}
                  {importedFiles.slice(0, 8).map(f => (
                    <div
                      key={f.path}
                      className={`nav-submenu-item ${editingFilePath === f.path ? 'active' : ''}`}
                      onClick={() => openFile(f.path)}
                      title={`${f.path}（点击在编辑区打开）`}
                    >
                      <FileText size={11} className="nav-submenu-file" />
                      <span className="nav-submenu-name">{f.name}</span>
                      {editingFilePath === f.path && (
                        <span className="nav-submenu-editing">编辑中</span>
                      )}
                    </div>
                  ))}
                  {importedFiles.length > 8 && (
                    <div className="nav-submenu-empty">… 共 {importedFiles.length} 个文件</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="nav-group-bottom">
        <div className="nav-item" onClick={() => { openSettings(); document.body.classList.remove('sb-open'); }}>
          <span className="nav-icon">
            <SettingsIcon size={18} />
          </span>
          <span className="nav-label-wrap" style={{ fontSize: '12.5px' }}>设置</span>
        </div>
      </div>
    </nav>
  );
}
