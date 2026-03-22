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
import { showAdminError, showAdminInfo } from '../lib/adminFeedback';
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
  const [pendingWrites, setPendingWrites] = useState(0);
  const [dataRevision, setDataRevision] = useState(0);
  const [persistedRevision, setPersistedRevision] = useState(0);
  const [currentDateKey, setCurrentDateKey] = useState(() => storage.getDateKey());
  const lastDateKeyRef = useRef(currentDateKey);
  const loadReadyRef = useRef({ categories: false, complements: false, rules: false, selection: false });
  const revisionStatusRef = useRef(new Map<number, { pending: number; failed: boolean }>());
  const { showToast } = useToast();

  const handleSaveError = (error: unknown) => showAdminError(showToast, 'save', error);
  const markDataRevision = () => {
    const nextRevision = dataRevision + 1;
    setDataRevision(nextRevision);
    return nextRevision;
  };
  const trackWrite = (revision: number, operation: Promise<unknown>) => {
    const currentRevision = revisionStatusRef.current.get(revision) ?? { pending: 0, failed: false };
    revisionStatusRef.current.set(revision, { ...currentRevision, pending: currentRevision.pending + 1 });
    setPendingWrites(current => current + 1);
    operation
      .then(() => {
        const nextStatus = revisionStatusRef.current.get(revision);
        if (!nextStatus) return;
        const remaining = nextStatus.pending - 1;
        if (remaining <= 0) {
          revisionStatusRef.current.delete(revision);
          if (!nextStatus.failed) setPersistedRevision(current => Math.max(current, revision));
          return;
        }
        revisionStatusRef.current.set(revision, { ...nextStatus, pending: remaining });
      })
      .catch((error) => {
        const nextStatus = revisionStatusRef.current.get(revision);
        if (nextStatus) {
          const remaining = Math.max(0, nextStatus.pending - 1);
          if (remaining <= 0) revisionStatusRef.current.delete(revision);
          else revisionStatusRef.current.set(revision, { pending: remaining, failed: true });
        }
        handleSaveError(error);
      })
      .finally(() => {
        setPendingWrites(current => Math.max(0, current - 1));
      });
  };

  const guardWritableAction = () => {
    if (!isOnline) {
      showAdminInfo(showToast, OFFLINE_ACTION_MESSAGE);
      return false;
    }
    if (canEdit) return true;
    showAdminInfo(showToast, READ_ONLY_ACTION_MESSAGE);
    return false;
  };

  useEffect(() => {
    let active = true;

    const markGlobalReady = (key: 'categories' | 'complements' | 'rules') => {
      loadReadyRef.current[key] = true;
      if (active && Object.values(loadReadyRef.current).every(Boolean)) setLoading(false);
    };

    const handleError = (error?: Error) => {
      if (!active) return;
      showAdminError(showToast, 'load', error);
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
    }, (error) => {
      if (!active) return;
      showAdminError(showToast, 'load', error);
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
        showAdminError(showToast, 'load');
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
    showAdminInfo(showToast, DAY_CHANGED_MESSAGE);
    const alwaysActiveIds = complements.filter(item => item.alwaysActive).map(item => item.id);
    if (alwaysActiveIds.length > 0) {
      void storage.initDaySelectionIfEmpty(currentDateKey, alwaysActiveIds);
    }
  }, [currentDateKey, showToast, complements]);

  const toggleSortMode = () => setSortMode(m => m === 'alpha' ? 'usage' : 'alpha');

  const toggleItem = (id: string) => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
    setDaySelection(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      trackWrite(revision, storage.saveDaySelection(currentDateKey, next));
      return next;
    });
  };

  const addItem = (nome: string, categoria: Categoria, priceCents?: number | null) => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
    const item: Item = { id: genId(), nome: nome.trim(), categoria, priceCents: normalizePriceCents(priceCents) };
    setComplements(prev => {
      const next = [...prev, item];
      trackWrite(revision, storage.saveComplements(next));
      return next;
    });
    setDaySelection(prev => {
      const next = [...prev, item.id];
      trackWrite(revision, storage.saveDaySelection(currentDateKey, next));
      return next;
    });
  };

  const removeItem = (id: string) => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
    setComplements(prev => {
      const next = prev.filter(x => x.id !== id);
      trackWrite(revision, storage.saveComplements(next));
      return next;
    });
    setDaySelection(prev => {
      const next = prev.filter(x => x !== id);
      trackWrite(revision, storage.saveDaySelection(currentDateKey, next));
      return next;
    });
  };

  const updateItem = (id: string, nextPatch: { nome: string; priceCents?: number | null }) => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
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
      trackWrite(revision, storage.saveComplements(next));
      return next;
    });
  };

  const updateItemAlwaysActive = (itemId: string, alwaysActive: boolean) => {
    if (!guardWritableAction()) return;
    setComplements(prev => prev.map(item => item.id === itemId ? { ...item, alwaysActive } : item));
    void storage.saveItemAlwaysActive(itemId, alwaysActive);
  };

  const renameItem = (id: string, newNome: string) => {
    updateItem(id, { nome: newNome });
  };

  const addCategory = (nome: string) => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
    setCategories(prev => {
      const next = [...prev, nome.trim()];
      trackWrite(revision, storage.saveCategories(next));
      return next;
    });
  };

  const removeCategory = (nome: string) => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
    const removedIds = complements.filter(item => item.categoria === nome).map(item => item.id);
    setCategories(prev => {
      const next = prev.filter(c => c !== nome);
      trackWrite(revision, storage.saveCategories(next));
      return next;
    });
    setCategorySelectionRules(prev => {
      const next = removeCategorySelectionRule(prev, nome);
      trackWrite(revision, storage.saveCategorySelectionRules(next, categories.filter(category => category !== nome)));
      return next;
    });
    if (removedIds.length > 0) {
      setComplements(prev => {
        const next = prev.filter(item => item.categoria !== nome);
        trackWrite(revision, storage.saveComplements(next));
        return next;
      });
      setDaySelection(prev => {
        const next = prev.filter(id => !removedIds.includes(id));
        trackWrite(revision, storage.saveDaySelection(currentDateKey, next));
        return next;
      });
    }
  };

  const moveCategory = (nome: string, direction: 'up' | 'down') => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
    setCategories(prev => {
      const idx = prev.indexOf(nome);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      trackWrite(revision, storage.saveCategories(next));
      return next;
    });
  };

  const saveCategoryRule = (category: Categoria, input: CategorySelectionRuleInput) => {
    if (!guardWritableAction()) return;
    const revision = markDataRevision();
    setCategorySelectionRules(prev => {
      const next = upsertCategorySelectionRule(prev, category, input);
      trackWrite(revision, storage.saveCategorySelectionRules(next, categories));
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
    pendingWrites,
    dataRevision,
    persistedRevision,
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
    updateItemAlwaysActive,
  };
};
