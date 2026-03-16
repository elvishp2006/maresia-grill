import { useState, useEffect, useRef } from 'react';

const PROMPT_DISMISS_KEY = 'pwa-install-dismissed';
const IOS_DISMISS_KEY = 'pwa-ios-install-dismissed';
const REDISPLAY_DAYS = 7;

export type InstallMode = 'none' | 'prompt' | 'ios-manual';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isDismissedRecently(key: string): boolean {
  const ts = localStorage.getItem(key);
  if (!ts) return false;

  const elapsed = Date.now() - parseInt(ts, 10);
  return elapsed < REDISPLAY_DAYS * 24 * 60 * 60 * 1000;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isSafariBrowser(): boolean {
  const userAgent = navigator.userAgent;
  return /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

function isStandalone(): boolean {
  const mediaQueryMatches = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return mediaQueryMatches || navigatorWithStandalone.standalone === true;
}

function getInitialInstallMode(): InstallMode {
  if (isStandalone()) return 'none';

  if (isIosDevice() && isSafariBrowser() && !isDismissedRecently(IOS_DISMISS_KEY)) {
    return 'ios-manual';
  }

  return 'none';
}

export function usePWAInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [installMode, setInstallMode] = useState<InstallMode>(() => getInitialInstallMode());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;

      if (!isDismissedRecently(PROMPT_DISMISS_KEY)) {
        setInstallMode('prompt');
      }
    };

    const handleAppInstalled = () => {
      deferredPrompt.current = null;
      setInstallMode('none');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (installMode !== 'prompt' || !deferredPrompt.current) return;

    await deferredPrompt.current.prompt();
    const choice = await deferredPrompt.current.userChoice;

    if (choice.outcome === 'dismissed') {
      localStorage.setItem(PROMPT_DISMISS_KEY, String(Date.now()));
    }

    deferredPrompt.current = null;
    setInstallMode('none');
  };

  const dismiss = () => {
    const storageKey = installMode === 'ios-manual' ? IOS_DISMISS_KEY : PROMPT_DISMISS_KEY;
    localStorage.setItem(storageKey, String(Date.now()));
    setInstallMode('none');
  };

  return {
    installMode,
    canInstall: installMode !== 'none',
    install,
    dismiss,
  };
}
