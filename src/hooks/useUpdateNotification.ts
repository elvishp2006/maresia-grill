import { useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from '../pwa';
import { useToast } from '../contexts/ToastContext';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function useUpdateNotification() {
  const { showToast } = useToast();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hasAnnouncedOfflineReady = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      registrationRef.current = registration ?? null;
      if (registration) {
        void registration.update();
      }
    },
    onRegisterError(error: unknown) {
      console.warn('Falha ao registrar o service worker do PWA:', error);
    },
  });

  const checkForUpdates = useCallback(() => {
    const registration = registrationRef.current;
    if (!registration) return;
    void registration.update();
  }, []);

  const dismiss = useCallback(() => {
    setNeedRefresh(false);
    setOfflineReady(false);
  }, [setNeedRefresh, setOfflineReady]);

  const applyUpdate = useCallback(async () => {
    setNeedRefresh(false);
    await updateServiceWorker(true);
  }, [setNeedRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!offlineReady || hasAnnouncedOfflineReady.current) return;

    hasAnnouncedOfflineReady.current = true;
    showToast('✓ App pronto para uso offline', 'success', 3000);
  }, [offlineReady, showToast]);

  useEffect(() => {
    if (!offlineReady) {
      hasAnnouncedOfflineReady.current = false;
    }
  }, [offlineReady]);

  useEffect(() => {
    if (typeof navigator.serviceWorker === 'undefined') return;

    const handleControllerChange = () => {
      showToast('✓ App atualizado', 'success', 3000);
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, [showToast]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    window.addEventListener('focus', checkForUpdates);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', checkForUpdates);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [checkForUpdates]);

  return {
    needRefresh,
    offlineReady,
    applyUpdate,
    dismiss,
  };
}
