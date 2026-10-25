import { useCallback, useState } from 'react';
import { useStore } from '../../store/useStore';
import { RULESETS } from '../../data/rulesets';
import { Upload, Sparkles, Menu, ChevronDown, Sun, Moon } from 'lucide-react';
import { toast } from '../shared/Toast';
import ModelQuickMenu from '../Settings/ModelQuickMenu';
import { useEffectiveDark } from '../../hooks/useTheme';

export default function TopBar() {
  const docName = useStore(s => s.docName);
  const rulesetId = useStore(s => s.rulesetId);
  const setRuleset = useStore(s => s.setRuleset);
  const customRulesets = useStore(s => s.customRulesets);
  const openRulesetImport = useStore(s => s.openRulesetImport);
  const doAutoOrganize = useStore(s => s.doAutoOrganize);
  const openDiff = useStore(s => s.openDiff);
  const closeDiff = useStore(s => s.closeDiff);
  const diffActive = useStore(s => s.diffActive);
  const showValidationBanner = useStore(s => s.showValidationBanner);
  const validationIssues = useStore(s => s.validationIssues);
  const fileValidationIssues = useStore(s => s.fileValidationIssues);
  const editingFilePath = useStore(s => s.editingFilePath);
  const importedFiles = useStore(s => s.importedFiles);
  const activeView = useStore(s => s.activeView);
  const setActiveView = useStore(s => s.setActiveView);
  const changeBlocks = useStore(s => s.changeBlocks);
  const selectedModelName = useStore(s => s.selectedModelName);
  const showWelcome = useStore(s => s.showWelcome);
  const apiKeyConfigured = !!useStore(s => s.apiKeyInput);
  const themeMode = useStore(s => s.themeMode);
  const setThemeMode = useStore(s => s.setThemeMode);
  const dark = useEffectiveDark();

  const [quickOpen, setQuickOpen] = useState(false);
  const closeQuick = useCallback(() => setQuickOpen(false), []);

  // 文件模式下，面包屑与错误统计应跟随当前打开的文件，而非始终固定为主文档
  const activeFile = editingFilePath ? importedFiles.find(f => f.path === editingFilePath) : undefined;
  const activeIssues = editingFilePath ? fileValidationIssues : validationIssues;
  const errorCount = activeIssues.filter(i => i.severity === 'error').length;
  const warnCount = activeIssues.filter(i => i.severity === 'warning').length;

  const tryOpenDiff = () => {
    // 动态判断：主文档候选或文件修改（快照 ≠ 当前）任一存在即可对比
    openDiff();
    if (!useStore.getState().diffActive) {
      toast('暂无可对比内容：请先在对话中生成候选修改，或修改当前文件', 'error');
    }
  };

  const onTab = (tab: 'edit' | 'diff' | 'history' | 'ruleset' | 'eval') => {
    if (tab === 'diff') {
      if (diffActive) {
        closeDiff();
      } else {
        tryOpenDiff();
      }
    } else {
      closeDiff();
      if (tab === 'history') setActiveView('history');
      else if (tab === 'ruleset') setActiveView('ruleset');
      else if (tab === 'eval') setActiveView('eval');
      else setActiveView('editor');
    }
  };

  const tabEditActive = !diffActive && activeView !== 'history' && activeView !== 'ruleset' && activeView !== 'eval';
  const pendingCnt = changeBlocks.length;

  return (
    <>
      {/* 首次打开（欢迎页）不展示校验反馈；文件模式下横幅跟随当前文件的错误数 */}
      {!showWelcome && (editingFilePath ? errorCount > 0 : showValidationBanner) && (
        <div className="validation-banner">
          <span>⚠</span>
          <span>存在 {errorCount} 处错误，{warnCount} 处警告 — 规则冲突需处理</span>
        </div>
      )}
      <header className="topbar">
        <button className="burger" aria-label="菜单" onClick={() => document.body.classList.toggle('sb-open')}>
          <span /><span />
        </button>
        <div className="doc-indicator">
          {showWelcome ? (
            <>prompts / <b>欢迎使用</b></>
          ) : editingFilePath ? (
            <>prompts / <b>{activeFile?.name ?? editingFilePath}</b></>
          ) : (
            <>prompts / <b>{docName}</b></>
          )}
        </div>
        <div className="tabs" role="tablist">
          <button className={`tab ${tabEditActive ? 'on' : ''}`} data-tab="edit" onClick={() => onTab('edit')}>
            编辑
          </button>
          <button className={`tab ${diffActive ? 'on' : ''}`} data-tab="diff" onClick={() => onTab('diff')}>
            对比
            {pendingCnt > 0 && <span className="cnt">{pendingCnt}</span>}
          </button>
          <button className={`tab ${activeView === 'history' ? 'on' : ''}`} data-tab="history" onClick={() => onTab('history')}>
            历史
          </button>
          <button className={`tab ${activeView === 'ruleset' ? 'on' : ''}`} data-tab="ruleset" onClick={() => onTab('ruleset')}>
            规则集
          </button>
          <button className={`tab ${activeView === 'eval' ? 'on' : ''}`} data-tab="eval" onClick={() => onTab('eval')}>
            评测
          </button>
        </div>
        <span className="spacer" />
        <div className="top-right">
          <button
            className="btn btn-icon btn-ghost btn-sm theme-toggle"
            onClick={() => setThemeMode(dark ? 'light' : 'dark')}
            title={`${dark ? '切换到浅色' : '切换到深色'}（当前：${themeMode === 'system' ? '跟随系统' : themeMode === 'dark' ? '深色' : '浅色'}）`}
            aria-label="切换明暗主题"
          >
            {dark ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <div className="model-quick-wrap">
            <button
              className={`model-pill ${quickOpen ? 'on' : ''}`}
              onClick={() => setQuickOpen(v => !v)}
              title={apiKeyConfigured ? '快速切换模型 · 点击展开' : '尚未配置 API Key · 点击选择供应商'}
              aria-expanded={quickOpen}
            >
              <span className={`pulse ${apiKeyConfigured ? '' : 'off'}`} />
              <span className="mn">{selectedModelName || '选择模型'}</span>
              <ChevronDown size={11} className="model-pill-chevron" />
            </button>
            {quickOpen && <ModelQuickMenu onClose={closeQuick} />}
          </div>
          <select
            className="sel"
            value={rulesetId}
            onChange={(e) => { void setRuleset(e.target.value); }}
            title="规则集"
          >
            <optgroup label="内置规则集">
              {Object.values(RULESETS).map(rs => (
                <option key={rs.id} value={rs.id}>{rs.name}</option>
              ))}
            </optgroup>
            {customRulesets.length > 0 && (
              <optgroup label="自定义规则集">
                {customRulesets.map(rs => (
                  <option key={rs.id} value={rs.id}>{rs.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button className="btn btn-ghost btn-xs" onClick={openRulesetImport} title="导入规则集">
            <Upload size={12} /> 导入规则集
          </button>
          <button className="btn btn-ghost btn-xs" onClick={doAutoOrganize} title="自动整理模块顺序">
            <Sparkles size={12} /> 自动整理
          </button>
        </div>
      </header>
    </>
  );
}
