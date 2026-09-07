import { useStore } from '../../store/useStore';
import { AlertCircle, AlertTriangle, Info, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';

export default function ValidationPanel() {
  const issues = useStore(s => s.validationIssues);
  const fileValidationIssues = useStore(s => s.fileValidationIssues);
  const editingFilePath = useStore(s => s.editingFilePath);
  // 文件模式下校验结果显示该文件的校验结果
  const activeIssues = editingFilePath ? fileValidationIssues : issues;
  const showValidationPanel = useStore(s => s.showValidationPanel);
  const toggleValidationPanel = useStore(s => s.toggleValidationPanel);
  const jumpToLine = useStore(s => s.jumpToLine);

  const errorCount = activeIssues.filter(i => i.severity === 'error').length;
  const warnCount = activeIssues.filter(i => i.severity === 'warning').length;
  const infoCount = activeIssues.filter(i => i.severity === 'info').length;

  // Collapsed state: show a slim indicator badge
  if (!showValidationPanel) {
    return (
      <div className="validation-panel-collapsed" onClick={toggleValidationPanel} title="展开校验面板">
        <ChevronLeft size={14} />
        {errorCount > 0 && (
          <span className="vp-badge error">{errorCount}</span>
        )}
        {warnCount > 0 && (
          <span className="vp-badge warning">{warnCount}</span>
        )}
        {errorCount === 0 && warnCount === 0 && (
          <span className="vp-badge ok"><CheckCircle size={12} /></span>
        )}
      </div>
    );
  }

  return (
    <div className="validation-panel">
      <div className="validation-panel-header">
        <span>校验结果</span>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', alignItems: 'center' }}>
          {errorCount > 0 && <span style={{ color: 'var(--error)' }}>{errorCount} 错误</span>}
          {warnCount > 0 && <span style={{ color: 'var(--warn)' }}>{warnCount} 警告</span>}
          {infoCount > 0 && <span style={{ color: 'var(--brand-light)' }}>{infoCount} 提示</span>}
          <button
            className="btn btn-icon btn-ghost btn-xs"
            onClick={toggleValidationPanel}
            title="收起校验面板"
            style={{ marginLeft: '4px' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="validation-list">
        {activeIssues.length === 0 ? (
          <div className="validation-empty">
            <CheckCircle size={32} style={{ color: 'var(--success)', marginBottom: '8px' }} />
            <div>无校验问题</div>
            <div style={{ fontSize: '10px', marginTop: '4px' }}>文档符合当前规则集</div>
          </div>
        ) : (
          activeIssues.map((issue, idx) => (
            <div
              key={idx}
              className="validation-item"
              title="点击定位到对应行"
              onClick={() => jumpToLine(issue.line)}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className={`vi-severity ${issue.severity}`} />
                <span className="vi-msg">{issue.message}</span>
              </div>
              <div className="vi-line">行 {issue.line} · {issue.ruleType}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
