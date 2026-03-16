import { useEffect, useMemo, useState } from 'react';
import { loadSelectionHistory, type SelectionHistoryEntry } from '../storage';
import type { Item } from '../types';
import { buildInsightMetrics } from '../insights';

export const useMenuInsights = (complements: Item[], daySelection: string[], enabled = true) => {
  const [history, setHistory] = useState<SelectionHistoryEntry[]>([]);
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

    loadSelectionHistory(90)
      .then(entries => {
        if (cancelled) return;
        setHistory(entries);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Nao foi possivel carregar o historico de selecoes.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const metrics = useMemo(
    () => buildInsightMetrics({ complements, history, daySelection }),
    [complements, daySelection, history],
  );

  return {
    ...metrics,
    loading,
    error,
  };
};
