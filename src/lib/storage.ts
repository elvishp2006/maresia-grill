import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { EditorLock, Item } from '../types';

export const LOCK_TIMEOUT_MS = 60_000;

const getDateKey = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const getDb = () => {
  if (!db) {
    throw new Error('Firestore indisponivel. Verifique a configuracao do Firebase.');
  }
  return db;
};

const categoriesRef = () => doc(getDb(), 'config', 'categories');
const complementsRef = () => doc(getDb(), 'config', 'complements');
const selectionRef = (date = new Date()) => doc(getDb(), 'selections', getDateKey(date));
const editorLockRef = () => doc(getDb(), 'config', 'editorLock');

export interface SelectionHistoryEntry {
  dateKey: string;
  ids: string[];
}

export interface AcquireEditorLockInput {
  sessionId: string;
  userEmail: string;
  deviceLabel: string;
}

export interface AcquireEditorLockOptions {
  force?: boolean;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isValidItem = (value: unknown): value is Item => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.nome === 'string'
    && typeof candidate.categoria === 'string';
};

const isValidEditorLock = (value: unknown): value is EditorLock => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return candidate.status === 'active'
    && typeof candidate.sessionId === 'string'
    && typeof candidate.userEmail === 'string'
    && typeof candidate.deviceLabel === 'string'
    && typeof candidate.acquiredAt === 'number'
    && typeof candidate.lastHeartbeatAt === 'number'
    && typeof candidate.expiresAt === 'number';
};

const normalizeStringArray = (value: unknown): string[] =>
  isStringArray(value) ? value : [];

const normalizeItems = (value: unknown): Item[] =>
  Array.isArray(value) ? value.filter(isValidItem) : [];

const normalizeEditorLock = (value: unknown): EditorLock | null =>
  isValidEditorLock(value) ? value : null;

const buildEditorLock = ({ sessionId, userEmail, deviceLabel }: AcquireEditorLockInput, now: number): EditorLock => ({
  sessionId,
  userEmail,
  deviceLabel,
  status: 'active',
  acquiredAt: now,
  lastHeartbeatAt: now,
  expiresAt: now + LOCK_TIMEOUT_MS,
});

export const isLockExpired = (lock: EditorLock | null, now = Date.now()) =>
  !lock || lock.expiresAt <= now;

export const loadCategories = async (): Promise<string[]> => {
  const snap = await getDoc(categoriesRef());
  return snap.exists() ? normalizeStringArray(snap.data().items) : [];
};

export const saveCategories = (items: string[]): Promise<void> => {
  return setDoc(categoriesRef(), { items });
};

export const subscribeCategories = (
  onValue: (items: string[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(categoriesRef(), (snap) => {
  onValue(snap.exists() ? normalizeStringArray(snap.data().items) : []);
}, error => onError?.(error));

export const loadComplements = async (): Promise<Item[]> => {
  const snap = await getDoc(complementsRef());
  return snap.exists() ? normalizeItems(snap.data().items) : [];
};

export const saveComplements = (items: Item[]): Promise<void> => {
  return setDoc(complementsRef(), { items });
};

export const subscribeComplements = (
  onValue: (items: Item[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(complementsRef(), (snap) => {
  onValue(snap.exists() ? normalizeItems(snap.data().items) : []);
}, error => onError?.(error));

export const loadDaySelection = async (): Promise<string[]> => {
  const snap = await getDoc(selectionRef());
  return snap.exists() ? normalizeStringArray(snap.data().ids) : [];
};

export const saveDaySelection = (ids: string[]): Promise<void> => {
  return setDoc(selectionRef(), { ids });
};

export const subscribeDaySelection = (
  onValue: (ids: string[]) => void,
  onError?: (error: Error) => void,
  date = new Date(),
) => onSnapshot(selectionRef(date), (snap) => {
  onValue(snap.exists() ? normalizeStringArray(snap.data().ids) : []);
}, error => onError?.(error));

export const loadRecentSelections = async (days: number): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  const snaps = await loadSelectionHistory(days);
  for (const snap of snaps) {
    for (const id of snap.ids)
      counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

export const loadSelectionHistory = async (days: number): Promise<SelectionHistoryEntry[]> => {
  const today = new Date();
  const refs = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateKey = getDateKey(d);
    return { dateKey, ref: doc(getDb(), 'selections', dateKey) };
  });

  const snaps = await Promise.all(refs.map(({ ref }) => getDoc(ref)));

  return snaps.flatMap((snap, index) => {
    if (!snap.exists()) return [];
    return [{
      dateKey: refs[index].dateKey,
      ids: normalizeStringArray(snap.data().ids),
    }];
  });
};

export const loadEditorLock = async (): Promise<EditorLock | null> => {
  const snap = await getDoc(editorLockRef());
  return snap.exists() ? normalizeEditorLock(snap.data()) : null;
};

export const subscribeEditorLock = (
  onValue: (lock: EditorLock | null) => void,
  onError?: (error: Error) => void,
) => onSnapshot(editorLockRef(), (snap) => {
  onValue(snap.exists() ? normalizeEditorLock(snap.data()) : null);
}, error => onError?.(error));

export const acquireEditorLock = async (
  input: AcquireEditorLockInput,
  options: AcquireEditorLockOptions = {},
): Promise<EditorLock | null> => {
  return runTransaction(getDb(), async (transaction) => {
    const ref = editorLockRef();
    const snap = await transaction.get(ref);
    const current = snap.exists() ? normalizeEditorLock(snap.data()) : null;
    const now = Date.now();

    if (!options.force && current && !isLockExpired(current, now) && current.sessionId !== input.sessionId) {
      return null;
    }

    const nextLock = current?.sessionId === input.sessionId
      ? {
          ...current,
          userEmail: input.userEmail,
          deviceLabel: input.deviceLabel,
          status: 'active' as const,
          lastHeartbeatAt: now,
          expiresAt: now + LOCK_TIMEOUT_MS,
        }
      : buildEditorLock(input, now);

    transaction.set(ref, nextLock);
    return nextLock;
  });
};

export const renewEditorLock = async (sessionId: string): Promise<EditorLock | null> => {
  return runTransaction(getDb(), async (transaction) => {
    const ref = editorLockRef();
    const snap = await transaction.get(ref);
    if (!snap.exists()) return null;

    const current = normalizeEditorLock(snap.data());
    const now = Date.now();
    if (!current || current.sessionId !== sessionId || isLockExpired(current, now)) {
      return null;
    }

    const nextLock: EditorLock = {
      ...current,
      lastHeartbeatAt: now,
      expiresAt: now + LOCK_TIMEOUT_MS,
    };
    transaction.set(ref, nextLock);
    return nextLock;
  });
};

export const releaseEditorLock = async (sessionId: string): Promise<void> => {
  await runTransaction(getDb(), async (transaction) => {
    const ref = editorLockRef();
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;

    const current = normalizeEditorLock(snap.data());
    if (!current || current.sessionId !== sessionId) return;

    transaction.delete(ref);
  });
};
