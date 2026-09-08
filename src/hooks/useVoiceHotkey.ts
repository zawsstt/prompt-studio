import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 语音输入模式
 */
export type VoiceInputMode = 'direct' | 'safe';

/**
 * 语音快捷键配置
 */
export interface VoiceHotkeyConfig {
  key: string;
  holdToTalk: boolean; // true: 按住说话，false: 切换模式
  enableFullscreen: boolean; // 是否在激活时进入全屏
  inputMode: VoiceInputMode; // 输入模式：direct=直出模式，safe=安全模式
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: VoiceHotkeyConfig = {
  key: 'KeyT',
  holdToTalk: true,
  enableFullscreen: true,
  inputMode: 'safe' // 默认安全模式
};

/**
 * 从 localStorage 加载配置
 */
function loadConfig(): VoiceHotkeyConfig {
  try {
    const saved = localStorage.getItem('voice-hotkey-config');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('无法加载语音快捷键配置:', e);
  }
  return DEFAULT_CONFIG;
}

/**
 * 保存配置到 localStorage
 */
function saveConfig(config: VoiceHotkeyConfig) {
  try {
    localStorage.setItem('voice-hotkey-config', JSON.stringify(config));
  } catch (e) {
    console.warn('无法保存语音快捷键配置:', e);
  }
}

/**
 * 语音快捷键 Hook
 * 支持按住说话（游戏对讲模式）和自定义快捷键
 */
export function useVoiceHotkey(
  onStart: () => void,
  onStop: () => void,
  disabled: boolean = false
) {
  const [config, setConfig] = useState<VoiceHotkeyConfig>(loadConfig);
  const isKeyPressed = useRef(false);
  const ignoreNextKeyUp = useRef(false);

  // 更新配置
  const updateConfig = useCallback((newConfig: Partial<VoiceHotkeyConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      saveConfig(updated);
      return updated;
    });
  }, []);

  // 处理按键事件
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // 检查是否是配置的快捷键
      if (e.code === config.key) {
        e.preventDefault();

        if (config.holdToTalk) {
          // 按住说话模式
          if (!isKeyPressed.current) {
            isKeyPressed.current = true;
            onStart();
          }
        } else {
          // 切换模式
          if (!isKeyPressed.current) {
            isKeyPressed.current = true;
            onStart();
            ignoreNextKeyUp.current = true;
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === config.key) {
        e.preventDefault();

        if (config.holdToTalk) {
          // 按住说话模式：松开停止
          if (isKeyPressed.current) {
            isKeyPressed.current = false;
            onStop();
          }
        } else {
          // 切换模式：再次按下停止
          if (ignoreNextKeyUp.current) {
            ignoreNextKeyUp.current = false;
          } else if (isKeyPressed.current) {
            isKeyPressed.current = false;
            onStop();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [config, disabled, onStart, onStop]);

  // 重置状态
  useEffect(() => {
    if (disabled) {
      isKeyPressed.current = false;
      ignoreNextKeyUp.current = false;
    }
  }, [disabled]);

  return {
    config,
    updateConfig,
    isEnabled: !disabled
  };
}

/**
 * 获取按键显示名称
 */
export function getKeyDisplayName(code: string): string {
  const keyMap: Record<string, string> = {
    'KeyT': 'T',
    'KeyV': 'V',
    'KeyB': 'B',
    'KeyG': 'G',
    'KeyH': 'H',
    'KeyY': 'Y',
    'KeyU': 'U',
    'Space': '空格',
    'Enter': '回车',
    'ShiftLeft': '左Shift',
    'ShiftRight': '右Shift',
    'ControlLeft': '左Ctrl',
    'ControlRight': '右Ctrl',
    'AltLeft': '左Alt',
    'AltRight': '右Alt',
  };
  return keyMap[code] || code;
}
