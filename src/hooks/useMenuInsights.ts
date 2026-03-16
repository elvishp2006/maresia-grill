import { useEffect, useMemo, useState } from 'react';
import { loadSelectionHistory, type SelectionHistoryEntry } from '../storage';
import type { Item } from '../types';
import { buildInsightMetrics } from '../insights';

export const useMenuInsights = (complements: Item[], daySelection: string[]) => {
  const [history, setHistory] = useState<SelectionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

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
  }, []);

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
