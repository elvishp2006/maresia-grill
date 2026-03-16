import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Item } from './types';

const getDateKey = () => new Date().toISOString().slice(0, 10);

export const loadComplements = async (): Promise<Item[]> => {
  const snap = await getDoc(doc(db, 'config', 'complements'));
  return snap.exists() ? (snap.data().items as Item[]) : [];
};

export const saveComplements = (items: Item[]): void => {
  void setDoc(doc(db, 'config', 'complements'), { items });
};

export const loadDaySelection = async (): Promise<string[]> => {
  const snap = await getDoc(doc(db, 'selections', getDateKey()));
  return snap.exists() ? (snap.data().ids as string[]) : [];
};

export const saveDaySelection = (ids: string[]): void => {
  void setDoc(doc(db, 'selections', getDateKey()), { ids });
};
