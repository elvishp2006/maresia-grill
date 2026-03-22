import { createContext, useContext } from 'react';

export interface ModalContextValue {
  confirm: (title: string, message: string) => Promise<boolean>;
}

export const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}
