import { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Plus, Trash2, ChevronDown, ChevronRight, Lock, Unlock, CheckSquare, Square, FolderOpen, Folder, Upload, FolderInput, FileText, Send, ChevronsUpDown, HardDrive, RefreshCw, ShieldAlert } from 'lucide-react';
import type { WorkspaceScope } from '../../types';

export default function WorkspaceScopeView() {
  const workspaceScopes = useStore(s => s.workspaceScopes);
  const currentScopeId = useStore(s => s.currentScopeId);
  const importedFiles = useStore(s => s.importedFiles);
  const parseDocumentModules = useStore(s => s.parseDocumentModules);
  const createScope = useStore(s => s.createScope);
  const deleteScope = useStore(s => s.deleteScope);
  const toggleModuleInScope = useStore(s => s.toggleModuleInScope);
  const toggleScopeExpanded = useStore(s => s.toggleScopeExpanded);
  const toggleScopeLocked = useStore(s => s.toggleScopeLocked);
  const toggleScopeApplied = useStore(s => s.toggleScopeApplied);
  const selectScope = useStore(s => s.selectScope);
  const selectAllModules = useStore(s => s.selectAllModules);
  const deselectAllModules = useStore(s => s.deselectAllModules);
  const importFile = useStore(s => s.importFile);
  const importFolder = useStore(s => s.importFolder);
  const removeImportedFile = useStore(s => s.removeImportedFile);
  const createScopeFromFiles = useStore(s => s.createScopeFromFiles);
  const addFilesToScope = useStore(s => s.addFilesToScope);

  // 本地授权文件夹（线上发布场景：内容不落库，只读自/写回本地）
  const localFolder = useStore(s => s.localFolder);
  const localFiles = useStore(s => s.localFiles);
  const pickLocalFolder = useStore(s => s.pickLocalFolder);
  const reauthorizeLocalFolder = useStore(s => s.reauthorizeLocalFolder);
  const refreshLocalFiles = useStore(s => s.refreshLocalFiles);
  const openLocalFile = useStore(s => s.openLocalFile);
  const setEditingFile = useStore(s => s.setEditingFile);
  const [localDirsOpen, setLocalDirsOpen] = useState<Set<string>>(new Set());

  const toggleLocalDir = (path: string) => {
    setLocalDirsOpen(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  /** P1-9: imported files checked to be aggregated into a new scope. */
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());
  /** Whether the create form builds the scope from checked files (vs. current doc). */
  const [createFromFiles, setCreateFromFiles] = useState(false);
  /** 添加至已有工作区：目标 scope 选择弹层 */
  const [addToScopeOpen, setAddToScopeOpen] = useState(false);
  /** 导入文件树：总展开/收起 + 文件夹默认收起 */
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const toggleCheckedPath = (path: string) => {
    setCheckedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // 文件树分组：根文件（无目录前缀）与文件夹（path 第一段）
  const rootFiles = importedFiles.filter(f => !f.path.includes('/'));
  const folderMap = new Map<string, typeof importedFiles>();
  for (const f of importedFiles) {
    if (!f.path.includes('/')) continue;
    const folder = f.path.split('/')[0];
    if (!folderMap.has(folder)) folderMap.set(folder, []);
    folderMap.get(folder)!.push(f);
  }
  const folders = Array.from(folderMap.keys());

  const toggleFolder = (name: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    if (createFromFiles) {
      const paths = importedFiles.map(f => f.path).filter(p => checkedPaths.has(p));
      if (paths.length === 0) return;
      createScopeFromFiles(paths, newName.trim(), newDesc.trim());
      setCheckedPaths(new Set());
      setCreateFromFiles(false);
    } else {
      const modules = parseDocumentModules();
      createScope(newName.trim(), newDesc.trim(), modules);
    }
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  const openCreateFromFiles = () => {
    setCreateFromFiles(true);
    setShowCreate(true);
  };

  const cancelCreate = () => {
    setShowCreate(false);
    setCreateFromFiles(false);
    setNewName('');
    setNewDesc('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    // 并行导入，减少大批量文件的刷新延迟
    await Promise.all(Array.from(files).map(f => importFile(f)));
    e.target.value = '';
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    await importFolder(Array.from(files));
    e.target.value = '';
  };

  const unlockedScopes = workspaceScopes.filter(s => !s.locked);
  const lockedScopes = workspaceScopes.filter(s => s.locked);

  const renderFileRow = (f: { path: string; name: string }) => (
    <div key={f.path} className="ws-module-item selected" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        <button
          className="btn btn-icon btn-ghost btn-xs ws-file-check"
          onClick={() => toggleCheckedPath(f.path)}
          title={checkedPaths.has(f.path) ? '取消勾选' : '勾选以组成/添加至工作区'}
          style={checkedPaths.has(f.path) ? { color: 'var(--brand-light)' } : {}}
        >
          {checkedPaths.has(f.path) ? <CheckSquare size={14} /> : <Square size={14} />}
        </button>
        <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span className="ws-module-heading" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }} title={f.path}>
          {f.name}
        </span>
      </div>
      <button
        className="btn btn-icon btn-ghost btn-xs"
        onClick={() => {
          removeImportedFile(f.path);
          setCheckedPaths(prev => {
            if (!prev.has(f.path)) return prev;
            const next = new Set(prev);
            next.delete(f.path);
            return next;
          });
        }}
        title="移除导入"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );

  return (
    <div className="workspace-scope-container">
      <div className="ws-toolbar">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setCreateFromFiles(false); setShowCreate(!showCreate); }}
        >
          <Plus size={14} /> 新建工作区范围
        </button>
        {checkedPaths.size > 0 && (
          <>
            <button
              className="btn btn-secondary btn-sm"
              onClick={openCreateFromFiles}
              title="将勾选的导入文件聚合为一个新的工作区范围"
            >
              <CheckSquare size={14} /> 组成新工作区 ({checkedPaths.size})
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setAddToScopeOpen(!addToScopeOpen)}
              title="将勾选的导入文件添加到已有的工作区范围"
            >
              <Plus size={14} /> 添加至已有工作区 ({checkedPaths.size})
            </button>
          </>
        )}
        <span className="spacer" style={{ flex: 1 }} />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => fileInputRef.current?.click()}
          title="导入单个 Markdown 文件"
        >
          <Upload size={14} /> 导入文件
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => folderInputRef.current?.click()}
          title="批量导入文件夹内所有 Markdown 文件"
        >
          <FolderInput size={14} /> 导入文件夹
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is not in the TS type
          webkitdirectory=""
          multiple
          style={{ display: 'none' }}
          onChange={handleFolderSelect}
        />
      </div>

      {/* ── 本地授权文件夹（线上发布：内容不落库，仅本地读写） ── */}
      <div className="ws-create-form" style={{ gap: '10px' }}>
        <div className="ws-group-label">
          <HardDrive size={13} style={{ color: 'var(--brand)' }} />
          本地文件夹（授权后读取，内容不上传）
        </div>
        {!localFolder ? (
          <div className="ws-create-hint">
            授权后可将本机文件夹视为文件资源管理器：读取/编辑/写回均在本机进行，刷新页面后自动恢复授权目录。
          </div>
        ) : (
          <div className="ws-create-hint">
            <b>{localFolder.name}</b>
            {localFolder.permission === 'granted' ? ' · 已授权（本会话可读写）' : ' · 授权已过期'}
          </div>
        )}
        <div className="ws-create-actions" style={{ flexWrap: 'wrap' }}>
          {!localFolder && (
            <button className="btn btn-primary btn-sm" onClick={() => void pickLocalFolder()} title="选择本机文件夹（Chrome/Edge）">
              <FolderOpen size={14} /> 授权本地文件夹
            </button>
          )}
          {localFolder && localFolder.permission !== 'granted' && (
            <button className="btn btn-primary btn-sm" onClick={() => void reauthorizeLocalFolder()} title="重新授予读写权限">
              <ShieldAlert size={14} /> 重新授权
            </button>
          )}
          {localFolder && localFolder.permission === 'granted' && (
            <button className="btn btn-ghost btn-sm" onClick={() => void refreshLocalFiles()} title="刷新本地文件列表">
              <RefreshCw size={14} /> 刷新
            </button>
          )}
        </div>
        {localFolder && localFolder.permission === 'granted' && (
          <div className="ws-module-list" style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {localFiles.length === 0 && (
              <div className="ws-create-hint">授权目录内暂无可编辑的文本文件（.md/.txt/.json/.yaml 等）</div>
            )}
            {localFiles
              .filter(n => n.kind === 'file' && !n.path.includes('/'))
              .map(n => (
                <div key={n.path} className="ws-module-item selected" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span className="ws-module-heading" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }} title={n.path}>{n.name}</span>
                  </div>
                  <button
                    className="btn btn-icon btn-ghost btn-xs"
                    onClick={() => void openLocalFile(n.path)}
                    title="在编辑区打开（读取本地内容）"
                  >
                    <FolderOpen size={12} />
                  </button>
                </div>
              ))}
            {localFiles
              .filter(n => n.kind === 'directory')
              .map(dir => {
                const open = localDirsOpen.has(dir.path);
                const children = localFiles.filter(n => n.path.startsWith(dir.path + '/') && !n.path.slice(dir.path.length + 1).includes('/'));
                return (
                  <div key={dir.path}>
                    <div className="ws-folder-item" onClick={() => toggleLocalDir(dir.path)}>
                      <span className="ws-folder-chevron">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                      <Folder size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="ws-folder-name">{dir.name}</span>
                      <span className="ws-folder-count">{children.length} 个文件</span>
                    </div>
                    {open && children.map(n => (
                      <div key={n.path} className="ws-module-item selected" style={{ justifyContent: 'space-between', paddingLeft: '26px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <FileText size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span className="ws-module-heading" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px' }} title={n.path}>{n.name}</span>
                        </div>
                        <button
                          className="btn btn-icon btn-ghost btn-xs"
                          onClick={() => void openLocalFile(n.path)}
                          title="在编辑区打开（读取本地内容）"
                        >
                          <FolderOpen size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 添加至已有工作区：目标选择弹层 */}
      {addToScopeOpen && (
        <div className="ws-add-to-scope">
          <div className="ws-add-to-scope-label">选择目标工作区（已锁定范围不可添加）：</div>
          <div className="ws-add-to-scope-list">
            {unlockedScopes.length === 0 && (
              <div className="ws-add-to-scope-empty">暂无可添加的工作区范围（先新建一个）</div>
            )}
            {unlockedScopes.map(s => (
              <button
                key={s.id}
                className="ws-add-to-scope-item"
                onClick={() => {
                  addFilesToScope(s.id, importedFiles.map(f => f.path).filter(p => checkedPaths.has(p)));
                  setAddToScopeOpen(false);
                  setCheckedPaths(new Set());
                }}
              >
                <Folder size={12} />
                {s.name}
                <span className="ws-add-to-scope-count">{s.modules.length} 模块</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="ws-create-form">
          {createFromFiles && (
            <div className="ws-create-hint">
              将由 {checkedPaths.size} 个勾选文件的模块组成新范围（标题按「文件名/标题」命名）
            </div>
          )}
          <input
            type="text"
            className="ws-input"
            placeholder="工作区名称，如：核心业务逻辑"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <input
            type="text"
            className="ws-input"
            placeholder="描述（可选）"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <div className="ws-create-actions">
            <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newName.trim()}>
              创建
            </button>
            <button className="btn btn-ghost btn-sm" onClick={cancelCreate}>
              取消
            </button>
          </div>
        </div>
      )}

      {workspaceScopes.length === 0 && importedFiles.length === 0 ? (
        <div className="ws-empty">
          <FolderOpen size={40} className="ws-empty-icon" />
          <p>暂无工作区范围</p>
          <p style={{ marginTop: '4px' }}>
            创建范围后可以限定修改区域，避免误操作
          </p>
        </div>
      ) : (
        <div className="ws-scope-list">
          {importedFiles.length > 0 && (
            <div className="ws-scope-group">
              <div className="ws-group-label" style={{ justifyContent: 'space-between' }}>
                <span>已导入文件 ({importedFiles.length})</span>
                <button
                  className="btn btn-icon btn-ghost btn-xs"
                  onClick={() => setFilesExpanded(!filesExpanded)}
                  title={filesExpanded ? '收起全部导入文件' : '展开全部导入文件'}
                >
                  <ChevronsUpDown size={12} />
                </button>
              </div>
              {filesExpanded && (
                <div className="ws-scope-card">
                  <div className="ws-module-list">
                    {rootFiles.map(renderFileRow)}
                    {folders.map(folderName => {
                      const collapsed = collapsedFolders.has(folderName);
                      const files = folderMap.get(folderName)!;
                      return (
                        <div key={folderName}>
                          <div
                            className="ws-folder-item"
                            onClick={() => toggleFolder(folderName)}
                          >
                            <span className="ws-folder-chevron">
                              {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                            </span>
                            <Folder size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <span className="ws-folder-name">{folderName}</span>
                            <span className="ws-folder-count">{files.length} 个文件</span>
                          </div>
                          {!collapsed && (
                            <div style={{ paddingLeft: '18px' }}>
                              {files.map(renderFileRow)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {renderScopeGroup('当前工作区', unlockedScopes)}
          {renderScopeGroup('已锁定', lockedScopes)}
        </div>
      )}
    </div>
  );

  function renderScopeGroup(title: string, scopes: WorkspaceScope[]) {
    if (scopes.length === 0) return null;
    return (
      <div className="ws-scope-group">
        <div className="ws-group-label">{title}</div>
        {scopes.map(scope => (
          <div
            key={scope.id}
            className={`ws-scope-card ${currentScopeId === scope.id ? 'active' : ''} ${scope.locked ? 'locked' : ''}`}
          >
            <div className="ws-scope-header" onClick={() => toggleScopeExpanded(scope.id)}>
              <span className="ws-expand-icon">
                {scope.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <div className="ws-scope-info">
                <span className="ws-scope-name">
                  {scope.name}
                  {scope.applied && (
                    <span className="ws-applied-badge" title="已应用到 AI 对话">● 已应用</span>
                  )}
                </span>
                {scope.description && (
                  <span className="ws-scope-desc">{scope.description}</span>
                )}
                <span className="ws-scope-stats">
                  {scope.modules.filter(m => m.selected).length}/{scope.modules.length} 模块
                </span>
              </div>
              <div className="ws-scope-actions">
                <button
                  className={`btn btn-icon btn-xs ${scope.applied ? 'btn-primary' : 'btn-ghost'}`}
                  title={scope.applied ? '取消应用至 AI 对话' : '应用到 AI 对话（勾选模块注入上下文）'}
                  onClick={e => { e.stopPropagation(); toggleScopeApplied(scope.id); }}
                >
                  <Send size={12} />
                </button>
                <button
                  className="btn btn-icon btn-ghost btn-xs"
                  title={scope.locked ? '解锁' : '锁定（锁定后子集不可修改）'}
                  onClick={e => { e.stopPropagation(); toggleScopeLocked(scope.id); }}
                >
                  {scope.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button
                  className={`btn btn-icon btn-xs ${currentScopeId === scope.id ? 'btn-primary' : 'btn-ghost'}`}
                  title="切换至该范围"
                  onClick={e => { e.stopPropagation(); selectScope(scope.id); }}
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                >
                  {currentScopeId === scope.id ? '当前' : '切换'}
                </button>
                <button
                  className="btn btn-icon btn-ghost btn-xs"
                  title={scope.locked ? '已锁定，需先解锁才能删除' : '删除范围'}
                  disabled={scope.locked}
                  onClick={e => { e.stopPropagation(); deleteScope(scope.id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {scope.expanded && (
              <div className="ws-module-list">
                <div className="ws-module-actions-bar">
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={scope.locked}
                    onClick={() => selectAllModules(scope.id)}
                  >
                    全选
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={scope.locked}
                    onClick={() => deselectAllModules(scope.id)}
                  >
                    取消全选
                  </button>
                  {scope.locked && (
                    <span className="ws-locked-hint">🔒 已锁定，解锁后可编辑</span>
                  )}
                </div>
                {scope.modules.map(mod => (
                  <div
                    key={mod.heading}
                    className={`ws-module-item ${mod.selected ? 'selected' : ''} ${scope.locked ? 'locked-item' : ''}`}
                    onClick={() => toggleModuleInScope(scope.id, mod.heading)}
                    title={scope.locked ? '已锁定，不可修改' : undefined}
                  >
                    <span className="ws-module-check">
                      {mod.selected ? <CheckSquare size={14} /> : <Square size={14} />}
                    </span>
                    <span className="ws-module-heading" style={{ paddingLeft: `${(mod.level - 2) * 12}px` }}>
                      {mod.heading}
                    </span>
                    <span className="ws-module-lines">
                      L{mod.startLine}-{mod.endLine}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
}
