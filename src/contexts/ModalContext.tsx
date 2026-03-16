import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  resolve: ((value: boolean) => void) | null;
}

interface ModalContextValue {
  confirm: (title: string, message: string) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
  });
  const { mediumTap } = useHapticFeedback();

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setModalState({ isOpen: true, title, message, resolve });
    });
  }, []);

  const handleConfirm = () => {
    mediumTap();
    modalState.resolve?.(true);
    setModalState(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    modalState.resolve?.(false);
    setModalState(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  return (
    <ModalContext.Provider value={{ confirm }}>
      {children}
      {modalState.isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={handleCancel}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 max-w-xs w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-[Georgia,'Times_New_Roman',serif] text-[16px] font-bold text-[var(--text)] mb-2">
              {modalState.title}
            </h3>
            <p className="font-mono text-[12px] text-[var(--text-dim)] mb-5">
              {modalState.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                className="font-mono text-[13px] font-semibold text-[var(--text-dim)] bg-transparent border border-[var(--border)] rounded-[4px] px-4 py-2 cursor-pointer touch-manipulation transition-colors hover:border-[var(--text-dim)] active:scale-95"
                onClick={handleCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="font-mono text-[13px] font-semibold text-[var(--bg)] bg-[var(--accent-red)] border-none rounded-[4px] px-4 py-2 cursor-pointer touch-manipulation transition-opacity hover:opacity-90 active:scale-95"
                onClick={handleConfirm}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
