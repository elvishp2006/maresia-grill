import { useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from '../pwa';
import { useToast } from '../contexts/ToastContext';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

interface UseUpdateNotificationOptions {
  autoApply?: boolean;
  reloadOnControllerChange?: boolean;
  showUpdatedToast?: boolean;
}

export function useUpdateNotification({
  autoApply = false,
  reloadOnControllerChange = false,
  showUpdatedToast = true,
}: UseUpdateNotificationOptions = {}) {
  const { showToast } = useToast();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const autoApplyTriggeredRef = useRef(false);
  const reloadedRef = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
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
  }, [setNeedRefresh]);

  const applyUpdate = useCallback(async () => {
    setNeedRefresh(false);
    await updateServiceWorker(true);
  }, [setNeedRefresh, updateServiceWorker]);

  useEffect(() => {
    if (typeof navigator.serviceWorker === 'undefined') return;

    const handleControllerChange = () => {
      if (reloadOnControllerChange) {
        if (reloadedRef.current) return;
        reloadedRef.current = true;
        window.location.reload();
        return;
      }

      if (showUpdatedToast) {
        showToast('✓ App atualizado', 'success', 3000);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
  }, [reloadOnControllerChange, showToast, showUpdatedToast]);

  useEffect(() => {
    if (!autoApply || !needRefresh) {
      autoApplyTriggeredRef.current = false;
      return;
    }

    if (autoApplyTriggeredRef.current) return;

    autoApplyTriggeredRef.current = true;
    void applyUpdate();
  }, [applyUpdate, autoApply, needRefresh]);

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
    applyUpdate,
    dismiss,
  };
}
