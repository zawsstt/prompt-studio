import { useState, useRef, useEffect } from 'react';
import { Mic, Send, X, Check, Keyboard, Zap, Shield } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { BorderBeam } from 'border-beam';
import { toast } from '../shared/Toast';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useVoiceHotkey, type VoiceInputMode } from '../../hooks/useVoiceHotkey';

interface VoiceInputProps {
  disabled?: boolean;
  onTranscriptChange: (text: string) => void;
  onSendDirectly?: (text: string) => void;
  currentInput: string;
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export default function VoiceInput({
  disabled = false,
  onTranscriptChange,
  onSendDirectly,
  currentInput,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalAccumulated, setFinalAccumulated] = useState('');
  const [showHotkeyHint, setShowHotkeyHint] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);
  const liveTranscriptRef = useRef('');

  // 全屏管理
  const { requestFullscreen, exitFullscreen } = useFullscreen();

  const startListening = () => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      toast('当前浏览器暂不支持语音识别 API，建议使用 Chrome/Edge 浏览器', 'error');
      return;
    }
    if (disabled) return;

    try {
      const rec = new SpeechRecognitionClass();
      rec.lang = 'zh-CN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      isManuallyStopped.current = false;
      setInterimText('');
      setFinalAccumulated('');
      liveTranscriptRef.current = '';
      setIsListening(true);

      // 添加整个网页边框泛光效果
      document.body.classList.add('voice-active');

      // 尝试进入全屏模式以获得更好的泛光效果
      if (hotkeyConfig.enableFullscreen) {
        requestFullscreen().catch(() => {
          // 全屏请求失败时静默处理，不影响语音功能
        });
      }

      rec.onstart = () => {
        setIsListening(true);
        document.body.classList.add('voice-active');
      };

      rec.onresult = (event: any) => {
        let interim = '';
        let finalized = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            finalized += text;
          } else {
            interim += text;
          }
        }

        if (finalized) {
          setFinalAccumulated(prev => {
            const next = prev ? `${prev} ${finalized}` : finalized;
            liveTranscriptRef.current = next;
            return next;
          });
        }
        setInterimText(interim);
        if (interim) {
          liveTranscriptRef.current = (liveTranscriptRef.current + ' ' + interim).trim();
        }
      };

      rec.onerror = (event: any) => {
        const error = event?.error;
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          toast('麦克风权限被拒绝，请在地址栏允许麦克风权限', 'error');
          stopListening();
        } else if (error === 'audio-capture') {
          toast('未检测到可用的麦克风设备', 'error');
          stopListening();
        } else if (error === 'network') {
          // 在未说话静音或部分网络重试时避免直接崩溃断开
          console.warn('Speech recognition network event:', event);
        }
      };

      rec.onend = () => {
        // 允许持续或平滑自然结束
        if (isManuallyStopped.current) {
          setIsListening(false);
          document.body.classList.remove('voice-active');

          // 根据模式自动处理识别结果
          handleAutoProcess();
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      toast('启动语音识别失败', 'error');
      setIsListening(false);
      document.body.classList.remove('voice-active');
    }
  };

  // 自动处理识别结果（根据模式）
  const handleAutoProcess = () => {
    const rawResult = document.querySelector('.voice-transcript-text')?.textContent || '';
    const speechResult = (rawResult || liveTranscriptRef.current || (finalAccumulated + (interimText ? ` ${interimText}` : ''))).trim();

    if (!speechResult) return;

    if (hotkeyConfig.inputMode === 'direct') {
      // 直出模式：自动发送
      if (onSendDirectly) {
        onSendDirectly(speechResult);
        toast('语音识别完成，已自动发送', 'success');
      }
    } else {
      // 安全模式：填入输入框
      if (onTranscriptChange) {
        onTranscriptChange(speechResult);
        toast('语音识别完成，已填入输入框', 'info');
      }
    }

    // 清空状态
    setInterimText('');
    setFinalAccumulated('');
    liveTranscriptRef.current = '';
  };

  const stopListening = () => {
    isManuallyStopped.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    document.body.classList.remove('voice-active');

    // 退出全屏
    if (hotkeyConfig.enableFullscreen) {
      exitFullscreen().catch(() => {});
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // 集成语音快捷键
  const { config: hotkeyConfig, updateConfig: updateHotkeyConfig } = useVoiceHotkey(
    startListening,
    stopListening,
    disabled
  );

  // 确认并填入输入框
  const handleApplyToInput = () => {
    const rawResult = document.querySelector('.voice-transcript-text')?.textContent || '';
    const speechResult = (rawResult || liveTranscriptRef.current || (finalAccumulated + (interimText ? ` ${interimText}` : ''))).trim();
    if (speechResult) {
      const combined = currentInput ? `${currentInput} ${speechResult}` : speechResult;
      onTranscriptChange(combined);
      toast('语音已填入输入框', 'success');
    }
    stopListening();
    setInterimText('');
    setFinalAccumulated('');
    liveTranscriptRef.current = '';
  };

  // 确认并直接发送
  const handleSendNow = () => {
    const rawResult = document.querySelector('.voice-transcript-text')?.textContent || '';
    const speechResult = (rawResult || liveTranscriptRef.current || (finalAccumulated + (interimText ? ` ${interimText}` : ''))).trim();
    if (speechResult) {
      const toSend = currentInput ? `${currentInput} ${speechResult}` : speechResult;
      if (onSendDirectly) {
        onSendDirectly(toSend);
      } else {
        onTranscriptChange(toSend);
      }
    }
    stopListening();
    setInterimText('');
    setFinalAccumulated('');
    liveTranscriptRef.current = '';
  };

  const handleCancel = () => {
    stopListening();
    setInterimText('');
    setFinalAccumulated('');
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const fullLiveText = (finalAccumulated + (interimText ? ` ${interimText}` : '')).trim();
  const isSupported = !!getSpeechRecognition();

  return (
    <div className="voice-input-wrapper">
      <button
        type="button"
        className={`voice-mic-btn ${isListening ? 'active' : ''} ${!isSupported ? 'unsupported' : ''}`}
        onClick={toggleListening}
        onMouseEnter={() => setShowHotkeyHint(true)}
        onMouseLeave={() => setShowHotkeyHint(false)}
        disabled={disabled || !isSupported}
        title={
          !isSupported
            ? '当前浏览器不支持语音输入 API'
            : isListening
              ? '正在聆听...点击停止'
              : `语音输入 (快捷键: ${hotkeyConfig.key === 'KeyT' ? 'T' : hotkeyConfig.key})`
        }
      >
        {isListening ? (
          <>
            <span className="mic-ripple-ring" />
            <Mic className="mic-icon animate-pulse" size={14} />
          </>
        ) : (
          <Mic size={14} className="mic-icon" />
        )}
      </button>

      {/* 优化后的语音浮窗：固定贴合在对话输入区上方，并加上 BorderBeam 高光环绕与 ThinkingOrb 波动 */}
      {isListening && (
        <div className="voice-floating-bar">
          <BorderBeam size="md" colorVariant="ocean" strength={0.85} theme="dark">
            <div className="voice-dock-pill">
              <div className="voice-pill-header">
                <div className="voice-orb-indicator">
                  <ThinkingOrb state="listening" size={20} theme="dark" />
                </div>
                <span className="voice-state-tag">
                  <span className="voice-dot-live" /> 语音识别中...
                </span>
                <div className="eisland-bars-row">
                  <i /><i /><i /><i /><i /><i /><i />
                </div>
                {/* 模式指示器 */}
                <div
                  className={`voice-mode-indicator ${hotkeyConfig.inputMode}`}
                  title={hotkeyConfig.inputMode === 'direct' ? '直出模式：自动发送' : '安全模式：填入输入框'}
                >
                  {hotkeyConfig.inputMode === 'direct' ? (
                    <><Zap size={11} /> 直出</>
                  ) : (
                    <><Shield size={11} /> 安全</>
                  )}
                </div>
                <button type="button" className="voice-btn-close" onClick={handleCancel} title="关闭语音">
                  <X size={12} />
                </button>
              </div>

              {/* 模式切换提示条 */}
              <div className="voice-mode-switch-bar">
                <span className="voice-mode-label">
                  {hotkeyConfig.inputMode === 'direct'
                    ? '🚀 直出模式：识别完成后自动发送'
                    : '🛡️ 安全模式：识别完成后填入输入框'}
                </span>
                <button
                  type="button"
                  className="voice-mode-toggle-btn"
                  onClick={() => updateHotkeyConfig({
                    inputMode: hotkeyConfig.inputMode === 'direct' ? 'safe' : 'direct'
                  })}
                  title="切换输入模式"
                >
                  切换模式
                </button>
              </div>

              {/* 实时转写结果展示 */}
              <div className="voice-transcript-box">
                {fullLiveText ? (
                  <p className="voice-transcript-text">
                    {finalAccumulated}
                    {interimText && <span className="voice-interim">{interimText}</span>}
                  </p>
                ) : (
                  <p className="voice-placeholder">正在聆听中，请说话…</p>
                )}
              </div>

              {/* 底部操作条 */}
              <div className="voice-actions-bar">
                <button
                  type="button"
                  className="voice-action-btn ghost"
                  onClick={handleCancel}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="voice-action-btn secondary"
                  onClick={handleApplyToInput}
                  disabled={!fullLiveText}
                >
                  <Check size={12} /> 填入框
                </button>
                <button
                  type="button"
                  className="voice-action-btn primary"
                  onClick={handleSendNow}
                  disabled={!fullLiveText}
                >
                  <Send size={12} /> 发送
                </button>
              </div>

              {/* 快捷键提示 */}
              <div className="voice-hotkey-hint">
                <Keyboard size={11} />
                <span>
                  {hotkeyConfig.holdToTalk ? '按住' : '按下'} <kbd>{hotkeyConfig.key === 'KeyT' ? 'T' : hotkeyConfig.key.replace('Key', '')}</kbd> 键快速启动
                </span>
              </div>
            </div>
          </BorderBeam>
        </div>
      )}
    </div>
  );
}
