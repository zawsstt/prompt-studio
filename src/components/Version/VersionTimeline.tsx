import { useStore } from '../../store/useStore';
import { RotateCcw, Download, Edit2, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { exportVersionMarkdown } from '../../store/db';
import type { VersionRecord } from '../../store/db';
import MarkdownView from '../shared/MarkdownView';

export default function VersionTimeline() {
  const versions = useStore(s => s.versions);
  const rollbackToVersion = useStore(s => s.rollbackToVersion);
  const renameVersion = useStore(s => s.renameVersion);
  const generateVersionSummary = useStore(s => s.generateVersionSummary);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  /** Version id whose inline summary card is expanded (brief level). */
  const [summaryOpenId, setSummaryOpenId] = useState<string | null>(null);
  /** Whether the detail level (full Markdown) is shown for the open card. */
  const [detailOpen, setDetailOpen] = useState(false);

  const handleExport = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    const markdown = exportVersionMarkdown(version);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${version.label}-changelog.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSkill = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    // Export as SKILL.md file
    const blob = new Blob([version.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SKILL.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // P1-10: first click generates (or reuses) the summary and opens the brief card.
  const handleSummaryClick = (version: VersionRecord) => {
    if (summaryOpenId === version.id) {
      setSummaryOpenId(null);
      setDetailOpen(false);
      return;
    }
    setSummaryOpenId(version.id);
    setDetailOpen(false);
    if (version.summaryStatus !== 'ready') {
      void generateVersionSummary(version.id);
    }
  };

  if (versions.length === 0) {
    return (
      <div className="empty-state">
        <p>暂无版本记录</p>
        <p>接受 AI 修改后将自动生成版本快照</p>
      </div>
    );
  }

  const currentVersionNum = versions[0]?.versionNumber || 0;

  return (
    <div className="version-timeline">
      {versions.map(version => (
        <div key={version.id} className="version-item">
          <div
            className={`version-node ${version.versionNumber === currentVersionNum ? 'current' : ''}`}
            title={version.label}
          >
            {version.versionNumber}
          </div>
          <div className="version-content">
            <div className="version-label">{version.label}</div>
            <div className="version-note">{version.note}</div>
            <div className="version-time">
              {new Date(version.createdAt).toLocaleString()}
            </div>
            {version.changeBlocks.length > 0 && (
              <div className="version-changes">
                {version.changeBlocks.length} 处变更 ·
                {' '}{version.changeBlocks.filter(cb => cb.accepted === true).length} 接受 ·
                {' '}{version.changeBlocks.filter(cb => cb.accepted === false).length} 拒绝
              </div>
            )}
            <div className="version-actions">
              {version.versionNumber !== currentVersionNum && (
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    if (confirm(`回滚至 ${version.label}？\n\n将生成新版本（不覆盖当前版本）。`)) {
                      rollbackToVersion(version.id);
                    }
                  }}
                  title="回滚到此版本"
                >
                  <RotateCcw size={11} /> 回滚
                </button>
              )}
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => handleExport(version.id)}
                title="导出变更日志 Markdown"
              >
                <Download size={11} /> 变更日志
              </button>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => handleExportSkill(version.id)}
                title="导出为 SKILL.md"
              >
                <Download size={11} /> SKILL.md
              </button>
              <button
                className={`btn btn-ghost btn-xs ${summaryOpenId === version.id ? 'active' : ''}`}
                onClick={() => handleSummaryClick(version)}
                title="生成/查看本版本的变更摘要"
              >
                <Sparkles size={11} /> 摘要
              </button>
              {editingId === version.id ? (
                <>
                  <input
                    className="inp"
                    style={{ width: '150px', fontSize: '11px' }}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="版本备注"
                  />
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => {
                      renameVersion(version.id, editText);
                      setEditingId(null);
                    }}
                  >
                    <Check size={11} />
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => {
                    setEditingId(version.id);
                    setEditText(version.note);
                  }}
                  title="重命名"
                >
                  <Edit2 size={11} />
                </button>
              )}
            </div>

            {/* P1-10: two-level summary disclosure (brief → detail) */}
            {summaryOpenId === version.id && (
              <div className="version-summary-card">
                {version.summaryStatus === 'generating' ? (
                  <div className="vs-skeleton">
                    <div className="vs-skeleton-line" style={{ width: '82%' }} />
                    <div className="vs-skeleton-line" style={{ width: '64%' }} />
                    <div className="vs-skeleton-line" style={{ width: '71%' }} />
                  </div>
                ) : version.summaryStatus === 'ready' && version.summaryBrief ? (
                  <>
                    <ul className="vs-brief">
                      {version.summaryBrief.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                    {version.summaryDetail && (
                      <button
                        className="btn btn-ghost btn-xs vs-detail-toggle"
                        onClick={() => setDetailOpen(!detailOpen)}
                      >
                        {detailOpen ? (
                          <><ChevronUp size={11} /> 收起</>
                        ) : (
                          <><ChevronDown size={11} /> 展开全部</>
                        )}
                      </button>
                    )}
                    {detailOpen && version.summaryDetail && (
                      <div className="vs-detail">
                        <MarkdownView content={version.summaryDetail} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="vs-empty">摘要生成失败，请点击「摘要」重试。</div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
