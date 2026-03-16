import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './contexts/ToastContext';
import { ModalProvider } from './contexts/ModalContext';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <ModalProvider>
        <App />
      </ModalProvider>
    </ToastProvider>
  </StrictMode>,
);
