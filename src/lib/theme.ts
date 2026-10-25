// ── Theme preferences (P1-13) ──
//
// 只动「明暗 + 材质」，不动品牌靛蓝。三种模式：
// light / dark / system；划词工具条三种材质：frosted / liquid / solid。

export type ThemeMode = 'light' | 'dark' | 'system';
export type ToolbarStyle = 'frosted' | 'liquid' | 'solid';

export const THEME_KEY = 'promptstudio:themeMode';
export const TOOLBAR_KEY = 'promptstudio:toolbarStyle';

export const THEME_MODES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: 'light', label: '浅色', hint: '蓝白工作台' },
  { id: 'dark', label: '深色', hint: '深夜低亮度' },
  { id: 'system', label: '跟随系统', hint: '随系统切换' },
];

export const TOOLBAR_STYLES: { id: ToolbarStyle; label: string; hint: string }[] = [
  { id: 'frosted', label: '磨砂', hint: '默认玻璃质感' },
  { id: 'liquid', label: '液态玻璃', hint: '高光流动、折射更强' },
  { id: 'solid', label: '实心', hint: '高对比、无模糊' },
];

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark());
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = resolveDark(mode) ? 'dark' : 'light';
}

export function applyToolbarStyle(style: ToolbarStyle): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.toolbar = style;
}

function readKey<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key) as T | null;
    return raw && allowed.includes(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function loadThemeMode(): ThemeMode {
  return readKey(THEME_KEY, ['light', 'dark', 'system'] as const, 'light');
}

export function loadToolbarStyle(): ToolbarStyle {
  return readKey(TOOLBAR_KEY, ['frosted', 'liquid', 'solid'] as const, 'frosted');
}

export function persistThemeMode(mode: ThemeMode): void {
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
}

export function persistToolbarStyle(style: ToolbarStyle): void {
  try { localStorage.setItem(TOOLBAR_KEY, style); } catch { /* ignore */ }
}
