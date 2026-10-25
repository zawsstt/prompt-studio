import { Fragment, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { ASSERTION_LABELS, ASSERTION_HINTS } from '../../lib/eval/assertions';
import { extractVariables } from '../../lib/eval/variables';
import { pickBaselineRun, scoreRun } from '../../lib/eval/baseline';
import { RULESETS } from '../../data/rulesets';
import type { AssertionType } from '../../types';
import BaselinePanel from './BaselinePanel';
import TourButton from '../shared/TourButton';
import { useAutoTour } from '../../hooks/useTour';
import {
  FlaskConical, Play, Square, Plus, Trash2, Copy, Upload, Download,
  ChevronDown, ChevronRight, Check, X, Circle, Sparkles, AlertTriangle, Clock,
} from 'lucide-react';

const ASSERTION_TYPES = Object.keys(ASSERTION_LABELS) as AssertionType[];

function fileStem(name: string): string {
  return name.replace(/\.(md|markdown|txt|prompt|ya?ml)$/i, '') || 'prompt';
}

export default function EvalView() {
  useAutoTour('eval');
  const evalCases = useStore(s => s.evalCases);
  const selectedId = useStore(s => s.evalSelectedCaseId);
  const promptRole = useStore(s => s.evalPromptRole);
  const running = useStore(s => s.evalRunning);
  const results = useStore(s => s.evalResults);
  const runs = useStore(s => s.evalRuns);
  const error = useStore(s => s.evalError);

  const docContent = useStore(s => s.docContent);
  const docName = useStore(s => s.docName);
  const editingFilePath = useStore(s => s.editingFilePath);
  const importedFiles = useStore(s => s.importedFiles);
  const providerId = useStore(s => s.selectedProviderId);
  const modelName = useStore(s => s.selectedModelName);
  const rulesetId = useStore(s => s.rulesetId);
  const customRulesets = useStore(s => s.customRulesets);
  const versions = useStore(s => s.versions);
  const evalTargetVersionId = useStore(s => s.evalTargetVersionId);
  const evalCurrentRunId = useStore(s => s.evalCurrentRunId);
  const setActiveView = useStore(s => s.setActiveView);

  const addEvalCase = useStore(s => s.addEvalCase);
  const removeEvalCase = useStore(s => s.removeEvalCase);
  const duplicateEvalCase = useStore(s => s.duplicateEvalCase);
  const selectEvalCase = useStore(s => s.selectEvalCase);
  const updateEvalCase = useStore(s => s.updateEvalCase);
  const setEvalCaseVar = useStore(s => s.setEvalCaseVar);
  const addEvalCaseVar = useStore(s => s.addEvalCaseVar);
  const removeEvalCaseVar = useStore(s => s.removeEvalCaseVar);
  const addEvalAssertion = useStore(s => s.addEvalAssertion);
  const updateEvalAssertion = useStore(s => s.updateEvalAssertion);
  const removeEvalAssertion = useStore(s => s.removeEvalAssertion);
  const setEvalPromptRole = useStore(s => s.setEvalPromptRole);
  const importEvalConfig = useStore(s => s.importEvalConfig);
  const loadExampleEvalCases = useStore(s => s.loadExampleEvalCases);
  const exportEvalConfig = useStore(s => s.exportEvalConfig);
  const runEval = useStore(s => s.runEval);
  const cancelEval = useStore(s => s.cancelEval);
  const clearEvalResults = useStore(s => s.clearEvalResults);
  const viewEvalRun = useStore(s => s.viewEvalRun);
  const clearEvalTargetVersion = useStore(s => s.clearEvalTargetVersion);
  const restoreEvalSnapshot = useStore(s => s.restoreEvalSnapshot);

  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState('');
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // P1-2: 指定版本时，界面所有模板提示（变量、来源）都要跟随被评测的内容
  const targetVersion = evalTargetVersionId
    ? versions.find(v => v.id === evalTargetVersionId)
    : undefined;
  const template = targetVersion
    ? targetVersion.content
    : editingFilePath
      ? (importedFiles.find(f => f.path === editingFilePath)?.content ?? docContent)
      : docContent;

  const templateVars = useMemo(() => extractVariables(template), [template]);
  const selected = evalCases.find(c => c.id === selectedId) ?? null;
  const rulesetName = RULESETS[rulesetId]?.name ?? customRulesets.find(r => r.id === rulesetId)?.name ?? '规则集';

  // P1-2: 当前结果对应的运行记录 + 自动选出的基线
  const currentRun = evalCurrentRunId ? runs.find(r => r.id === evalCurrentRunId) ?? null : null;
  const baselineRun = useMemo(
    () => (currentRun ? pickBaselineRun(runs, currentRun, versions) : null),
    [runs, currentRun, versions]
  );

  const missingVars = selected ? templateVars.filter(v => !(v in selected.vars)) : templateVars;

  const passedCount = results?.filter(r => r.passed).length ?? 0;
  const total = results?.length ?? 0;
  const avgMs = results && results.length
    ? Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length)
    : 0;
  const totalTokens = results?.reduce((sum, r) => sum + r.tokensEst, 0) ?? 0;
  const totalCost = results?.reduce((sum, r) => sum + r.costEst, 0) ?? 0;
  const maxAsserts = results?.reduce((m, r) => Math.max(m, r.assertions.length), 0) ?? 0;

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    setImportError('');
    const ok = importEvalConfig(text);
    if (!ok) setImportError('配置解析失败，请检查格式（支持 YAML / JSON）');
  };

  const handleExport = () => {
    const blob = new Blob([exportEvalConfig()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileStem(editingFilePath ?? docName)}.eval.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addVar = () => {
    if (!selected) return;
    addEvalCaseVar(selected.id, newVarName);
    setNewVarName('');
  };

  return (
    <div className="eval-view">
      <div className="ev-head">
        <div>
          <div className="ev-title">
            <FlaskConical size={18} /> 提示词评测
          </div>
          <div className="ev-sub">
            一组用例 + 一组断言 = 一次可复现的验证。改完 prompt 跑一次，才知道是真的变好还是只是感觉变好。
          </div>
        </div>
        <div className="ev-head-actions">
          <TourButton id="eval" />
          <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Upload size={12} /> 导入配置
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,.json"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
              e.target.value = '';
            }}
          />
          <button className="btn btn-ghost btn-sm" onClick={handleExport} disabled={evalCases.length === 0}>
            <Download size={12} /> 导出
          </button>
          {running ? (
            <button className="btn btn-danger btn-sm" onClick={cancelEval}>
              <Square size={12} /> 停止
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => void runEval()} disabled={evalCases.length === 0}>
              <Play size={12} /> 开始评测
            </button>
          )}
        </div>
      </div>

      <div className="ev-toolbar">
        <span className="ev-chip" title={targetVersion ? `正在评测历史版本 ${targetVersion.label}` : '被评测的提示词来源'}>
          <Circle size={7} className="ev-dot" />
          {targetVersion
            ? `${targetVersion.label} · 历史版本`
            : `${editingFilePath ? fileStem(editingFilePath) : fileStem(docName)}.md`}
          {targetVersion && (
            <button className="ev-chip-x" onClick={clearEvalTargetVersion} title="切回当前文档">×</button>
          )}
        </span>
        <span className="ev-chip">规则集 · {rulesetName}</span>
        <span className="ev-chip">模板变量 · {templateVars.length}</span>
        <span className="ev-chip">模型 · {modelName}</span>
        <span className="ev-spacer" />
        <label className="ev-role">
          提示词作为
          <select
            value={promptRole}
            onChange={e => setEvalPromptRole(e.target.value === 'user' ? 'user' : 'system')}
          >
            <option value="system">system（角色设定）</option>
            <option value="user">user（任务模板）</option>
          </select>
        </label>
      </div>

      {importError && (
        <div className="ev-banner">
          <AlertTriangle size={13} /> {importError}
        </div>
      )}

      {targetVersion && (
        <div className="ev-banner">
          <FlaskConical size={13} />
          正在用历史版本 {targetVersion.label} 的内容评测（不是编辑器里的当前内容），结果会绑定到 {targetVersion.label}。
          <button className="ev-banner-link" onClick={clearEvalTargetVersion}>切回当前文档</button>
        </div>
      )}

      <div className="ev-grid">
        {/* ── 用例列表 ── */}
        <aside className="ev-pane ev-cases">
          <div className="ev-pane-head">
            <span>用例 · {evalCases.length}</span>
            <button className="btn btn-ghost btn-xs" onClick={addEvalCase} title="新建用例">
              <Plus size={12} /> 新建
            </button>
          </div>

          {evalCases.length === 0 ? (
            <div className="ev-empty">
              <Sparkles size={20} />
              <div>还没有用例</div>
              <div className="ev-empty-sub">从一个可运行的示例开始，再改成你自己的</div>
              <div className="ev-empty-actions">
                <button className="btn btn-primary btn-xs" onClick={loadExampleEvalCases}>载入示例</button>
                <button className="btn btn-ghost btn-xs" onClick={addEvalCase}>空白新建</button>
              </div>
            </div>
          ) : (
            <div className="ev-case-list">
              {evalCases.map(c => {
                const active = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    className={`ev-case ${active ? 'active' : ''}`}
                    onClick={() => selectEvalCase(c.id)}
                  >
                    <div className="ev-case-main">
                      <div className="ev-case-name">{c.name || '未命名用例'}</div>
                      <div className="ev-case-meta">
                        {Object.keys(c.vars).length} 变量 · {c.asserts.length} 断言
                        {!c.input.trim() && <span className="ev-warn"> · 无输入</span>}
                      </div>
                    </div>
                    <div className="ev-case-ops" onClick={e => e.stopPropagation()}>
                      <button className="btn btn-icon btn-ghost btn-xs" title="复制用例" onClick={() => duplicateEvalCase(c.id)}>
                        <Copy size={11} />
                      </button>
                      <button className="btn btn-icon btn-ghost btn-xs" title="删除用例" onClick={() => removeEvalCase(c.id)}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* ── 用例编辑器 ── */}
        <section className="ev-pane ev-editor">
          <div className="ev-pane-head">
            <span>用例详情</span>
            {selected && (
              <span className="ev-pane-hint">
                {selected.asserts.length === 0 ? '无断言时只校验模型是否有返回' : `全部 ${selected.asserts.length} 条断言通过才算通过`}
              </span>
            )}
          </div>

          {!selected ? (
            <div className="ev-empty">
              <div>左侧选择一个用例</div>
              <div className="ev-empty-sub">或点击「载入示例」快速看到完整链路</div>
            </div>
          ) : (
            <div className="ev-editor-body">
              <div className="ev-field">
                <label>用例名称</label>
                <input
                  className="ws-input"
                  value={selected.name}
                  onChange={e => updateEvalCase(selected.id, { name: e.target.value })}
                  placeholder="如：明确结论 + 禁止模糊词"
                />
              </div>

              <div className="ev-field">
                <label>用户输入</label>
                <textarea
                  className="ev-textarea"
                  rows={3}
                  value={selected.input}
                  onChange={e => updateEvalCase(selected.id, { input: e.target.value })}
                  placeholder="发给模型的用户消息，如：退款多久到账？"
                />
              </div>

              <div className="ev-field">
                <label>
                  变量
                  <span className="ev-label-hint">
                    {templateVars.length === 0 ? '当前模板中没有 {{变量}}' : `模板中检测到 ${templateVars.length} 个`}
                  </span>
                </label>

                {missingVars.length > 0 && (
                  <div className="ev-missing">
                    模板变量未赋值：
                    {missingVars.map(v => (
                      <button
                        key={v}
                        className="ev-var-add"
                        onClick={() => addEvalCaseVar(selected.id, v)}
                        title="点击补入"
                      >
                        + {v}
                      </button>
                    ))}
                  </div>
                )}

                {Object.entries(selected.vars).length === 0 ? (
                  <div className="ev-empty-inline">未使用变量</div>
                ) : (
                  <div className="ev-var-list">
                    {Object.entries(selected.vars).map(([key, value]) => (
                      <div key={key} className="ev-var-row">
                        <span className="ev-var-key" title={key}>{key}</span>
                        <input
                          className="ws-input ev-var-input"
                          value={value}
                          onChange={e => setEvalCaseVar(selected.id, key, e.target.value)}
                          placeholder="值"
                        />
                        <button
                          className="btn btn-icon btn-ghost btn-xs"
                          onClick={() => removeEvalCaseVar(selected.id, key)}
                          title="移除变量"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="ev-var-new">
                  <input
                    className="ws-input"
                    value={newVarName}
                    onChange={e => setNewVarName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addVar(); }}
                    placeholder="新增变量名，回车添加"
                  />
                  <button className="btn btn-ghost btn-xs" onClick={addVar} disabled={!newVarName.trim()}>
                    <Plus size={11} />
                  </button>
                </div>
              </div>

              <div className="ev-field">
                <label>
                  断言
                  <span className="ev-label-hint">全部通过才算该用例通过</span>
                </label>

                <div className="ev-assert-list">
                  {selected.asserts.map(a => (
                    <div key={a.id} className="ev-assert">
                      <select
                        className="ev-assert-type"
                        value={a.type}
                        onChange={e => updateEvalAssertion(selected.id, a.id, { type: e.target.value as AssertionType })}
                      >
                        {ASSERTION_TYPES.map(t => (
                          <option key={t} value={t}>{ASSERTION_LABELS[t]}</option>
                        ))}
                      </select>

                      {a.type === 'llm-rubric' ? (
                        <textarea
                          className="ev-assert-input ev-assert-rubric"
                          rows={2}
                          value={a.value}
                          onChange={e => updateEvalAssertion(selected.id, a.id, { value: e.target.value })}
                          placeholder={ASSERTION_HINTS[a.type]}
                        />
                      ) : (
                        <input
                          className="ev-assert-input"
                          value={a.value}
                          onChange={e => updateEvalAssertion(selected.id, a.id, { value: e.target.value })}
                          placeholder={ASSERTION_HINTS[a.type]}
                        />
                      )}

                      {a.type === 'llm-rubric' && (
                        <input
                          className="ev-assert-threshold"
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={a.threshold ?? 0.7}
                          onChange={e => updateEvalAssertion(selected.id, a.id, { threshold: Number(e.target.value) })}
                          title="通过阈值（0-1）"
                        />
                      )}

                      <button
                        className="btn btn-icon btn-ghost btn-xs"
                        onClick={() => removeEvalAssertion(selected.id, a.id)}
                        title="删除断言"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="btn btn-ghost btn-xs ev-add-assert" onClick={() => addEvalAssertion(selected.id)}>
                  <Plus size={11} /> 添加断言
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── 结果 ── */}
        <section className="ev-pane ev-results">
          <div className="ev-pane-head">
            <span>评测结果</span>
            {currentRun && !running && (
              <span className="ev-pane-hint" title={`${currentRun.passed}/${currentRun.total} 用例通过`}>
                {currentRun.versionLabel ?? '未版本化'} · {scoreRun(currentRun)} 分
              </span>
            )}
            {results && (
              <button className="btn btn-ghost btn-xs" onClick={clearEvalResults}>清空</button>
            )}
          </div>

          {error && (
            <div className="ev-banner ev-banner-error">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {!results ? (
            <div className="ev-empty">
              <FlaskConical size={20} />
              <div>{running ? '正在评测…' : '还没有运行结果'}</div>
              <div className="ev-empty-sub">
                {running ? '结果会逐条出现' : '配置好用例后点右上角「开始评测」'}
              </div>
            </div>
          ) : (
            <>
              <div className="ev-summary">
                <div className="ev-stat">
                  <div className={`ev-stat-num ${passedCount === total && total > 0 ? 'ok' : total > 0 ? 'warn' : ''}`}>
                    {passedCount}/{total}
                  </div>
                  <div className="ev-stat-label">通过</div>
                </div>
                <div className="ev-stat">
                  <div className="ev-stat-num">{avgMs ? `${(avgMs / 1000).toFixed(1)}s` : '—'}</div>
                  <div className="ev-stat-label">平均耗时</div>
                </div>
                <div className="ev-stat">
                  <div className="ev-stat-num">{totalTokens}</div>
                  <div className="ev-stat-label">tokens（估）</div>
                </div>
                <div className="ev-stat">
                  <div className="ev-stat-num">${totalCost.toFixed(4)}</div>
                  <div className="ev-stat-label">成本（估）</div>
                </div>
              </div>

              <div className="ev-matrix-wrap">
                <table className="ev-matrix">
                  <thead>
                    <tr>
                      <th className="ev-th-case">用例</th>
                      {Array.from({ length: maxAsserts }).map((_, i) => {
                        const types = results
                          .map(r => r.assertions[i]?.type)
                          .filter((t): t is AssertionType => !!t);
                        const agreed = types.length > 0 && types.every(t => t === types[0]);
                        return (
                          <th key={i} title={agreed ? ASSERTION_HINTS[types[0]] : '各用例在此位置的断言不同，悬停单元格看明细'}>
                            {agreed ? ASSERTION_LABELS[types[0]] : `断言 ${i + 1}`}
                          </th>
                        );
                      })}
                      <th className="ev-th-time">耗时</th>
                      <th className="ev-th-state">结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const expanded = expandedResult === r.caseId;
                      return (
                        <Fragment key={r.caseId}>
                          <tr
                            className={`ev-row ${expanded ? 'expanded' : ''}`}
                            onClick={() => setExpandedResult(expanded ? null : r.caseId)}
                          >
                            <td className="ev-td-case">
                              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                              <span>{r.caseName}</span>
                            </td>
                            {Array.from({ length: maxAsserts }).map((_, i) => {
                              const a = r.assertions[i];
                              if (!a) return <td key={i} className="ev-td-cell muted">·</td>;
                              return (
                                <td
                                  key={i}
                                  className={`ev-td-cell ${a.passed ? 'pass' : 'fail'}`}
                                  title={`${ASSERTION_LABELS[a.type]} · ${a.detail}`}
                                >
                                  {a.passed ? <Check size={11} /> : <X size={11} />}
                                </td>
                              );
                            })}
                            <td className="ev-td-time">{(r.durationMs / 1000).toFixed(1)}s</td>
                            <td className={`ev-td-state ${r.passed ? 'pass' : 'fail'}`}>
                              {r.error ? '出错' : r.passed ? '通过' : '未通过'}
                            </td>
                          </tr>
                          {expanded && (
                            <tr key={`${r.caseId}-detail`} className="ev-detail-row">
                              <td colSpan={maxAsserts + 3}>
                                <div className="ev-detail">
                                  {r.error && (
                                    <div className="ev-detail-error"><AlertTriangle size={12} /> {r.error}</div>
                                  )}
                                  <div className="ev-detail-block">
                                    <div className="ev-detail-label">模型输出</div>
                                    <pre className="ev-output">{r.output || '（空）'}</pre>
                                  </div>
                                  <div className="ev-detail-block">
                                    <div className="ev-detail-label">断言明细</div>
                                    <ul className="ev-detail-list">
                                      {r.assertions.length === 0 && <li className="muted">该用例未配置断言</li>}
                                      {r.assertions.map(a => (
                                        <li key={a.assertionId} className={a.passed ? 'pass' : 'fail'}>
                                          {a.passed ? <Check size={11} /> : <X size={11} />}
                                          <span className="ev-detail-type">{ASSERTION_LABELS[a.type]}</span>
                                          <span className="ev-detail-text">{a.detail}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="ev-detail-foot">
                                    <Clock size={11} /> {r.durationMs}ms · {r.tokensEst} tokens · ${r.costEst.toFixed(4)}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* P1-2：与基线对比；退化用例可展开定位到 changeBlock */}
              {currentRun && baselineRun && !running && (
                <BaselinePanel
                  current={currentRun}
                  baseline={baselineRun}
                  versions={versions}
                  cases={evalCases}
                  onJumpToVersion={() => setActiveView('history')}
                  onRestore={() => restoreEvalSnapshot(currentRun.id)}
                />
              )}
            </>
          )}

          {runs.length > 0 && (
            <div className="ev-history">
              <div className="ev-history-head">历史运行</div>
              {runs.slice(0, 6).map(run => (
                <div key={run.id} className="ev-history-row" onClick={() => viewEvalRun(run.id)}>
                  <span className="ev-history-time">
                    {new Date(run.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className="ev-history-ver" title="评测绑定的版本">{run.versionLabel ?? '未版本化'}</span>
                  <span className="ev-history-model">{run.modelName}</span>
                  <span
                    className={`ev-history-score ${run.passed === run.total ? 'ok' : ''}`}
                    title={`${run.passed}/${run.total} 用例通过 · 用例集 ${run.datasetHash?.slice(0, 8) ?? '未快照'}`}
                  >
                    {run.score ?? scoreRun(run)} 分
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
