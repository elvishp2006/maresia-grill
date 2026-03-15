import type { Item } from './types';

const KEY_COMPLEMENTS = 'restaurante_complementos';

const getDateKey = () =>
  `restaurante_selecao_${new Date().toISOString().slice(0, 10)}`;

export const loadComplements = (): Item[] => {
  try {
    const raw = localStorage.getItem(KEY_COMPLEMENTS);
    return raw ? (JSON.parse(raw) as Item[]) : [];
  } catch {
    return [];
  }
};

export const saveComplements = (items: Item[]): void => {
  localStorage.setItem(KEY_COMPLEMENTS, JSON.stringify(items));
};

export const loadDaySelection = (): string[] => {
  try {
    const raw = localStorage.getItem(getDateKey());
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

export const saveDaySelection = (ids: string[]): void => {
  localStorage.setItem(getDateKey(), JSON.stringify(ids));
};
