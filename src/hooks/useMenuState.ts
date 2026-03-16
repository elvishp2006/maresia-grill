import { useState, useEffect } from 'react';
import type { Item, Categoria } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import {
  loadCategories,
  saveCategories,
  loadComplements,
  saveComplements,
  loadDaySelection,
  saveDaySelection,
  loadRecentSelections,
} from '../storage';
import { useToast } from '../contexts/ToastContext';

let nextId = Date.now();
const genId = () => String(nextId++);

export const useMenuState = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [complements, setComplements] = useState<Item[]>([]);
  const [daySelection, setDaySelection] = useState<string[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<'alpha' | 'usage'>('alpha');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      loadCategories(),
      loadComplements(),
      loadDaySelection(),
      loadRecentSelections(7),
    ]).then(([cats, items, ids, counts]) => {
      setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES);
      setComplements(items);
      setDaySelection(ids);
      setUsageCounts(counts);
      setLoading(false);
    }).catch(() => {
      showToast('Erro ao carregar dados. Verifique sua conexão.', 'error');
      setLoading(false);
    });
  }, [showToast]);

  const toggleSortMode = () => setSortMode(m => m === 'alpha' ? 'usage' : 'alpha');

  const toggleItem = (id: string) => {
    setDaySelection(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveDaySelection(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const addItem = (nome: string, categoria: Categoria) => {
    const item: Item = { id: genId(), nome: nome.trim(), categoria };
    setComplements(prev => {
      const next = [...prev, item];
      saveComplements(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
    setDaySelection(prev => {
      const next = [...prev, item.id];
      saveDaySelection(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const removeItem = (id: string) => {
    setComplements(prev => {
      const next = prev.filter(x => x.id !== id);
      saveComplements(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
    setDaySelection(prev => {
      const next = prev.filter(x => x !== id);
      saveDaySelection(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const renameItem = (id: string, newNome: string) => {
    setComplements(prev => {
      const next = prev.map(item =>
        item.id === id ? { ...item, nome: newNome.trim() } : item
      );
      saveComplements(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const addCategory = (nome: string) => {
    setCategories(prev => {
      const next = [...prev, nome.trim()];
      saveCategories(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const removeCategory = (nome: string) => {
    const removedIds = complements.filter(item => item.categoria === nome).map(item => item.id);
    setCategories(prev => {
      const next = prev.filter(c => c !== nome);
      saveCategories(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
    if (removedIds.length > 0) {
      setComplements(prev => {
        const next = prev.filter(item => item.categoria !== nome);
        saveComplements(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
        return next;
      });
      setDaySelection(prev => {
        const next = prev.filter(id => !removedIds.includes(id));
        saveDaySelection(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
        return next;
      });
    }
  };

  const moveCategory = (nome: string, direction: 'up' | 'down') => {
    setCategories(prev => {
      const idx = prev.indexOf(nome);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      saveCategories(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  return {
    categories,
    complements,
    daySelection,
    usageCounts,
    sortMode,
    loading,
    toggleSortMode,
    toggleItem,
    addItem,
    removeItem,
    renameItem,
    addCategory,
    removeCategory,
    moveCategory,
  };
};
