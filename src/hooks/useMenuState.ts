import { useEffect, useState } from 'react';
import type { Item, Categoria } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import {
  loadRecentSelections,
  saveCategories,
  saveComplements,
  saveDaySelection,
  subscribeCategories,
  subscribeComplements,
  subscribeDaySelection,
} from '../lib/storage';
import { useToast } from '../contexts/ToastContext';

let nextId = Date.now();
const genId = () => String(nextId++);
const OFFLINE_ACTION_MESSAGE = 'Esta acao requer conexao com a internet.';
const READ_ONLY_ACTION_MESSAGE = 'Outro dispositivo esta editando o cardapio neste momento.';

export const useMenuState = (isOnline = true, canEdit = true) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [complements, setComplements] = useState<Item[]>([]);
  const [daySelection, setDaySelection] = useState<string[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<'alpha' | 'usage'>('alpha');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const guardWritableAction = () => {
    if (!isOnline) {
      showToast(OFFLINE_ACTION_MESSAGE, 'info');
      return false;
    }
    if (canEdit) return true;
    showToast(READ_ONLY_ACTION_MESSAGE, 'info');
    return false;
  };

  useEffect(() => {
    let active = true;
    const ready = {
      categories: false,
      complements: false,
      selection: false,
    };

    const markReady = (key: keyof typeof ready) => {
      ready[key] = true;
      if (active && Object.values(ready).every(Boolean)) setLoading(false);
    };

    const handleError = () => {
      if (!active) return;
      showToast('Erro ao carregar dados. Verifique sua conexão.', 'error');
      setLoading(false);
    };

    const unsubscribeCategories = subscribeCategories((cats) => {
      if (!active) return;
      setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES);
      markReady('categories');
    }, handleError);

    const unsubscribeComplements = subscribeComplements((items) => {
      if (!active) return;
      setComplements(items);
      markReady('complements');
    }, handleError);

    const unsubscribeSelection = subscribeDaySelection((ids) => {
      if (!active) return;
      setDaySelection(ids);
      markReady('selection');
    }, handleError);

    return () => {
      active = false;
      unsubscribeCategories();
      unsubscribeComplements();
      unsubscribeSelection();
    };
  }, [showToast]);

  useEffect(() => {
    let active = true;
    loadRecentSelections(7)
      .then((counts) => {
        if (!active) return;
        setUsageCounts(counts);
      })
      .catch(() => {
        if (!active) return;
        showToast('Erro ao carregar dados. Verifique sua conexão.', 'error');
      });

    return () => {
      active = false;
    };
  }, [daySelection, showToast]);

  const toggleSortMode = () => setSortMode(m => m === 'alpha' ? 'usage' : 'alpha');

  const toggleItem = (id: string) => {
    if (!guardWritableAction()) return;
    setDaySelection(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveDaySelection(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const addItem = (nome: string, categoria: Categoria) => {
    if (!guardWritableAction()) return;
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
    if (!guardWritableAction()) return;
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
    if (!guardWritableAction()) return;
    setComplements(prev => {
      const next = prev.map(item =>
        item.id === id ? { ...item, nome: newNome.trim() } : item
      );
      saveComplements(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const addCategory = (nome: string) => {
    if (!guardWritableAction()) return;
    setCategories(prev => {
      const next = [...prev, nome.trim()];
      saveCategories(next).catch(() => showToast('Erro ao salvar. Verifique sua conexão.', 'error'));
      return next;
    });
  };

  const removeCategory = (nome: string) => {
    if (!guardWritableAction()) return;
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
    if (!guardWritableAction()) return;
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
