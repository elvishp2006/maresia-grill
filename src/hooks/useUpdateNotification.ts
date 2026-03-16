import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export function useUpdateNotification() {
  const { showToast } = useToast();

  useEffect(() => {
    if (typeof navigator.serviceWorker === 'undefined') return;

    const handler = () => {
      showToast('✓ App atualizado', 'success', 3000);
    };
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler);
  }, [showToast]);
}
