import { useState, useEffect, useRef } from 'react';

const DISMISS_KEY = 'pwa-install-dismissed';
const REDISPLAY_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isDismissedRecently(): boolean {
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  const elapsed = Date.now() - parseInt(ts, 10);
  return elapsed < REDISPLAY_DAYS * 24 * 60 * 60 * 1000;
}

export function usePWAInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (!isDismissedRecently()) {
        setCanInstall(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    deferredPrompt.current = null;
    setCanInstall(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setCanInstall(false);
  };

  return { canInstall, install, dismiss };
}
