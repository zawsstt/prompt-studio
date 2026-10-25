import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import type { TourId } from '../lib/tours';

const SEEN_PREFIX = 'promptstudio:tour:';

/**
 * 模块首次进入自动播放一次。用 localStorage 记录已看过；
 * 目标模块必须真正可见（enabled）才计时，避免在后台启动后被浪费。
 */
export function useAutoTour(id: TourId, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    try {
      if (localStorage.getItem(`${SEEN_PREFIX}${id}`) === '1') return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      const state = useStore.getState();
      if (!state.activeTour) state.startTour(id);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [id, enabled]);
}
