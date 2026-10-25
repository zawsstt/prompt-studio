import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, Shield, X, Zap } from 'lucide-react';
import { TOURS } from '../../lib/tours';
import { useStore } from '../../store/useStore';

const POPOVER_W = 330;
const POPOVER_H = 216;

/**
 * 模块级功能引导（P1-13）。
 * - 目标存在：聚光灯挖洞 + 锚定气泡；目标不存在：居中卡片。
 * - 大面板（编辑区/对话/对比）把气泡放在面板左上角，避免指向屏幕外。
 * - Esc 关闭，←/→ 切换步骤。
 */
export default function ModuleTour() {
  const activeTour = useStore(s => s.activeTour);
  const endTour = useStore(s => s.endTour);

  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vp, setVp] = useState({ w: 1440, h: 900 });

  const tour = activeTour ? TOURS[activeTour] : null;
  const steps = tour?.steps ?? [];
  const step = steps[idx];
  const popoverH = step?.visual ? 300 : POPOVER_H;

  useEffect(() => {
    setIdx(0);
  }, [activeTour]);

  useEffect(() => {
    if (!activeTour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        endTour();
      } else if (e.key === 'ArrowRight') {
        setIdx(i => Math.min(i + 1, steps.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setIdx(i => Math.max(i - 1, 0));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeTour, endTour, steps.length]);

  useLayoutEffect(() => {
    if (!activeTour || !step) return;
    let raf1 = 0;
    let raf2 = 0;
    let settleTimer = 0;
    const update = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      if (!step.target) {
        setRect(null);
        return;
      }
      const candidates = Array.from(document.querySelectorAll(step.target));
      const el = candidates.find(node => {
        const r = node.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      });
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    // 面板可能还在入场布局中：下一帧再量一次，避免聚光灯先闪在左上角。
    raf1 = window.requestAnimationFrame(() => {
      update();
      raf2 = window.requestAnimationFrame(update);
    });
    settleTimer = window.setTimeout(update, 120);
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    const timer = window.setInterval(update, 400);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
      window.clearInterval(timer);
    };
  }, [activeTour, step]);

  const pos = useMemo(() => {
    if (!rect) return { center: true as const, top: 0, left: 0 };
    const isBig = rect.height > vp.h * 0.55 || rect.width > vp.w * 0.55;
    if (isBig) {
      const top = Math.min(Math.max(24, rect.top + 18), Math.max(24, vp.h - popoverH - 16));
      const left = Math.min(Math.max(16, rect.left + 18), Math.max(16, vp.w - POPOVER_W - 16));
      return { center: false as const, top, left };
    }
    let top = rect.bottom + 14;
    if (top + popoverH > vp.h - 12) top = rect.top - popoverH - 14;
    if (top < 12) top = Math.max(12, Math.min(vp.h - popoverH - 12, vp.h / 2 - popoverH / 2));
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - POPOVER_W / 2), vp.w - POPOVER_W - 12);
    return { center: false as const, top, left };
  }, [rect, vp, popoverH]);

  if (!activeTour || !tour || !step) return null;

  const holeStyle = rect
    ? {
        left: Math.max(0, rect.left - 6),
        top: Math.max(0, rect.top - 6),
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : undefined;

  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-label={`${tour.title} 功能引导`}>
      {rect ? <div className="tour-hole" style={holeStyle} /> : <div className="tour-dim" />}

      <div
        className={`tour-popover ${pos.center ? 'center' : ''}`}
        style={pos.center ? undefined : { top: pos.top, left: pos.left }}
      >
        <div className="tour-progressbar">
          <span style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="tour-head">
          <span className="tour-badge"><Compass size={12} /> 功能引导 · {tour.title}</span>
          <span className="tour-count">{idx + 1} / {steps.length}</span>
          <button className="btn btn-icon btn-ghost btn-xs" onClick={endTour} title="关闭引导">
            <X size={12} />
          </button>
        </div>

        <div className="tour-title">{step.title}</div>
        <p className="tour-body">{step.body}</p>

        {step.visual === 'voice-modes' && (
          <div className="tour-voice-modes">
            <div className="tvm-row safe">
              <span className="tvm-icon"><Shield size={12} /></span>
              <span className="tvm-copy">
                <b>安全模式</b>
                <small>识别完先填入输入框，确认后再发送</small>
              </span>
              <span className="tvm-tag">先确认</span>
            </div>
            <div className="tvm-row direct">
              <span className="tvm-icon"><Zap size={12} /></span>
              <span className="tvm-copy">
                <b>直出模式</b>
                <small>识别完直接发送，适合短指令、连续补录</small>
              </span>
              <span className="tvm-tag">直接发</span>
            </div>
          </div>
        )}

        <div className="tour-actions">
          <button className="btn btn-ghost btn-xs tour-skip" onClick={endTour}>跳过</button>
          <button
            className="btn btn-ghost btn-xs"
            disabled={idx === 0}
            onClick={() => setIdx(i => Math.max(0, i - 1))}
          >
            <ArrowLeft size={11} /> 上一步
          </button>
          {idx < steps.length - 1 ? (
            <button
              className="btn btn-primary btn-xs"
              onClick={() => setIdx(i => Math.min(steps.length - 1, i + 1))}
            >
              下一步 <ArrowRight size={11} />
            </button>
          ) : (
            <button className="btn btn-primary btn-xs" onClick={endTour}>
              完成
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
