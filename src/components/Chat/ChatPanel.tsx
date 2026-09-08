import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { PROVIDER_TEMPLATES, getTemplate } from '../../data/providers';
import { Send, Square, ChevronDown, Check, Brain, FileText, Zap, X, Quote, Eye, RotateCcw, User, Bot, Sparkles } from 'lucide-react';
import MarkdownView from '../shared/MarkdownView';
import VoiceInput from './VoiceInput';
import type { PendingReference } from '../../types';

export default function ChatPanel() {
  const messages = useStore(s => s.chatMessages);
  const isStreaming = useStore(s => s.isStreaming);
  const sendChatMessage = useStore(s => s.sendChatMessage);
  const stopStreaming = useStore(s => s.stopStreaming);
  const applyAsCandidate = useStore(s => s.applyAsCandidate);
  const contextMode = useStore(s => s.contextMode);
  const setContextMode = useStore(s => s.setContextMode);
  const showReasoning = useStore(s => s.showReasoning);
  const toggleReasoning = useStore(s => s.toggleReasoning);
  const selectedProviderId = useStore(s => s.selectedProviderId);
  const selectedModelName = useStore(s => s.selectedModelName);
  const chatReference = useStore(s => s.chatReference);
  const clearChatReference = useStore(s => s.clearChatReference);
  const pendingReferences = useStore(s => s.pendingReferences);
  const detectReferences = useStore(s => s.detectReferences);
  const confirmReference = useStore(s => s.confirmReference);
  const dismissReference = useStore(s => s.dismissReference);
  const chatInputDraft = useStore(s => s.pendingChatInput);
  const setChatInputDraft = useStore(s => s.setPendingChatInput);

  const [input, setInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState<Record<string, boolean>>({});
  const [previewRefId, setPreviewRefId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTemplate = getTemplate(selectedProviderId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Consume a draft prefilled by selection quick actions (ask / fix)
  useEffect(() => {
    if (chatInputDraft === null) return;
    setInput(chatInputDraft);
    setChatInputDraft(null);
    const el = textareaRef.current;
    if (el) {
      el.style.height = '40px';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
      el.focus();
    }
  }, [chatInputDraft, setChatInputDraft]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;

    // Reference blockquote prepend is handled inside sendChatMessage (P1-8).
    sendChatMessage(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '40px';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    const el = e.target;
    el.style.height = '40px';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';

    // P1-11: debounced workspace reference detection (300ms)
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => detectReferences(value), 300);
  };

  // Model dropdown is flat-mapped from PROVIDER_TEMPLATES (8 providers).
  const allModels = PROVIDER_TEMPLATES.flatMap(t =>
    t.defaultModels.map(m => ({ id: m, provider: t.providerId, name: m, providerName: t.name, iconBg: t.iconBg, iconText: t.iconText, iconUrl: t.iconUrl }))
  );

  const visibleRefs = pendingReferences.filter(r => r.status !== 'dismissed');
  const previewRef = previewRefId ? visibleRefs.find(r => r.id === previewRefId) : undefined;

  return (
    <aside className={`chat-panel ${useStore(s => s.activeView) === 'history' ? 'collapsed' : ''}`}>
      <div className="chat-header">
        <span className="chat-title">AI 对话</span>
        <div style={{ position: 'relative' }}>
          <div className="model-selector-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {currentTemplate && (
              <span className="model-icon" style={{ background: currentTemplate.iconUrl ? 'transparent' : currentTemplate.iconBg, color: '#fff' }}>
                {currentTemplate.iconUrl
                  ? <img src={currentTemplate.iconUrl} alt={currentTemplate.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : currentTemplate.iconText}
              </span>
            )}
            <span>{selectedModelName}</span>
            <ChevronDown size={10} className="chevron" />
          </div>
          {dropdownOpen && (
            <div className="model-dropdown open">
              {allModels.map(m => (
                <div
                  key={m.id}
                  className={`model-option ${m.id === selectedModelName ? 'active' : ''}`}
                  onClick={() => {
                    useStore.getState().setProvider(m.provider);
                    useStore.getState().setModelName(m.id);
                    setDropdownOpen(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="model-icon" style={{ background: m.iconUrl ? 'transparent' : m.iconBg, color: '#fff' }}>
                      {m.iconUrl ? <img src={m.iconUrl} alt={m.providerName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : m.iconText}
                    </span>
                    <div>
                      <div className="mo-name">{m.name}</div>
                      <div className="mo-desc">{m.providerName}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="btn btn-icon btn-ghost btn-sm"
          title="清空对话"
          onClick={() => {
            useStore.setState({ chatMessages: [] });
          }}
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <svg className="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>在下方输入修改需求，AI 将生成候选修改</p>
            <p>发送后点击「应用为候选修改」进入对比视图</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="msg-role">
                {msg.role === 'user' ? (
                  <><User size={10} /> 你</>
                ) : (
                  <><Bot size={10} /> {msg.modelId || 'AI'}</>
                )}
                {msg.tokens && <span className="num">~{msg.tokens} tokens</span>}
                {msg.costEst !== undefined && msg.costEst > 0 && (
                  <span className="num">¥{msg.costEst.toFixed(4)}</span>
                )}
              </div>
              <div className="msg-bubble">
                {msg.reasoning && showReasoning && (
                  <div className="reasoning-block">
                    <div className="reasoning-header" onClick={() =>
                      setReasoningExpanded(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))
                    }>
                      <Brain size={12} /> Reasoning
                      <ChevronDown size={10} style={{
                        transform: reasoningExpanded[msg.id] ? 'rotate(180deg)' : 'none',
                        transition: 'transform 120ms'
                      }} />
                    </div>
                    {reasoningExpanded[msg.id] && (
                      <div className="reasoning-content">{msg.reasoning}</div>
                    )}
                    {!reasoningExpanded[msg.id] && msg.reasoning.length > 100 && (
                      <div className="reasoning-content" style={{ maxHeight: '40px', overflow: 'hidden', opacity: 0.6 }}>
                        {msg.reasoning.slice(0, 100)}...
                      </div>
                    )}
                  </div>
                )}
                {msg.content ? (
                  <MarkdownView content={msg.content} />
                ) : isStreaming && msg.role === 'assistant' ? (
                  <span className="typing-cursor" />
                ) : null}
              </div>
              {msg.role === 'assistant' && msg.content && !msg.content.startsWith('❌') && (
                <div className="msg-actions">
                  <button
                    className={`btn btn-primary btn-sm ${msg.appliedAsCandidate ? 'btn-secondary' : ''}`}
                    onClick={() => applyAsCandidate(msg.id)}
                    disabled={msg.appliedAsCandidate}
                  >
                    {msg.appliedAsCandidate ? (
                      <><Check size={12} /> 已应用为候选</>
                    ) : (
                      <><Sparkles size={12} /> 应用为候选修改</>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="context-bar">
          <div className="ctx-toggle">
            <button
              className={contextMode === 'full' ? 'active' : ''}
              onClick={() => setContextMode('full')}
              title="全文模式：发送完整文档上下文"
            >
              <FileText size={10} /> 全文
            </button>
            <button
              className={contextMode === 'incremental' ? 'active' : ''}
              onClick={() => setContextMode('incremental')}
              title="增量模式：仅发送选中区块+规则摘要"
            >
              <Zap size={10} /> 增量
            </button>
          </div>
          <span>· 规则集摘要已注入</span>
          <span className="spacer" style={{ flex: 1 }} />
          <button
            className="btn btn-ghost btn-xs"
            onClick={toggleReasoning}
            style={{ fontSize: '10px' }}
            title="显示/隐藏 AI 推理过程"
          >
            {showReasoning ? (
              <><Brain size={10} /> Reasoning ON</>
            ) : (
              <><Brain size={10} /> Reasoning OFF</>
            )}
          </button>
        </div>

        {/* P1-11: workspace reference confirmation bar */}
        {visibleRefs.length > 0 && (
          <div className="ref-confirm-bar">
            {visibleRefs.map(ref => (
              <ReferenceChip
                key={ref.id}
                reference={ref}
                onConfirm={() => confirmReference(ref.id)}
                onDismiss={() => {
                  dismissReference(ref.id);
                  if (previewRefId === ref.id) setPreviewRefId(null);
                }}
                onPreview={() => setPreviewRefId(previewRefId === ref.id ? null : ref.id)}
              />
            ))}
            {previewRef && (
              <div className="ref-preview-popover">
                <div className="ref-preview-header">
                  <span title={previewRef.file.path}>{previewRef.file.path}</span>
                  <button
                    className="btn btn-icon btn-ghost btn-xs"
                    onClick={() => setPreviewRefId(null)}
                    title="关闭预览"
                  >
                    <X size={11} />
                  </button>
                </div>
                <pre className="ref-preview-body">
                  {previewRef.file.content.split('\n').slice(0, 40).join('\n')}
                  {previewRef.file.content.split('\n').length > 40 ? '\n…' : ''}
                </pre>
              </div>
            )}
          </div>
        )}

        {chatReference && (
          <div className="chat-reference-block">
            <div className="chat-ref-header">
              <Quote size={11} />
              <span className="chat-ref-source" title={chatReference.text.slice(0, 500)}>{chatReference.sourceLabel}</span>
              <button
                className="btn btn-icon btn-ghost btn-xs chat-ref-close"
                onClick={clearChatReference}
                title="移除引用"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="描述你想要的修改… (Enter 发送，Shift+Enter 换行)"
            rows={1}
            disabled={isStreaming}
          />
          <div className="input-actions">
            <VoiceInput
              disabled={isStreaming}
              currentInput={input}
              onTranscriptChange={(val) => {
                setInput(val);
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
                }
              }}
              onSendDirectly={(val) => {
                if (!val.trim() || isStreaming) return;
                const finalContent = chatReference
                  ? `> 引用内容：\n> ${chatReference.text.split('\n').join('\n> ')}\n\n${val}`
                  : val;
                sendChatMessage(finalContent);
                setInput('');
                clearChatReference();
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                }
              }}
            />
            {isStreaming ? (
              <button className="btn btn-danger btn-sm" onClick={stopStreaming}>
                <Square size={12} /> 停止
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={!input.trim()}>
                <Send size={12} /> 发送
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ── P1-11: single pending-reference chip ──
function ReferenceChip({ reference, onConfirm, onDismiss, onPreview }: {
  reference: PendingReference;
  onConfirm: () => void;
  onDismiss: () => void;
  onPreview: () => void;
}) {
  const confirmed = reference.status === 'confirmed';
  return (
    <span className={`ref-chip ${confirmed ? 'ref-chip-confirmed' : ''}`}>
      <button
        className="ref-chip-name"
        onClick={onPreview}
        title={`${reference.mention} → ${reference.file.path}（点击预览前 40 行）`}
      >
        <Eye size={10} /> {reference.file.name}
      </button>
      <span className={`ref-chip-confidence ${reference.confidence}`}>
        {reference.confidence === 'exact' ? '✓ 精确' : '? 疑似'}
      </span>
      <span className="ref-chip-tokens">~{reference.tokenEst} tokens</span>
      {confirmed ? (
        <span className="ref-chip-status"><Check size={10} /> 已确认</span>
      ) : (
        <button className="btn btn-primary btn-xs" onClick={onConfirm} title="确认后将其内容注入对话上下文">
          确认
        </button>
      )}
      <button className="btn btn-ghost btn-xs" onClick={onDismiss} title="移除该引用">
        <X size={10} />
      </button>
    </span>
  );
}
