import { useStore } from '../../store/useStore';
import { RotateCcw, Download, Edit2, Check, Sparkles, ChevronDown, ChevronUp, FlaskConical, BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { exportVersionMarkdown } from '../../store/db';
import type { VersionRecord } from '../../store/db';
import { buildScoreCurve } from '../../lib/eval/baseline';
import { useAutoTour } from '../../hooks/useTour';
import MarkdownView from '../shared/MarkdownView';

export default function VersionTimeline() {
  useAutoTour('history');
  const versions = useStore(s => s.versions);
  const rollbackToVersion = useStore(s => s.rollbackToVersion);
  const renameVersion = useStore(s => s.renameVersion);
  const generateVersionSummary = useStore(s => s.generateVersionSummary);
  const evalRuns = useStore(s => s.evalRuns);
  const evalRunning = useStore(s => s.evalRunning);
  const evalTargetVersionId = useStore(s => s.evalTargetVersionId);
  const runEvalForVersion = useStore(s => s.runEvalForVersion);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  /** Version id whose inline summary card is expanded (brief level). */
  const [summaryOpenId, setSummaryOpenId] = useState<string | null>(null);
  /** Whether the detail level (full Markdown) is shown for the open card. */
  const [detailOpen, setDetailOpen] = useState(false);
  /** Briefly highlight a version card after jumping from the baseline curve. */
  const [flashVersionId, setFlashVersionId] = useState<string | null>(null);

  // P1-2: 每个版本取最近一次评测作为分数，形成 v1 → vN 的回归基线
  const curve = useMemo(() => buildScoreCurve(evalRuns, versions), [evalRuns, versions]);
  const pointByVersion = useMemo(
    () => new Map(curve.filter(p => p.versionId).map(p => [p.versionId as string, p])),
    [curve]
  );

  const jumpToVersion = (versionId: string) => {
    document.getElementById(`version-${versionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashVersionId(versionId);
    window.setTimeout(() => setFlashVersionId(cur => (cur === versionId ? null : cur)), 1600);
  };

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
      {/* P1-2: 回归基线分曲线：直接看 v7 82 分 → v8 89 分 */}
      <div className="version-baseline">
        <div className="vb-head">
          <BarChart3 size={13} /> 回归基线
          <span className="vb-sub">
            {curve.length > 0 ? '每个版本取最近一次评测 · 点条目跳到该版本' : '还没有绑定版本的评测记录'}
          </span>
        </div>
        {curve.length === 0 ? (
          <div className="vb-empty">
            在任一版本点「评测」，结果就会绑定到该版本——之后这里会出现「v7 82 分 → v8 89 分」的分数曲线。
          </div>
        ) : (
          <div className="vb-rows">
            {curve.map(p => (
              <button
                key={p.versionId ?? 'unversioned'}
                className={`vb-row ${p.versionId ? '' : 'unversioned'}`}
                onClick={() => { if (p.versionId) jumpToVersion(p.versionId); }}
                title={`${p.versionLabel} · 最近 ${p.score} 分 / 最好 ${p.bestScore} 分 · ${p.modelName} · ${new Date(p.lastRunAt).toLocaleString()}`}
                disabled={!p.versionId}
              >
                <span className="vb-label">{p.versionLabel}</span>
                <span className="vb-bar"><span className="vb-bar-fill" style={{ width: `${p.score}%` }} /></span>
                <span className="vb-val">{p.score} 分</span>
                <span className={`vb-delta ${p.delta === null ? 'flat' : p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : 'flat'}`}>
                  {p.delta === null ? '基线' : p.delta > 0 ? `+${p.delta}` : p.delta < 0 ? `${p.delta}` : '±0'}
                </span>
                <span className="vb-meta">
                  {p.runCount} 次 · {new Date(p.lastRunAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {versions.map(version => {
        const point = pointByVersion.get(version.id);
        const delta = point?.delta ?? null;
        return (
          <div key={version.id} className="version-item" id={`version-${version.id}`}>
            <div
              className={`version-node ${version.versionNumber === currentVersionNum ? 'current' : ''}`}
              title={version.label}
            >
              {version.versionNumber}
            </div>
            <div className={`version-content ${flashVersionId === version.id ? 'flash' : ''}`}>
              <div className="version-top">
                <span className="version-label">{version.label}</span>
                {point ? (
                  <span
                    className={`version-eval ${delta === null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}
                    title={`最近 ${point.score} 分（最好 ${point.bestScore} 分）· ${point.runCount} 次评测`}
                  >
                    {point.score} 分
                    {delta !== null && delta !== 0 && <em>{delta > 0 ? `+${delta}` : `${delta}`}</em>}
                  </span>
                ) : (
                  <span className="version-eval none">未评测</span>
                )}
              </div>
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
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => void runEvalForVersion(version.id)}
                  disabled={evalRunning}
                  title="用当前用例集评测这个版本的内容（会调用模型，产生费用）"
                >
                  <FlaskConical size={11} />
                  {evalRunning && evalTargetVersionId === version.id ? '评测中…' : '评测此版本'}
                </button>
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
        );
      })}
    </div>
  );
}
