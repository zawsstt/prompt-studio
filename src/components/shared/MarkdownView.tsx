import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy } from 'lucide-react';

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
  const handleCopy = (text: string) => {
    if (onCopy) {
      onCopy(text);
    } else {
      navigator.clipboard.writeText(text);
    }
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
          return (
            <div>
              <div className="codeblock-header">
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{lang}</span>
                <button className="codeblock-copy" onClick={() => handleCopy(text)}>
                  <Copy size={10} /> 复制
                </button>
              </div>
              <pre style={{ borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
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
