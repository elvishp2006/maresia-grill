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
const OFFLINE_ACTION_MESSAGE = 'Esta acao requer conexao com a internet.';

export const useMenuState = (isOnline = true) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [complements, setComplements] = useState<Item[]>([]);
  const [daySelection, setDaySelection] = useState<string[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<'alpha' | 'usage'>('alpha');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const guardOnlineAction = () => {
    if (isOnline) return true;
    showToast(OFFLINE_ACTION_MESSAGE, 'info');
    return false;
  };

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
    if (!guardOnlineAction()) return;
    setDaySelection(prev => {
      const wasSelected = prev.includes(id);
      const next = wasSelected ? prev.filter(x => x !== id) : [...prev, id];
      saveDaySelection(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      setUsageCounts(counts => {
        const current = counts[id] ?? 0;
        const nextCount = wasSelected ? Math.max(0, current - 1) : current + 1;
        if (nextCount === current) return counts;
        if (nextCount === 0) {
          const rest = { ...counts };
          delete rest[id];
          return rest;
        }
        return { ...counts, [id]: nextCount };
      });
      return next;
    });
  };

  const addItem = (nome: string, categoria: Categoria) => {
    if (!guardOnlineAction()) return;
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
    setUsageCounts(counts => ({ ...counts, [item.id]: (counts[item.id] ?? 0) + 1 }));
  };

  const removeItem = (id: string) => {
    if (!guardOnlineAction()) return;
    const wasSelected = daySelection.includes(id);
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
    if (wasSelected) {
      setUsageCounts(counts => {
        const current = counts[id] ?? 0;
        const nextCount = Math.max(0, current - 1);
        if (nextCount === 0) {
          const rest = { ...counts };
          delete rest[id];
          return rest;
        }
        return { ...counts, [id]: nextCount };
      });
    }
  };

  const renameItem = (id: string, newNome: string) => {
    if (!guardOnlineAction()) return;
    setComplements(prev => {
      const next = prev.map(item =>
        item.id === id ? { ...item, nome: newNome.trim() } : item
      );
      saveComplements(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const addCategory = (nome: string) => {
    if (!guardOnlineAction()) return;
    setCategories(prev => {
      const next = [...prev, nome.trim()];
      saveCategories(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const removeCategory = (nome: string) => {
    if (!guardOnlineAction()) return;
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
      setUsageCounts(counts => {
        const nextCounts = { ...counts };
        for (const id of removedIds) {
          if (!daySelection.includes(id)) continue;
          const nextCount = Math.max(0, (nextCounts[id] ?? 0) - 1);
          if (nextCount === 0) delete nextCounts[id];
          else nextCounts[id] = nextCount;
        }
        return nextCounts;
      });
    }
  };

  const moveCategory = (nome: string, direction: 'up' | 'down') => {
    if (!guardOnlineAction()) return;
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
