import { useEffect, useRef } from 'react';
import { HelpCircle, Lightbulb, Sparkles, Wrench } from 'lucide-react';
import type { SelectionQuickActionType, SelectionSource } from '../../types';

/**
 * SelectionToolbar (P1-8) — floating toolbar shown when the user selects text
 * in the editor or in the Diff panes. Pure presentational component: the host
 * computes the anchor position and handles the actions.
 *
 * Behavior aligned with the legacy js/selection-toolbar.js:
 * - flips below the selection when there is less than ~60px above it
 * - hides on Escape / scroll / outside mousedown (global listeners live here)
 */

export interface SelectionToolbarProps {
  /** Viewport coordinates of the selection; `bottom` enables below-flip. */
  anchor: { top: number; left: number; bottom?: number } | null;
  charCount: number;
  source: SelectionSource;
  onAction: (action: SelectionQuickActionType) => void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<SelectionSource, string> = {
  editor: '编辑器',
  'diff-left': '修改前（左）',
  'diff-right': '修改后（右）',
};

const ACTION_TITLES: Record<SelectionQuickActionType, string> = {
  ask: '针对选中内容提问（预填到输入框）',
  explain: '解释选中内容（自动发送）',
  improve: '优化选中内容（自动发送）',
  fix: '检查并修复选中内容（预填到输入框）',
};

const ACTIONS: {
  key: SelectionQuickActionType;
  label: string;
  icon: typeof HelpCircle;
  primary?: boolean;
}[] = [
  { key: 'ask', label: '询问', icon: HelpCircle },
  { key: 'explain', label: '解释', icon: Lightbulb },
  { key: 'improve', label: '优化', icon: Sparkles, primary: true },
  { key: 'fix', label: '修复', icon: Wrench },
];

/** Approximate rendered height, used for the above/below flip. */
const TOOLBAR_HEIGHT = 40;
/** Approximate rendered width, used for viewport edge clamping. */
const TOOLBAR_WIDTH = 340;

export default function SelectionToolbar({
  anchor,
  charCount,
  source,
  onAction,
  onClose,
}: SelectionToolbarProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Global hide triggers: Escape, scroll (capture), and outside mousedown.
  useEffect(() => {
    if (!anchor) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = () => onClose();
    const handleMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  // Position above the selection; flip below when less than 60px of room above.
  let top = anchor.top - TOOLBAR_HEIGHT - 8;
  if (top < 60) {
    top = (anchor.bottom ?? anchor.top) + 8;
  }
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - TOOLBAR_WIDTH - 8));

  return (
    <div
      ref={rootRef}
      className="st-toolbar"
      style={{ top, left }}
      // Keep the text selection alive while interacting with the toolbar.
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="st-source">{SOURCE_LABELS[source]}</span>
      <span className="st-char-count">{charCount} 字符</span>
      <span className="st-divider" />
      {ACTIONS.map(({ key, label, icon: Icon, primary }) => (
        <button
          key={key}
          type="button"
          className={`st-action${primary ? ' primary' : ''}`}
          title={ACTION_TITLES[key]}
          onClick={() => {
            onAction(key);
            onClose();
          }}
        >
          <Icon size={13} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
