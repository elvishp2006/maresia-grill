import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

const colorMap: Record<ToastType, string> = {
  success: 'var(--green)',
  error: 'var(--accent-red)',
  info: 'var(--accent)',
};

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const safeToasts = Array.isArray(toasts) ? toasts : [];

  const showToast = useCallback((message: string, type: ToastType, duration = 3000) => {
    const id = nextToastId++;
    setToasts(prev => [...(Array.isArray(prev) ? prev : []), { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => (Array.isArray(prev) ? prev : []).filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {safeToasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
          {safeToasts.map(toast => (
            <div
              key={toast.id}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-3 text-[13px] font-mono text-[var(--text)] shadow-lg transition-all duration-300 whitespace-nowrap"
              style={{ borderLeftWidth: '3px', borderLeftColor: colorMap[toast.type] }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
