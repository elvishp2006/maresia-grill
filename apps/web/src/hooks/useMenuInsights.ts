import { useEffect, useMemo, useState } from 'react';
import {
  loadMenuAvailabilityHistory,
  loadSelectionHistory,
  type SelectionHistoryEntry,
} from '../lib/storage';
import type { Item } from '../types';
import { buildInsightMetrics } from '../lib/insights';

export const useMenuInsights = (complements: Item[], daySelection: string[], enabled = true) => {
  const [history, setHistory] = useState<SelectionHistoryEntry[]>([]);
  const [availabilityHistory, setAvailabilityHistory] = useState<SelectionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    Promise.all([
      loadSelectionHistory(90),
      loadMenuAvailabilityHistory(90),
    ])
      .then(([selectionEntries, availabilityEntries]) => {
        if (cancelled) return;
        setHistory(selectionEntries);
        setAvailabilityHistory(availabilityEntries);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Não foi possível carregar o histórico das estatísticas.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const metrics = useMemo(
    () => buildInsightMetrics({ complements, history, availabilityHistory, daySelection }),
    [availabilityHistory, complements, daySelection, history],
  );

  return {
    ...metrics,
    loading,
    error,
  };
};
