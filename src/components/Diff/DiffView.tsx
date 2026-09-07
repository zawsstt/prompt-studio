import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import type { DiffLine, SelectionQuickActionType } from '../../types';
import { estimateTokens } from '../../lib/diff';
import { Check, X, ChevronUp, ChevronDown, XCircle, ChevronRight, FileText } from 'lucide-react';
import SelectionToolbar from '../shared/SelectionToolbar';

/** Selection toolbar state for the diff view (P1-8). */
interface DiffSelection {
  anchor: { top: number; left: number; bottom: number };
  charCount: number;
  source: 'diff-left' | 'diff-right';
  text: string;
}

/** 对齐行：Diffchecker 风格 — 每行 = 左行号 + 左内容 + 右行号 + 右内容 */
interface AlignedRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/**
 * 左右数组由 buildDiffLines 保证行级对齐（removed ↔ empty、added ↔ empty、
 * replaced ↔ replaced/empty、equal ↔ equal），直接 zip 即可。
 */
function buildAlignedRows(left: DiffLine[], right: DiffLine[]): AlignedRow[] {
  const len = Math.max(left.length, right.length);
  const rows: AlignedRow[] = [];
  for (let i = 0; i < len; i++) {
    rows.push({ left: left[i] ?? null, right: right[i] ?? null });
  }
  return rows;
}

export default function DiffView() {
  const diffLeftLines = useStore(s => s.diffLeftLines);
  const diffRightLines = useStore(s => s.diffRightLines);
  const changeBlocks = useStore(s => s.changeBlocks);
  const currentChangeIdx = useStore(s => s.currentChangeIdx);
  const ignoreWhitespace = useStore(s => s.ignoreWhitespace);
  const ignoreReorder = useStore(s => s.ignoreReorder);
  const candidateContent = useStore(s => s.candidateContent);
  const diffQueue = useStore(s => s.diffQueue);
  const currentDiffFileIdx = useStore(s => s.currentDiffFileIdx);
  const setDiffFile = useStore(s => s.setDiffFile);

  const acceptAll = useStore(s => s.acceptAll);
  const rejectAll = useStore(s => s.rejectAll);
  const nextChange = useStore(s => s.nextChange);
  const prevChange = useStore(s => s.prevChange);
  const closeDiff = useStore(s => s.closeDiff);
  const setIgnoreWhitespace = useStore(s => s.setIgnoreWhitespace);
  const setIgnoreReorder = useStore(s => s.setIgnoreReorder);
  const setModLogChange = useStore(s => s.setModLogChange);
  const toggleModLog = useStore(s => s.toggleModLog);
  const selectionQuickAction = useStore(s => s.selectionQuickAction);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [hoverBubble, setHoverBubble] = useState<{ x: number; y: number; idx: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [diffSelection, setDiffSelection] = useState<DiffSelection | null>(null);
  const selTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rows = buildAlignedRows(diffLeftLines, diffRightLines);

  // P1-8: capture text selection inside the diff body (50ms debounce, ≥2 chars).
  // 动态识别选区落在左侧（修改前）还是右侧（候选修改）单元格。
  const handleBodyMouseUp = () => {
    if (selTimer.current) clearTimeout(selTimer.current);
    selTimer.current = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setDiffSelection(null);
        return;
      }
      const text = sel.toString();
      if (text.trim().length < 2) {
        setDiffSelection(null);
        return;
      }
      const pane = bodyRef.current;
      if (!pane || !sel.anchorNode || !pane.contains(sel.anchorNode)) {
        return;
      }

      // 由选区锚点节点向上查找所属单元格，判定左右侧
      const anchorEl = sel.anchorNode instanceof Element
        ? sel.anchorNode
        : sel.anchorNode?.parentElement;
      let side: 'diff-left' | 'diff-right' | null = null;
      if (anchorEl) {
        if (anchorEl.closest('.dc-cell-left')) side = 'diff-left';
        else if (anchorEl.closest('.dc-cell-right')) side = 'diff-right';
      }
      if (!side) {
        setDiffSelection(null);
        return;
      }

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setDiffSelection({
        anchor: { top: rect.top, left: rect.left + rect.width / 2, bottom: rect.bottom },
        charCount: text.length,
        source: side,
        text,
      });
    }, 50);
  };

  const handleSelectionAction = (action: SelectionQuickActionType) => {
    if (!diffSelection) return;
    selectionQuickAction(action, {
      text: diffSelection.text,
      source: diffSelection.source,
    });
    setDiffSelection(null);
  };

  // Clear the selection toolbar when the diff view unmounts
  useEffect(() => {
    return () => {
      if (selTimer.current) clearTimeout(selTimer.current);
    };
  }, []);

  // 键盘跳转（N/P）后滚动跟随当前变更块
  useEffect(() => {
    if (currentChangeIdx < 0) return;
    const el = document.querySelector(`[data-change-idx="${currentChangeIdx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentChangeIdx]);

  // Stats
  const addCount = diffRightLines.filter(l => l.type === 'added' || (l.type === 'replaced' && l.changeBlockIdx !== undefined)).length;
  const delCount = diffLeftLines.filter(l => l.type === 'removed' || (l.type === 'replaced' && l.changeBlockIdx !== undefined)).length;
  // Token 估算跟随当前对比项（文件模式下是文件内容，而非固定 candidateContent）
  const curTarget = diffQueue?.[currentDiffFileIdx];
  const tokenEst = curTarget ? estimateTokens(curTarget.right) : (candidateContent ? estimateTokens(candidateContent) : 0);

  const handleLineHover = (e: React.MouseEvent, idx: number | undefined) => {
    if (idx === undefined) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);

    hoverTimer.current = setTimeout(() => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHoverBubble({
        x: Math.min(rect.right + 12, window.innerWidth - 220),
        y: Math.max(rect.top, 60),
        idx,
      });

      fadeTimer.current = setTimeout(() => {
        setHoverBubble(null);
      }, 5000);
    }, 150);
  };

  const handleLineLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setHoverBubble(null), 400);
  };

  const handleBubbleClick = (idx: number) => {
    setHoverBubble(null);
    setModLogChange(idx);
    toggleModLog(true);
  };

  /**
   * 行内字符级差异按侧别渲染（Diffchecker 语义）：
   * - 左侧（修改前）：显示原文本，被删除的字符标红底删除线，新增部分不显示；
   * - 右侧（候选修改）：显示新文本，新增的字符标绿底，删除部分不显示。
   * charDiffs 是同一数组，必须按侧过滤，否则右侧会出现"删除标记"。
   */
  const renderContent = (line: DiffLine, side: 'left' | 'right') => {
    if (line.charDiffs && line.charDiffs.length > 1) {
      return line.charDiffs.map((cd, i) => {
        if (side === 'left') {
          if (cd.type === 'add') return null;
          if (cd.type === 'del') return <span key={i} className="char-del">{cd.text}</span>;
          return <span key={i}>{cd.text}</span>;
        }
        if (cd.type === 'del') return null;
        if (cd.type === 'add') return <span key={i} className="char-add">{cd.text}</span>;
        return <span key={i}>{cd.text}</span>;
      });
    }
    return line.content || ' ';
  };

  /** 单元格类型：added/removed/replaced/reordered/equal/empty */
  const cellType = (line: DiffLine | null, side: 'left' | 'right'): string => {
    if (!line || line.type === 'empty') return 'empty';
    if (line.type === 'equal') return 'equal';
    if (line.type === 'removed') return 'removed';
    if (line.type === 'added') return 'added';
    if (line.type === 'reordered') return 'reordered';
    return 'replaced';
  };

  const renderCell = (line: DiffLine | null, side: 'left' | 'right') => {
    const type = cellType(line, side);
    const lineNum = line ? (side === 'left' ? line.oldLineNum : line.newLineNum) : undefined;
    const isStriped = line === null || line.type === 'empty';
    const stripeClass = type === 'removed' ? 'dc-stripes-del' : type === 'added' ? 'dc-stripes-add' : '';

    return (
      <>
        <span className={`dc-gutter dc-gutter-${side} ${type !== 'equal' && type !== 'empty' ? 'accent' : ''}`}>
          {lineNum ?? ''}
        </span>
        <span className={`dc-cell dc-cell-${side} ${type} ${isStriped ? `empty ${stripeClass}` : ''}`}>
          {line && line.type !== 'empty' ? renderContent(line, side) : ''}
        </span>
      </>
    );
  };

  const renderRow = (row: AlignedRow, i: number) => {
    const { left, right } = row;
    const changeIdx = left?.changeBlockIdx ?? right?.changeBlockIdx;
    const accepted = changeIdx !== undefined ? changeBlocks[changeIdx]?.accepted : undefined;

    // 行类型（Diffchecker 配色语义）
    let rowType = 'equal';
    const lt = left?.type;
    const rt = right?.type;
    if (lt === 'removed' || rt === 'removed') rowType = 'removed';
    else if (lt === 'added' || rt === 'added') rowType = 'added';
    else if (lt === 'reordered' || rt === 'reordered') rowType = 'reordered';
    else if (lt === 'replaced' || rt === 'replaced') rowType = 'replaced';

    const statusClass = accepted === true ? 'accepted' : accepted === false ? 'rejected' : '';
    const isCurrent = changeIdx !== undefined && changeIdx === currentChangeIdx;
    const interactive = changeIdx !== undefined;

    return (
      <div
        key={i}
        className={`dc-row ${rowType} ${statusClass} ${isCurrent ? 'current' : ''}`}
        data-change-idx={changeIdx}
        data-row-type={rowType}
        onMouseEnter={(e) => interactive && handleLineHover(e, changeIdx)}
        onMouseLeave={handleLineLeave}
        onClick={() => {
          if (interactive) {
            setModLogChange(changeIdx);
          }
        }}
      >
        {renderCell(left, 'left')}
        {renderCell(right, 'right')}
      </div>
    );
  };

  return (
    <div className="diff-overlay active">
      {/* Toolbar */}
      <div className="diff-toolbar">
        <button className="btn btn-success btn-sm" onClick={acceptAll}>
          <Check size={12} /> 接受全部
        </button>
        <button className="btn btn-danger btn-sm" onClick={rejectAll}>
          <X size={12} /> 拒绝全部
        </button>
        <button className="btn btn-secondary btn-sm" onClick={prevChange}>
          <ChevronUp size={12} /> 上一处
        </button>
        <button className="btn btn-secondary btn-sm" onClick={nextChange}>
          <ChevronDown size={12} /> 下一处
        </button>
        <div className="divider-vertical" />
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ignoreWhitespace}
            onChange={(e) => setIgnoreWhitespace(e.target.checked)}
          />
          忽略纯格式/空行
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ignoreReorder}
            onChange={(e) => setIgnoreReorder(e.target.checked)}
          />
          忽略重排
        </label>
        <span className="spacer" />

        {/* Change Summary Dropdown */}
        {changeBlocks.length > 0 && (
          <div className={`change-summary ${summaryOpen ? 'expanded' : ''}`}>
            <div className="cs-header" onClick={() => setSummaryOpen(!summaryOpen)}>
              <ChevronRight size={12} className="cs-chevron" />
              <span className="cs-count">{changeBlocks.length} 处修改</span>
              {changeBlocks.filter(b => b.type === 'reordered').length > 0 && (
                <span className="cs-badge cs-badge-reorder">
                  {changeBlocks.filter(b => b.type === 'reordered').length} 重排
                </span>
              )}
              {changeBlocks.filter(b => b.explanation?.why || b.explanation?.how || b.explanation?.effect).length > 0 && (
                <span className="cs-badge">{changeBlocks.filter(b => b.explanation?.why || b.explanation?.how || b.explanation?.effect).length} 有说明</span>
              )}
            </div>
            {summaryOpen && (
              <div className="cs-body">
                {changeBlocks.map((cb, idx) => {
                  const typeLabel: Record<string, string> = { added: '新增', removed: '删除', replaced: '替换', reordered: '重排' };
                  const label = typeLabel[cb.type] || '修改';
                  const snippet = (cb.newSnippet || cb.oldSnippet || '').slice(0, 60);
                  const hasExplanation = cb.explanation?.why || cb.explanation?.how || cb.explanation?.effect;
                  return (
                    <div
                      key={cb.id}
                      className={`cs-item ${idx === currentChangeIdx ? 'cs-item-active' : ''}`}
                      onClick={() => {
                        setModLogChange(idx);
                        const el = document.querySelector(`[data-change-idx="${idx}"]`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <span className={`cs-type cs-type-${cb.type}`}>{label}</span>
                      <span className="cs-snippet">{snippet}{snippet.length >= 60 ? '…' : ''}</span>
                      {hasExplanation && (
                        <div className="cs-why">
                          {cb.explanation?.why && <div className="cs-why-row"><span className="cs-why-label">Why</span>{cb.explanation.why.slice(0, 100)}{(cb.explanation.why?.length ?? 0) > 100 ? '…' : ''}</div>}
                          {cb.explanation?.how && <div className="cs-why-row"><span className="cs-why-label">How</span>{cb.explanation.how.slice(0, 100)}{(cb.explanation.how?.length ?? 0) > 100 ? '…' : ''}</div>}
                          {cb.explanation?.effect && <div className="cs-why-row"><span className="cs-why-label">Effect</span>{cb.explanation.effect.slice(0, 100)}{(cb.explanation.effect?.length ?? 0) > 100 ? '…' : ''}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="diff-stats">
          <span>{changeBlocks.length} 处修改</span>
          <span><span className="stat-dot" style={{ background: 'var(--diff-add)' }} /> +{addCount}</span>
          <span><span className="stat-dot" style={{ background: 'var(--diff-del)' }} /> -{delCount}</span>
          <span style={{ color: 'var(--text-muted)' }}>~{tokenEst} tokens</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={closeDiff} title="退出对比">
          <XCircle size={12} /> 退出
        </button>
      </div>

      {/* Brand spec §5.2: four-color spectrum strip along the toolbar's lower edge */}
      <div className="diff-spectrum" />

      {/* 多文件对比队列：按文件顺序逐一展示（一个文件对比完自动切下一个） */}
      {diffQueue && diffQueue.length > 1 && (
        <div className="diff-file-tabs">
          {diffQueue.map((q, i) => (
            <button
              key={q.key}
              className={`diff-file-tab ${i === currentDiffFileIdx ? 'on' : ''} ${q.key !== '' && i < currentDiffFileIdx ? 'done' : ''}`}
              onClick={() => setDiffFile(i)}
              title={i === currentDiffFileIdx ? '当前对比文件' : '切换到该文件对比'}
            >
              <FileText size={11} />
              <span className="diff-file-tab-name">{q.label}</span>
              {i < currentDiffFileIdx && <span className="diff-file-tab-done">✓</span>}
              {i === currentDiffFileIdx && diffQueue.length > 1 && (
                <span className="diff-file-tab-order">{i + 1}/{diffQueue.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Diffchecker 风格对齐行视图：单滚动容器，行 = [左行号|左内容|右行号|右内容] */}
      <div className="dc-view">
        <div className="dc-head">
          <div className="dc-head-cell left">
            <span className="label-dot" style={{ background: 'var(--diff-del)' }} />
            修改前
          </div>
          <div className="dc-head-cell right">
            <span className="label-dot" style={{ background: 'var(--diff-add)' }} />
            候选修改
          </div>
        </div>
        <div
          className="dc-body"
          ref={bodyRef}
          onMouseUp={handleBodyMouseUp}
        >
          {rows.map((row, i) => renderRow(row, i))}
        </div>
      </div>

      {/* Hover Bubble */}
      {hoverBubble && changeBlocks[hoverBubble.idx] && (
        <div
          className="hover-bubble"
          style={{ left: hoverBubble.x, top: hoverBubble.y }}
          onClick={(e) => {
            e.stopPropagation();
            handleBubbleClick(hoverBubble.idx);
          }}
          onMouseEnter={() => {
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
          }}
          onMouseLeave={handleLineLeave}
        >
          {changeBlocks[hoverBubble.idx].explanation ? (
            <div className="hover-bubble-explain">
              <div className="hbe-row">
                <span className="hbe-label">Why</span>
                <span className="hbe-text">{changeBlocks[hoverBubble.idx].explanation!.why}</span>
              </div>
              <div className="hbe-row">
                <span className="hbe-label">How</span>
                <span className="hbe-text">{changeBlocks[hoverBubble.idx].explanation!.how}</span>
              </div>
              <div className="hbe-row">
                <span className="hbe-label">Effect</span>
                <span className="hbe-text">{changeBlocks[hoverBubble.idx].explanation!.effect}</span>
              </div>
            </div>
          ) : (
            <>
              查看修改详情 <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>Enter</span>
              {changeBlocks[hoverBubble.idx].pendingConfirmation && (
                <span style={{ fontSize: '9px', color: 'var(--warn)', display: 'block', marginTop: '2px' }}>
                  ⚠ 说明待人工确认
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* P1-8: selection toolbar for diff panes (portal) */}
      {diffSelection && createPortal(
        <SelectionToolbar
          anchor={diffSelection.anchor}
          charCount={diffSelection.charCount}
          source={diffSelection.source}
          onAction={handleSelectionAction}
          onClose={() => setDiffSelection(null)}
        />,
        document.body
      )}
    </div>
  );
}
