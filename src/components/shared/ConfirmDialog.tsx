import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * ConfirmDialog (P1-3) — generic confirmation overlay.
 * Renders a title, a slotted body, and confirm/cancel buttons.
 * Dismisses on Escape or overlay mousedown. Used for the auto-organize
 * preview, and intended as the standard confirm layer for new flows
 * (see impl-plan §5.5).
 */

export interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Render the confirm button as a destructive action. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  children,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      className="confirm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="confirm-header">
          <span className="confirm-title">{title}</span>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-xs confirm-close"
            onClick={onCancel}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
        <div className="confirm-body">{children}</div>
        <div className="confirm-footer">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={danger ? { background: 'var(--error)' } : undefined}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
