import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { toast } from './Toast';

/**
 * Shared Markdown renderer (P1-10: extracted from ChatPanel so the version
 * summary card and other panels can reuse the same rendering, including
 * GFM support and code blocks with a copy button).
 */
export interface MarkdownViewProps {
  content: string;
  /** Optional copy handler; defaults to writing to the clipboard. */
  onCopy?: (text: string) => void;
}

export default function MarkdownView({ content, onCopy }: MarkdownViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    if (onCopy) {
      onCopy(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopiedId(id);
    toast('已复制到剪贴板', 'success');
    setTimeout(() => {
      setCopiedId(prev => (prev === id ? null : prev));
    }, 2000);
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const text = String(children);
          const lang = className?.replace('language-', '') || '';
          if (!lang) {
            return <code {...props}>{children}</code>;
          }
          const blockId = String(text.slice(0, 32));
          const isCopied = copiedId === blockId;

          return (
            <div className="codeblock-container">
              <div className="codeblock-header">
                <span className="codeblock-lang">{lang}</span>
                <button
                  className={`codeblock-copy-btn ${isCopied ? 'copied' : ''}`}
                  onClick={() => handleCopy(text, blockId)}
                  title="复制代码内容"
                >
                  {isCopied ? (
                    <><Check size={11} className="copy-icon" /> 已复制</>
                  ) : (
                    <><Copy size={11} className="copy-icon" /> 复制代码</>
                  )}
                </button>
              </div>
              <pre style={{ borderTop: 'none', borderRadius: '0 0 8px 8px', margin: 0 }}>
                <code className={className}>{children}</code>
              </pre>
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
