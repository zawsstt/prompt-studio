import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X, Check } from 'lucide-react';
import { toast } from '../shared/Toast';

interface VoiceInputProps {
  disabled?: boolean;
  onTranscriptChange: (text: string) => void;
  onSendDirectly?: (text: string) => void;
  currentInput: string;
}

// 兼容 WebkitSpeechRecognition
const SpeechRecognitionClass =
  typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition
    : null;

export default function VoiceInput({
  disabled = false,
  onTranscriptChange,
  onSendDirectly,
  currentInput,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [finalAccumulated, setFinalAccumulated] = useState('');
  const recognitionRef = useRef<any>(null);
  const isManuallyStopped = useRef(false);

  const isSupported = !!SpeechRecognitionClass;

  const startListening = () => {
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

      rec.onstart = () => {
        setIsListening(true);
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
            return next;
          });
        }
        setInterimText(interim);
      };

      rec.onerror = (event: any) => {
        const error = event.error;
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          toast('麦克风权限被拒绝，请在地址栏允许麦克风权限', 'error');
          stopListening();
        } else if (error === 'audio-capture') {
          toast('未检测到可用的麦克风设备', 'error');
          stopListening();
        } else if (error === 'network') {
          toast('语音识别网络异常，请重试', 'error');
        }
      };

      rec.onend = () => {
        if (!isManuallyStopped.current && isListening) {
          // 如果非手动停止且希望持续，可按需平滑退出或重启
          setIsListening(false);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      toast('启动语音识别失败', 'error');
      setIsListening(false);
    }
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
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // 确认并填入输入框
  const handleApplyToInput = () => {
    const speechResult = (finalAccumulated + (interimText ? ` ${interimText}` : '')).trim();
    if (speechResult) {
      const combined = currentInput ? `${currentInput} ${speechResult}` : speechResult;
      onTranscriptChange(combined);
      toast('语音已填入输入框', 'success');
    }
    stopListening();
    setInterimText('');
    setFinalAccumulated('');
  };

  // 确认并直接发送
  const handleSendNow = () => {
    const speechResult = (finalAccumulated + (interimText ? ` ${interimText}` : '')).trim();
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

  return (
    <div className="voice-input-wrapper">
      <button
        type="button"
        className={`voice-mic-btn ${isListening ? 'active' : ''} ${!isSupported ? 'unsupported' : ''}`}
        onClick={toggleListening}
        disabled={disabled || !isSupported}
        title={
          !isSupported
            ? '当前浏览器不支持语音输入 API'
            : isListening
              ? '正在聆听...点击停止'
              : '语音输入 (唤醒识别)'
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

      {/* 录音唤醒与识别特效悬浮面板 */}
      {isListening && (
        <div className="voice-modal-overlay">
          <div className="voice-dock-pill">
            <div className="voice-pill-header">
              <div className="voice-orb-indicator">
                <div className="voice-orb-glow" />
                <div className="voice-orb-core" />
              </div>
              <span className="voice-state-tag">
                <span className="voice-dot-live" /> 正在聆听中...
              </span>
              <button className="voice-btn-close" onClick={handleCancel} title="取消录音">
                <X size={12} />
              </button>
            </div>

            {/* DSH 风格 7 柱跳动音频律动波形 */}
            <div className="eisland-bars-row">
              <i /><i /><i /><i /><i /><i /><i />
            </div>

            {/* 实时转写结果展示 */}
            <div className="voice-transcript-box">
              {fullLiveText ? (
                <p className="voice-transcript-text">
                  {finalAccumulated}
                  {interimText && <span className="voice-interim">{interimText}</span>}
                </p>
              ) : (
                <p className="voice-placeholder">请说话，支持中文/普通话实时识别转文字…</p>
              )}
            </div>

            {/* 操作条 */}
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
                <Check size={12} /> 填入输入框
              </button>
              <button
                type="button"
                className="voice-action-btn primary"
                onClick={handleSendNow}
                disabled={!fullLiveText}
              >
                <Send size={12} /> 直接发送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
