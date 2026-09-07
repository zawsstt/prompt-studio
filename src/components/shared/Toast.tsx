import { useState, useEffect } from 'react';

export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const event = new CustomEvent('toast', { detail: { message, type } });
  window.dispatchEvent(event);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message: detail.message, type: detail.type || 'info' }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}
