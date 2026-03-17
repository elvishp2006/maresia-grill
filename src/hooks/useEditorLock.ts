import { useEffect, useMemo, useState } from 'react';
import type { EditorLock } from '../types';
import {
  acquireEditorLock,
  isLockExpired,
  releaseEditorLock,
  renewEditorLock,
  subscribeEditorLock,
} from '../lib/storage';

const HEARTBEAT_INTERVAL_MS = 15_000;
const SESSION_STORAGE_KEY = 'menu-editor-session-id';
const DEVICE_STORAGE_KEY = 'menu-editor-device-label';

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

export interface EditorLockState {
  canEdit: boolean;
  loading: boolean;
  lock: EditorLock | null;
  isExpired: boolean;
  isOwner: boolean;
  requestEditAccess: () => Promise<boolean>;
  releaseEditAccess: () => Promise<void>;
}

export function useEditorLock(userEmail?: string | null, isOnline = true): EditorLockState {
  const [lock, setLock] = useState<EditorLock | null>(null);

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
    });

    return unsubscribe;
  }, [userEmail]);

  const requestEditAccess = async () => {
    if (!userEmail || !isOnline) return false;
    const acquired = await acquireEditorLock({ sessionId, userEmail, deviceLabel });
    return acquired?.sessionId === sessionId;
  };

  const releaseEditAccess = async () => {
    await releaseEditorLock(sessionId);
  };

  useEffect(() => {
    if (!userEmail || !isOnline) return;
    if (lock) return;
    void acquireEditorLock({ sessionId, userEmail, deviceLabel });
  }, [deviceLabel, isOnline, lock, sessionId, userEmail]);

  const effectiveLock = userEmail ? lock : null;
  const isOwner = effectiveLock?.sessionId === sessionId && !isLockExpired(effectiveLock);
  const isExpired = isLockExpired(effectiveLock);
  const canEdit = isOnline && isOwner;

  useEffect(() => {
    if (!canEdit) return;

    const id = window.setInterval(async () => {
      const nextLock = await renewEditorLock(sessionId);
      if (!nextLock) setLock(current => current?.sessionId === sessionId ? null : current);
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [canEdit, sessionId]);

  useEffect(() => {
    if (!userEmail) return;

    const handleBeforeUnload = () => {
      void releaseEditorLock(sessionId);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId, userEmail]);

  useEffect(() => () => {
    void releaseEditorLock(sessionId);
  }, [sessionId]);

  return {
    canEdit,
    loading: false,
    lock: effectiveLock,
    isExpired,
    isOwner,
    requestEditAccess,
    releaseEditAccess,
  };
}
