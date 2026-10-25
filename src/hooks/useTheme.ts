import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { systemPrefersDark } from '../lib/theme';

/** 系统是否处于深色（themeMode=system 时用来响应系统切换） */
export function useSystemDark(): boolean {
  const [dark, setDark] = useState(systemPrefersDark);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(mq.matches);
    setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/** 当前实际生效的明暗（供 CodeMirror 语法高亮、主题按钮图标使用） */
export function useEffectiveDark(): boolean {
  const mode = useStore(s => s.themeMode);
  const systemDark = useSystemDark();
  return mode === 'dark' || (mode === 'system' && systemDark);
}
