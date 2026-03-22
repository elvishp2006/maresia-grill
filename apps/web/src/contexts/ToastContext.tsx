import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from '../hooks/useToast';
import type { ToastType } from '../hooks/useToast';

export type { ToastType } from '../hooks/useToast';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number | null;
}

const colorMap: Record<ToastType, string> = {
  success: 'var(--green)',
  error: 'var(--accent-red)',
  info: 'var(--accent)',
};

let nextToastId = 0;
const DEFAULT_NON_ERROR_DURATION_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => (Array.isArray(prev) ? prev : []).filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType, duration?: number | null) => {
    const resolvedDuration = duration === undefined
      ? (type === 'error' ? null : DEFAULT_NON_ERROR_DURATION_MS)
      : duration;
    setToasts(prev => {
      const current = Array.isArray(prev) ? prev : [];
      const existing = current.find(toast => toast.message === message && toast.type === type);
      if (existing) {
        return current.map(toast => toast.id === existing.id ? { ...toast, duration: resolvedDuration } : toast);
      }

      const nextToast = { id: nextToastId++, message, type, duration: resolvedDuration };
      return [...current, nextToast];
    });
  }, []);

  useEffect(() => {
    const timers = toasts
      .filter((toast) => toast.duration !== null && toast.duration > 0)
      .map((toast) => window.setTimeout(() => dismissToast(toast.id), toast.duration ?? 0));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed left-1/2 z-50 flex w-[min(92vw,520px)] -translate-x-1/2 flex-col gap-2"
          style={{ top: 'max(16px, calc(env(safe-area-inset-top) + 8px))' }}
        >
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[13px] font-mono text-[var(--text)] shadow-lg transition-all duration-300"
              style={{ borderLeftWidth: '3px', borderLeftColor: colorMap[toast.type] }}
              role="status"
              aria-live="polite"
            >
              <div className="min-w-0 flex-1 break-words">{toast.message}</div>
              {toast.duration === null ? (
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--text-dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
                  aria-label={`Fechar aviso: ${toast.message}`}
                >
                  Fechar
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
