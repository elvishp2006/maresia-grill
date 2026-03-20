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
const INITIAL_MODAL_STATE: ModalState = {
  isOpen: false,
  title: '',
  message: '',
  resolve: null,
};

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);
  const { mediumTap } = useHapticFeedback();

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise(resolve => {
      setModalState({ isOpen: true, title, message, resolve });
    });
  }, []);

  const handleConfirm = () => {
    mediumTap();
    modalState?.resolve?.(true);
    setModalState(prev => ({ ...(prev ?? INITIAL_MODAL_STATE), isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    mediumTap();
    modalState?.resolve?.(false);
    setModalState(prev => ({ ...(prev ?? INITIAL_MODAL_STATE), isOpen: false, resolve: null }));
  };

  return (
    <ModalContext.Provider value={{ confirm }}>
      {children}
      {modalState?.isOpen === true && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-[16px] md:items-center"
          onClick={handleCancel}
        >
          <div
            className="w-full max-w-sm rounded-[24px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-[20px] shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto max-w-[280px] text-center">
              <h3 className="mb-[8px] font-[var(--font-display)] text-[24px] font-bold text-[var(--text)]">
                {modalState.title}
              </h3>
              <p className="mb-[18px] text-[14px] leading-[1.5] text-[var(--text-dim)]">
                {modalState.message}
              </p>
            </div>
            <div className="flex gap-[10px]">
              <button
                type="button"
                className="min-h-[48px] flex-1 rounded-[16px] border border-[var(--border)] bg-transparent px-[16px] py-[12px] text-[14px] font-semibold text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                onClick={handleCancel}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="min-h-[48px] flex-1 rounded-[16px] bg-[var(--accent-red)] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
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
