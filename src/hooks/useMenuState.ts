import { useState } from 'react';
import type { Item, Categoria } from '../types';
import {
  loadComplements,
  saveComplements,
  loadDaySelection,
  saveDaySelection,
} from '../storage';

let nextId = Date.now();
const genId = () => String(nextId++);

export const useMenuState = () => {
  const [complements, setComplements] = useState<Item[]>(() => loadComplements());
  const [daySelection, setDaySelection] = useState<string[]>(() => loadDaySelection());

  const toggleItem = (id: string) => {
    setDaySelection(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveDaySelection(next);
      return next;
    });
  };

  const addItem = (nome: string, categoria: Categoria) => {
    const item: Item = { id: genId(), nome: nome.trim(), categoria };
    setComplements(prev => {
      const next = [...prev, item];
      saveComplements(next);
      return next;
    });
  };

  const removeItem = (id: string) => {
    setComplements(prev => {
      const next = prev.filter(x => x.id !== id);
      saveComplements(next);
      return next;
    });
    setDaySelection(prev => {
      const next = prev.filter(x => x !== id);
      saveDaySelection(next);
      return next;
    });
  };

  return { complements, daySelection, toggleItem, addItem, removeItem };
};
