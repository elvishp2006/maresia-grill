import { useEffect, useRef, useState } from 'react';
import type { Item, Categoria, CategorySelectionRule } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import * as storage from '../lib/storage';
import { useToast } from '../contexts/ToastContext';
import {
  removeCategorySelectionRule,
  upsertCategorySelectionRule,
  type CategorySelectionRuleInput,
} from '../lib/categorySelectionRules';
import { normalizePriceCents } from '../lib/billing';

let nextId = Date.now();
const genId = () => String(nextId++);
const OFFLINE_ACTION_MESSAGE = 'Esta acao requer conexao com a internet.';
const READ_ONLY_ACTION_MESSAGE = 'Outro dispositivo esta editando o cardapio neste momento.';
const DAY_CHANGED_MESSAGE = 'Novo dia carregado.';

export const useMenuState = (isOnline = true, canEdit = true) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [complements, setComplements] = useState<Item[]>([]);
  const [categorySelectionRules, setCategorySelectionRules] = useState<CategorySelectionRule[]>([]);
  const [daySelection, setDaySelection] = useState<string[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [sortMode, setSortMode] = useState<'alpha' | 'usage'>('alpha');
  const [loading, setLoading] = useState(true);
  const [currentDateKey, setCurrentDateKey] = useState(() => storage.getDateKey());
  const lastDateKeyRef = useRef(currentDateKey);
  const loadReadyRef = useRef({ categories: false, complements: false, rules: false, selection: false });
  const { showToast } = useToast();

  const handleSaveError = () => showToast('Erro ao salvar. Verifique sua conexão.', 'error');

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

    const markGlobalReady = (key: 'categories' | 'complements' | 'rules') => {
      loadReadyRef.current[key] = true;
      if (active && Object.values(loadReadyRef.current).every(Boolean)) setLoading(false);
    };

    const handleError = () => {
      if (!active) return;
      showToast('Erro ao carregar dados. Verifique sua conexão.', 'error');
      setLoading(false);
    };

    const unsubscribeCategories = storage.subscribeCategories((cats) => {
      if (!active) return;
      setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES);
      markGlobalReady('categories');
    }, handleError);

    const unsubscribeComplements = storage.subscribeComplements((items) => {
      if (!active) return;
      setComplements(items);
      markGlobalReady('complements');
    }, handleError);

    const unsubscribeCategorySelectionRules = storage.subscribeCategorySelectionRules((rules) => {
      if (!active) return;
      setCategorySelectionRules(rules);
      markGlobalReady('rules');
    }, handleError);

    return () => {
      active = false;
      unsubscribeCategories();
      unsubscribeComplements();
      unsubscribeCategorySelectionRules();
    };
  }, [showToast]);

  useEffect(() => {
    let active = true;
    loadReadyRef.current.selection = false;

    const unsubscribeSelection = storage.subscribeDaySelection(currentDateKey, (ids) => {
      if (!active) return;
      setDaySelection(ids);
      loadReadyRef.current.selection = true;
      if (Object.values(loadReadyRef.current).every(Boolean)) setLoading(false);
    }, () => {
      if (!active) return;
      showToast('Erro ao carregar dados. Verifique sua conexão.', 'error');
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribeSelection();
    };
  }, [currentDateKey, showToast]);

  useEffect(() => {
    let active = true;
    storage.loadRecentSelections(7)
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

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const timeoutId = window.setTimeout(() => {
      setCurrentDateKey(storage.getDateKey());
    }, Math.max(1, nextMidnight.getTime() - now.getTime()));

    return () => window.clearTimeout(timeoutId);
  }, [currentDateKey]);

  useEffect(() => {
    if (lastDateKeyRef.current === currentDateKey) return;
    lastDateKeyRef.current = currentDateKey;
    showToast(DAY_CHANGED_MESSAGE, 'info', 2500);
  }, [currentDateKey, showToast]);

  const toggleSortMode = () => setSortMode(m => m === 'alpha' ? 'usage' : 'alpha');

  const toggleItem = (id: string) => {
    if (!guardWritableAction()) return;
    setDaySelection(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      storage.saveDaySelection(currentDateKey, next).catch(handleSaveError);
      return next;
    });
  };

  const addItem = (nome: string, categoria: Categoria, priceCents?: number | null) => {
    if (!guardWritableAction()) return;
    const item: Item = { id: genId(), nome: nome.trim(), categoria, priceCents: normalizePriceCents(priceCents) };
    setComplements(prev => {
      const next = [...prev, item];
      storage.saveComplements(next).catch(handleSaveError);
      return next;
    });
    setDaySelection(prev => {
      const next = [...prev, item.id];
      storage.saveDaySelection(currentDateKey, next).catch(handleSaveError);
      return next;
    });
  };

  const removeItem = (id: string) => {
    if (!guardWritableAction()) return;
    setComplements(prev => {
      const next = prev.filter(x => x.id !== id);
      storage.saveComplements(next).catch(handleSaveError);
      return next;
    });
    setDaySelection(prev => {
      const next = prev.filter(x => x !== id);
      storage.saveDaySelection(currentDateKey, next).catch(handleSaveError);
      return next;
    });
  };

  const updateItem = (id: string, nextPatch: { nome: string; priceCents?: number | null }) => {
    if (!guardWritableAction()) return;
    setComplements(prev => {
      const next = prev.map(item =>
        item.id === id
          ? {
            ...item,
            nome: nextPatch.nome.trim(),
            priceCents: normalizePriceCents(nextPatch.priceCents),
          }
          : item
      );
      storage.saveComplements(next).catch(handleSaveError);
      return next;
    });
  };

  const renameItem = (id: string, newNome: string) => {
    updateItem(id, { nome: newNome });
  };

  const addCategory = (nome: string) => {
    if (!guardWritableAction()) return;
    setCategories(prev => {
      const next = [...prev, nome.trim()];
      storage.saveCategories(next).catch(handleSaveError);
      return next;
    });
  };

  const removeCategory = (nome: string) => {
    if (!guardWritableAction()) return;
    const removedIds = complements.filter(item => item.categoria === nome).map(item => item.id);
    setCategories(prev => {
      const next = prev.filter(c => c !== nome);
      storage.saveCategories(next).catch(handleSaveError);
      return next;
    });
    setCategorySelectionRules(prev => {
      const next = removeCategorySelectionRule(prev, nome);
      storage.saveCategorySelectionRules(next).catch(handleSaveError);
      return next;
    });
    if (removedIds.length > 0) {
      setComplements(prev => {
        const next = prev.filter(item => item.categoria !== nome);
        storage.saveComplements(next).catch(handleSaveError);
        return next;
      });
      setDaySelection(prev => {
        const next = prev.filter(id => !removedIds.includes(id));
        storage.saveDaySelection(currentDateKey, next).catch(handleSaveError);
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
      storage.saveCategories(next).catch(handleSaveError);
      return next;
    });
  };

  const saveCategoryRule = (category: Categoria, input: CategorySelectionRuleInput) => {
    if (!guardWritableAction()) return;
    setCategorySelectionRules(prev => {
      const next = upsertCategorySelectionRule(prev, category, input);
      storage.saveCategorySelectionRules(next).catch(handleSaveError);
      return next;
    });
  };

  return {
    categories,
    complements,
    categorySelectionRules,
    daySelection,
    usageCounts,
    sortMode,
    loading,
    currentDateKey,
    toggleSortMode,
    toggleItem,
    addItem,
    removeItem,
    renameItem,
    updateItem,
    addCategory,
    removeCategory,
    moveCategory,
    saveCategoryRule,
  };
};
