import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorLock } from '../types';
import {
  acquireEditorLock,
  isLockExpired,
  releaseEditorLock,
  renewEditorLock,
  subscribeEditorLock,
} from '../lib/storage';

const HEARTBEAT_INTERVAL_MS = 15_000;
const INACTIVITY_TIMEOUT_MS = 30_000;
const SESSION_STORAGE_KEY = 'menu-editor-session-id';
const DEVICE_STORAGE_KEY = 'menu-editor-device-label';
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'focus'];

const getStorage = (storage: 'localStorage' | 'sessionStorage') => {
  if (typeof window === 'undefined') return null;
  try {
    return window[storage];
  } catch {
    return null;
  }
};

const randomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const buildDeviceLabel = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('mac')) return 'Mac';
  if (ua.includes('windows')) return 'Windows';
  return 'Dispositivo';
};

const getOrCreateStoredValue = (key: string, storage: 'localStorage' | 'sessionStorage', factory: () => string) => {
  const target = getStorage(storage);
  if (!target) return factory();

  const current = target.getItem(key);
  if (current) return current;

  const next = factory();
  target.setItem(key, next);
  return next;
};

const isDocumentVisible = () =>
  typeof document === 'undefined' || document.visibilityState === 'visible';

export interface EditorLockState {
  canEdit: boolean;
  loading: boolean;
  lock: EditorLock | null;
  isExpired: boolean;
  isOwner: boolean;
  error: string | null;
  requestEditAccess: () => Promise<boolean>;
  releaseEditAccess: () => Promise<void>;
}

export function useEditorLock(userEmail?: string | null, isOnline = true): EditorLockState {
  const [lock, setLock] = useState<EditorLock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForeground, setIsForeground] = useState(isDocumentVisible());
  const [lastInteractionAt, setLastInteractionAt] = useState(() => Date.now());
  const [isLocallyActive, setIsLocallyActive] = useState(true);
  const reacquireAttemptedRef = useRef(false);

  const sessionId = useMemo(
    () => getOrCreateStoredValue(SESSION_STORAGE_KEY, 'sessionStorage', randomId),
    [],
  );
  const deviceLabel = useMemo(
    () => getOrCreateStoredValue(DEVICE_STORAGE_KEY, 'localStorage', buildDeviceLabel),
    [],
  );

  useEffect(() => {
    if (!userEmail) return undefined;

    const unsubscribe = subscribeEditorLock((nextLock) => {
      setLock(nextLock);
      setError(null);
    }, (nextError) => {
      setError(nextError.message);
    });

    return unsubscribe;
  }, [userEmail]);

  useEffect(() => {
    const markInteraction = () => {
      setLastInteractionAt(Date.now());
      setIsForeground(isDocumentVisible());
      setIsLocallyActive(true);
      reacquireAttemptedRef.current = false;
    };

    const handleVisibilityChange = () => {
      const visible = isDocumentVisible();
      setIsForeground(visible);
      if (visible) {
        setLastInteractionAt(Date.now());
        setIsLocallyActive(true);
        reacquireAttemptedRef.current = false;
      } else {
        setIsLocallyActive(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markInteraction);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markInteraction);
      }
    };
  }, []);

  const requestEditAccess = useCallback(async () => {
    if (!userEmail || !isOnline) return false;
    try {
      const acquired = await acquireEditorLock({ sessionId, userEmail, deviceLabel });
      setError(null);
      return acquired?.sessionId === sessionId;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel assumir a edicao.');
      return false;
    }
  }, [deviceLabel, isOnline, sessionId, userEmail]);

  const releaseEditAccess = useCallback(async () => {
    try {
      await releaseEditorLock(sessionId);
    } catch {
      // Ignore release errors during teardown/sign-out.
    }
  }, [sessionId]);

  const effectiveLock = userEmail ? lock : null;
  const isOwner = effectiveLock?.sessionId === sessionId && !isLockExpired(effectiveLock);
  const isExpired = isLockExpired(effectiveLock);
  const canEdit = isOnline && isOwner && isLocallyActive;

  useEffect(() => {
    if (!isForeground) return undefined;

    const timeoutId = window.setTimeout(() => {
      setIsLocallyActive(false);
    }, Math.max(0, INACTIVITY_TIMEOUT_MS - (Date.now() - lastInteractionAt)));

    return () => window.clearTimeout(timeoutId);
  }, [isForeground, lastInteractionAt]);

  useEffect(() => {
    if (!userEmail || !isOnline || !isLocallyActive) return;
    if (lock && !isExpired) return;
    if (reacquireAttemptedRef.current) return;

    reacquireAttemptedRef.current = true;
    const attemptId = window.setTimeout(() => {
      void requestEditAccess().then((granted) => {
        if (!granted) reacquireAttemptedRef.current = false;
      });
    }, 0);

    return () => window.clearTimeout(attemptId);
  }, [isExpired, isLocallyActive, isOnline, lock, requestEditAccess, userEmail]);

  useEffect(() => {
    if (!userEmail || !isOwner) return;
    if (isLocallyActive) return;
    void releaseEditAccess();
  }, [isLocallyActive, isOwner, releaseEditAccess, userEmail]);

  useEffect(() => {
    if (!canEdit) return;

    const id = window.setInterval(async () => {
      try {
        const nextLock = await renewEditorLock(sessionId);
        if (!nextLock) setLock(current => current?.sessionId === sessionId ? null : current);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel renovar a sessao de edicao.');
        setLock(current => current?.sessionId === sessionId ? null : current);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [canEdit, sessionId]);

  useEffect(() => {
    if (!userEmail) return;

    const handleBeforeUnload = () => {
      void releaseEditAccess();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [releaseEditAccess, userEmail]);

  useEffect(() => () => {
    void releaseEditAccess();
  }, [releaseEditAccess]);

  return {
    canEdit,
    loading: false,
    lock: effectiveLock,
    isExpired,
    isOwner,
    error,
    requestEditAccess,
    releaseEditAccess,
  };
}
