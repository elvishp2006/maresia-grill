import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Item } from './types';

const getDateKey = () => new Date().toISOString().slice(0, 10);

export const loadCategories = async (): Promise<string[]> => {
  const snap = await getDoc(doc(db, 'config', 'categories'));
  return snap.exists() ? (snap.data().items as string[]) : [];
};

export const saveCategories = (items: string[]): Promise<void> => {
  return setDoc(doc(db, 'config', 'categories'), { items });
};

export const loadComplements = async (): Promise<Item[]> => {
  const snap = await getDoc(doc(db, 'config', 'complements'));
  return snap.exists() ? (snap.data().items as Item[]) : [];
};

export const saveComplements = (items: Item[]): Promise<void> => {
  return setDoc(doc(db, 'config', 'complements'), { items });
};

export const loadDaySelection = async (): Promise<string[]> => {
  const snap = await getDoc(doc(db, 'selections', getDateKey()));
  return snap.exists() ? (snap.data().ids as string[]) : [];
};

export const saveDaySelection = (ids: string[]): Promise<void> => {
  return setDoc(doc(db, 'selections', getDateKey()), { ids });
};

export const loadRecentSelections = async (days: number): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  const today = new Date();
  const snaps = await Promise.all(
    Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return getDoc(doc(db, 'selections', d.toISOString().slice(0, 10)));
    })
  );
  for (const snap of snaps) {
    if (!snap.exists()) continue;
    for (const id of snap.data().ids as string[])
      counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};
