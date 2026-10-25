// ── Regression baseline panel (P1-2 / P1-2b) ──
//
// 做的事只有一件：把「本次运行」和「上一次基线」摆在一起，先把退化用例挑出来，
// 再把最可疑的 changeBlock 摊开给用户看。定位是启发式的，必须标注依据。
//
// 用例集可能被改过：两次运行的用例快照指纹不一致时，整体分数不再直接可比，
// 涨跌改按「共同用例」计算，并明确标出新增/移除/修改了多少条。

import { useMemo, useState } from 'react';
import {
  ArrowRight, ChevronDown, ChevronRight, GitCompare, Link2, AlertTriangle, X,
  Database, RotateCcw,
} from 'lucide-react';
import { diffRuns, locateRegression, UNVERSIONED_LABEL } from '../../lib/eval/baseline';
import type { CaseDelta } from '../../lib/eval/baseline';
import { shortDatasetHash } from '../../lib/eval/dataset';
import { ASSERTION_LABELS } from '../../lib/eval/assertions';
import type { EvalCase, EvalRun } from '../../types';
import type { VersionRecord } from '../../store/db';

interface Props {
  current: EvalRun;
  baseline: EvalRun;
  versions: VersionRecord[];
  /** 当前编辑器里的用例：旧运行没有快照时用它兜底做变更定位 */
  cases: EvalCase[];
  onJumpToVersion: (versionId: string) => void;
  /** 把本次运行的用例快照载回编辑器 */
  onRestore: () => void;
}

const BLOCK_TYPE_LABEL: Record<string, string> = {
  added: '新增',
  removed: '删除',
  replaced: '替换',
  reordered: '重排',
};

const CONFIDENCE_LABEL = { high: '高相关', medium: '可能相关', low: '弱相关' } as const;

const truncate = (text: string, n = 320) => (text.length > n ? `${text.slice(0, n)}…` : text);

const timeOf = (run: EvalRun) =>
  new Date(run.createdAt).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function BaselinePanel({
  current, baseline, versions, cases, onJumpToVersion, onRestore,
}: Props) {
  const diff = useMemo(() => diffRuns(baseline, current), [baseline, current]);
  const currentVersion = current.versionId
    ? versions.find(v => v.id === current.versionId)
    : undefined;

  const [openKey, setOpenKey] = useState<string | null>(null);

  // 用例集不同（且两次都有快照）→ 涨跌只看共同用例
  const useComparable = diff.datasetKnown && !diff.sameDataset;
  const noOverlap = useComparable && diff.comparableCount === 0;
  const shownDelta = useComparable ? diff.comparableDelta : diff.scoreDelta;
  const deltaClass = noOverlap ? '' : shownDelta > 0 ? 'up' : shownDelta < 0 ? 'down' : '';
  const deltaText = noOverlap
    ? '不可比'
    : useComparable
      ? `共同 ${shownDelta === 0 ? '±0' : signed(shownDelta)}`
      : shownDelta === 0 ? '±0' : signed(shownDelta);

  const items = [...diff.regressed, ...diff.changed, ...diff.fixed];
  /** 变更定位优先用运行快照：用例后来被改过也能对上当时的断言 */
  const localizeCases = current.dataset ?? cases;

  const datasetState = !diff.datasetKnown ? 'unknown' : diff.sameDataset ? 'same' : 'diff';
  const datasetStateText = !diff.datasetKnown ? '旧运行未存快照' : diff.sameDataset ? '一致' : '已变化';

  const renderDelta = (d: CaseDelta) => {
    const open = openKey === d.key;
    const regressed = d.status === 'regressed';
    const changed = d.status === 'changed';
    const located = open && regressed && currentVersion
      ? locateRegression(d, currentVersion, localizeCases)
      : [];

    const label = regressed ? '退化' : changed ? '改动' : '修复';
    const tagClass = regressed ? 'fail' : changed ? 'warn' : 'pass';
    const meta = regressed
      ? `${d.failingAssertions.length} 条断言未通过`
      : changed
        ? `用例${(d.changedFields ?? []).join('/') || '内容'}已修改，不参与比较`
        : '本次通过';

    return (
      <div className={`ev-bl-case ${regressed ? 'regressed' : changed ? 'changed' : 'fixed'}`} key={d.key}>
        <button
          className="ev-bl-case-head"
          onClick={() => { if (regressed) setOpenKey(open ? null : d.key); }}
          disabled={!regressed}
          title={regressed ? '点击查看失败的断言与疑似相关变更' : changed ? '用例本身改了，两次分数不可比较' : '本次已通过'}
        >
          {regressed
            ? (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />)
            : <span className="ev-bl-dot" />}
          <span className={`ev-bl-tag ${tagClass}`}>{label}</span>
          <span className="ev-bl-case-name">{d.caseName}</span>
          <span className="ev-bl-case-meta">{meta}</span>
        </button>

        {open && regressed && (
          <div className="ev-bl-case-body">
            {d.failingAssertions.length > 0 && (
              <ul className="ev-bl-asserts">
                {d.failingAssertions.map(a => (
                  <li key={a.assertionId}>
                    <X size={10} />
                    <span className="ev-bl-assert-type">{ASSERTION_LABELS[a.type]}</span>
                    <span className="ev-bl-assert-text">{a.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            {!currentVersion ? (
              <div className="ev-bl-none">
                <AlertTriangle size={11} />
                本次运行未绑定版本（{current.versionLabel ?? UNVERSIONED_LABEL}），没有可回溯的变更块。
              </div>
            ) : located.length > 0 ? (
              <div className="ev-bl-blocks">
                <div className="ev-bl-blocks-title">
                  <Link2 size={11} /> 疑似相关变更 · {currentVersion.label}（启发式定位，非精确归因）
                </div>
                {located.map(item => (
                  <div className="ev-bl-block" key={item.block.id}>
                    <div className="ev-bl-block-head">
                      <span className={`ev-bl-conf ${item.confidence}`}>{CONFIDENCE_LABEL[item.confidence]}</span>
                      <span className="ev-bl-block-type">{BLOCK_TYPE_LABEL[item.block.type] ?? item.block.type}</span>
                      <span className="ev-bl-block-score">相关度 {item.score}</span>
                    </div>
                    {item.block.explanation?.why && (
                      <div className="ev-bl-why">{item.block.explanation.why}</div>
                    )}
                    <div className="ev-bl-snippets">
                      {item.block.oldSnippet && (
                        <pre className="ev-bl-old">- {truncate(item.block.oldSnippet)}</pre>
                      )}
                      {item.block.newSnippet && (
                        <pre className="ev-bl-new">+ {truncate(item.block.newSnippet)}</pre>
                      )}
                    </div>
                    {item.signals.length > 0 && (
                      <div className="ev-bl-signals">依据：{item.signals.join(' · ')}</div>
                    )}
                  </div>
                ))}
                <button
                  className="btn btn-ghost btn-xs ev-bl-jump"
                  onClick={() => onJumpToVersion(currentVersion.id)}
                >
                  <ArrowRight size={11} /> 在版本时间线中查看 {currentVersion.label}
                </button>
              </div>
            ) : (
              <div className="ev-bl-none">
                <AlertTriangle size={11} />
                {' '}没有从 {currentVersion.label} 的变更片段里找到相关改动，建议对比两次的模型输出人工复核。
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="ev-baseline">
      <div className="ev-baseline-head">
        <span className="ev-baseline-title">
          <GitCompare size={13} /> 回归基线
        </span>
        <span className="ev-baseline-spacer" />
        <span className={`ev-baseline-delta ${deltaClass}`} title={
          useComparable
            ? `整体 ${diff.scoreBefore} → ${diff.scoreAfter} 分；按共同 ${diff.comparableCount} 条用例计算`
            : undefined
        }>
          {deltaText}
        </span>
      </div>

      <div className="ev-bl-dataset">
        <Database size={11} />
        <span className="ev-bl-dataset-label">用例集</span>
        <code title="基线运行">{shortDatasetHash(diff.datasetHashBefore)}</code>
        <span className="ev-bl-dataset-arrow">→</span>
        <code title="本次运行">{shortDatasetHash(diff.datasetHashAfter)}</code>
        <span className={`ev-bl-dataset-state ${datasetState}`}>{datasetStateText}</span>
        {current.dataset && current.dataset.length > 0 && (
          <button
            className="btn btn-ghost btn-xs ev-bl-restore"
            onClick={onRestore}
            title="把这套用例载回编辑器（会替换当前用例集）"
          >
            <RotateCcw size={10} /> 载入本次用例集
          </button>
        )}
      </div>

      <div className="ev-baseline-flow">
        <span className="ev-baseline-run">
          <em>{baseline.versionLabel ?? UNVERSIONED_LABEL}</em>
          <b>{diff.scoreBefore} 分</b>
          <small>{timeOf(baseline)} · {baseline.modelName}</small>
        </span>
        <ArrowRight size={12} className="ev-baseline-arrow" />
        <span className="ev-baseline-run current">
          <em>{current.versionLabel ?? UNVERSIONED_LABEL}</em>
          <b>{diff.scoreAfter} 分</b>
          <small>{timeOf(current)} · {current.modelName}</small>
        </span>
      </div>

      {useComparable && (
        <div className="ev-bl-note ev-bl-note-warn">
          <AlertTriangle size={11} />
          <span>
            {noOverlap
              ? '两次运行的用例集没有重合，分数不可比。'
              : `用例集已变化：新增 ${diff.added.length} · 移除 ${diff.removed.length} · 修改 ${diff.changed.length}。`}
            {!noOverlap && (
              <>
                {' '}涨跌只看共同 {diff.comparableCount} 条用例（{diff.comparableBefore} → {diff.comparableAfter} 分）；
                整体 {diff.scoreBefore} → {diff.scoreAfter} 分仅供参考。
              </>
            )}
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="ev-bl-none">
          {useComparable
            ? '共同用例上没有状态变化。'
            : diff.added.length + diff.removed.length > 0
              ? '除用例集变化外，没有用例状态变化。'
              : `与基线相比没有用例状态变化（${diff.scoreBefore} → ${diff.scoreAfter} 分）。`}
        </div>
      ) : (
        <div className="ev-bl-list">
          {items.map(renderDelta)}
        </div>
      )}

      <div className="ev-bl-foot">
        分数 = 通过用例数 / 总用例数。用例集改过时只按共同用例算涨跌；
        点击「退化」用例可展开失败断言与疑似相关变更。
      </div>
    </section>
  );
}
