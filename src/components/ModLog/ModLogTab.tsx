import { useStore } from '../../store/useStore';
import { Pin, X, Check, Ban, Edit3, AlertTriangle, Bot } from 'lucide-react';
import { useState } from 'react';

export default function ModLogTab() {
  const modLogOpen = useStore(s => s.modLogOpen);
  const modLogPinned = useStore(s => s.modLogPinned);
  const modLogChangeIdx = useStore(s => s.modLogChangeIdx);
  const changeBlocks = useStore(s => s.changeBlocks);
  const togglePin = useStore(s => s.togglePin);
  const toggleModLog = useStore(s => s.toggleModLog);
  const acceptChange = useStore(s => s.acceptChange);
  const rejectChange = useStore(s => s.rejectChange);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState({ why: '', how: '', effect: '' });

  if (!modLogOpen || modLogChangeIdx < 0 || modLogChangeIdx >= changeBlocks.length) {
    return (
      <>
        <div
          className={`mod-log-overlay ${modLogOpen ? 'active' : ''}`}
          onClick={() => !modLogPinned && toggleModLog(false)}
        />
        <div className={`mod-log-panel ${modLogOpen ? 'active' : ''}`} />
      </>
    );
  }

  const cb = changeBlocks[modLogChangeIdx];
  if (!cb) return null;

  const typeLabels: Record<string, string> = {
    added: '新增',
    removed: '删除',
    replaced: '替换',
    reordered: '重排',
  };

  const typeColors: Record<string, string> = {
    added: 'var(--diff-add-light)',
    removed: 'var(--diff-del-light)',
    replaced: 'var(--diff-replace-light)',
    reordered: 'var(--diff-reorder-light)',
  };

  const handleEditStart = () => {
    setEditText({
      why: cb.explanation?.why || '',
      how: cb.explanation?.how || '',
      effect: cb.explanation?.effect || '',
    });
    setEditing(true);
  };

  const handleEditSave = () => {
    // Update the change block explanation
    const blocks = [...changeBlocks];
    blocks[modLogChangeIdx] = {
      ...cb,
      explanation: {
        why: editText.why,
        how: editText.how,
        effect: editText.effect,
      },
      pendingConfirmation: false,
    };
    useStore.setState({ changeBlocks: blocks });
    setEditing(false);
  };

  return (
    <>
      {/* Overlay (click outside to close) */}
      <div
        className={`mod-log-overlay ${modLogOpen ? 'active' : ''}`}
        onClick={() => !modLogPinned && toggleModLog(false)}
      />

      {/* Panel */}
      <div className={`mod-log-panel ${modLogOpen ? 'active' : ''}`}>
        <div className="mod-log-header">
          <span className="mod-log-title">📋 修改详情 #{modLogChangeIdx + 1}</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className={`btn btn-icon btn-ghost btn-sm ${modLogPinned ? 'active' : ''}`}
              title="钉住（防止误触关闭）"
              onClick={togglePin}
              style={modLogPinned ? { color: 'var(--brand-light)' } : {}}
            >
              <Pin size={14} />
            </button>
            <button
              className="btn btn-icon btn-ghost btn-sm"
              onClick={() => toggleModLog(false)}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="mod-log-body">
          {/* Type Badge */}
          <div className="mod-log-section">
            <span className={`mod-log-badge ${cb.type}`}>
              {typeLabels[cb.type]}
            </span>
            {cb.pendingConfirmation && (
              <span className="pending-confirm">
                <AlertTriangle size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> 说明待人工确认
              </span>
            )}
          </div>

          {/* Position */}
          <div className="mod-log-section">
            <h4>位置</h4>
            <div className="mod-log-text">
              {cb.type === 'added' && `新增于第 ${cb.newStartLine}-${cb.newEndLine} 行`}
              {cb.type === 'removed' && `删除自第 ${cb.oldStartLine}-${cb.oldEndLine} 行`}
              {cb.type === 'replaced' && `替换第 ${cb.oldStartLine}-${cb.oldEndLine} 行 → 第 ${cb.newStartLine}-${cb.newEndLine} 行`}
              {cb.type === 'reordered' && `重排：第 ${cb.oldStartLine} 行 → 第 ${cb.newStartLine} 行`}
            </div>
          </div>

          {/* Snippets */}
          <div className="mod-log-section">
            <h4>修改前 / 修改后</h4>
            {cb.oldSnippet && (
              <div className="snippet-box old" style={{ marginBottom: '8px' }}>
                {cb.oldSnippet}
              </div>
            )}
            {cb.newSnippet && (
              <div className="snippet-box new">
                {cb.newSnippet}
              </div>
            )}
          </div>

          {/* Why / How / Effect */}
          {cb.explanation ? (
            <>
              <div className="mod-log-section">
                <h4>为何修改 (Why)</h4>
                {editing ? (
                  <textarea
                    className="inp"
                    value={editText.why}
                    onChange={(e) => setEditText({ ...editText, why: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <div className="mod-log-text">{cb.explanation.why}</div>
                )}
              </div>

              <div className="mod-log-section">
                <h4>如何修改 (How)</h4>
                {editing ? (
                  <textarea
                    className="inp"
                    value={editText.how}
                    onChange={(e) => setEditText({ ...editText, how: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <div className="mod-log-text">{cb.explanation.how}</div>
                )}
              </div>

              <div className="mod-log-section">
                <h4>用途与效果 (Effect)</h4>
                {editing ? (
                  <textarea
                    className="inp"
                    value={editText.effect}
                    onChange={(e) => setEditText({ ...editText, effect: e.target.value })}
                    rows={3}
                  />
                ) : (
                  <div className="mod-log-text">{cb.explanation.effect}</div>
                )}
              </div>
            </>
          ) : (
            <div className="mod-log-section">
              <div className="mod-log-text" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                此变更块无 AI 说明。可点击"编辑说明"手动添加。
              </div>
            </div>
          )}

          {/* Meta info */}
          <div className="mod-log-section">
            <h4>元信息</h4>
            <div className="mod-log-meta">
              {cb.modelId && <span className="meta-item"><Bot size={11} /> {cb.modelId}</span>}
              {cb.tokens && <span className="meta-item">~{cb.tokens} tokens</span>}
              {cb.costEst !== undefined && cb.costEst > 0 && (
                <span className="meta-item">¥{cb.costEst.toFixed(4)}</span>
              )}
              {cb.versionFrom && cb.versionTo && (
                <span className="meta-item">{cb.versionFrom} → {cb.versionTo}</span>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mod-log-disclaimer">
            ⚠ AI 生成说明，仅供参考
          </div>
        </div>

        {/* Actions */}
        <div className="mod-log-body" style={{ paddingTop: 0 }}>
          <div className="mod-log-actions">
            <button
              className="btn btn-success btn-sm"
              onClick={() => acceptChange(modLogChangeIdx)}
              disabled={cb.accepted === true}
            >
              <Check size={12} /> 接受
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => rejectChange(modLogChangeIdx)}
              disabled={cb.accepted === false}
            >
              <Ban size={12} /> 拒绝
            </button>
            {editing ? (
              <button className="btn btn-secondary btn-sm" onClick={handleEditSave}>
                保存说明
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={handleEditStart}>
                <Edit3 size={12} /> 编辑说明
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
