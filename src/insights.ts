import type { Item } from './types';
import type { SelectionHistoryEntry } from './storage';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export interface InsightListItem {
  id: string;
  nome: string;
  categoria: string;
  count: number;
}

export interface WeekdayAverage {
  weekday: number;
  label: string;
  average: number;
  sampleSize: number;
}

export interface SuggestionItem {
  id: string;
  nome: string;
  categoria: string;
  score: number;
  reason: string;
  totalCount: number;
  weekdayCount: number;
}

export interface InsightMetrics {
  topItems: InsightListItem[];
  weekdayAverages: WeekdayAverage[];
  categoryLeaders: InsightListItem[];
  streakItems: Array<InsightListItem & { streak: number }>;
  neglectedItems: Array<InsightListItem & { lastSeen: string | null }>;
  suggestedItems: SuggestionItem[];
  trackedDays: number;
  weekdayLabel: string;
}

interface BuildInsightMetricsParams {
  complements: Item[];
  history: SelectionHistoryEntry[];
  daySelection: string[];
  now?: Date;
}

const isValidHistoryEntry = (entry: SelectionHistoryEntry | null | undefined): entry is SelectionHistoryEntry =>
  Boolean(entry)
  && typeof entry?.dateKey === 'string'
  && Array.isArray(entry.ids)
  && entry.ids.every(id => typeof id === 'string');

const sanitizeHistory = (history: SelectionHistoryEntry[]) =>
  history.filter(isValidHistoryEntry).map(entry => ({
    dateKey: entry.dateKey,
    ids: [...entry.ids],
  }));

const sanitizeDaySelection = (daySelection: string[]) =>
  daySelection.filter(id => typeof id === 'string');

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getWeekdayFromDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};

const mergeCurrentDay = (history: SelectionHistoryEntry[], daySelection: string[], now: Date) => {
  const todayKey = getDateKey(now);
  const withoutToday = history.filter(entry => entry.dateKey !== todayKey);
  return [
    { dateKey: todayKey, ids: [...daySelection] },
    ...withoutToday,
  ].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
};

const buildCounts = (history: SelectionHistoryEntry[]) => {
  const counts: Record<string, number> = {};
  for (const entry of history) {
    for (const id of entry.ids) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

const buildLastSeen = (history: SelectionHistoryEntry[]) => {
  const lastSeen: Record<string, string> = {};
  for (const entry of history) {
    for (const id of entry.ids) {
      if (!lastSeen[id]) lastSeen[id] = entry.dateKey;
    }
  }
  return lastSeen;
};

const buildStreaks = (history: SelectionHistoryEntry[]) => {
  const streaks: Record<string, number> = {};
  const current: Record<string, number> = {};
  const sortedAsc = [...history].sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  for (let i = 0; i < sortedAsc.length; i += 1) {
    const entry = sortedAsc[i];
    const prev = sortedAsc[i - 1];
    const isConsecutiveDay = prev
      ? (
        (Date.parse(`${entry.dateKey}T00:00:00Z`) - Date.parse(`${prev.dateKey}T00:00:00Z`))
        / (1000 * 60 * 60 * 24)
      ) === 1
      : false;

    const ids = new Set(entry.ids);

    for (const id of Object.keys(current)) {
      if (!ids.has(id)) current[id] = 0;
    }

    for (const id of ids) {
      current[id] = isConsecutiveDay ? (current[id] ?? 0) + 1 : 1;
      streaks[id] = Math.max(streaks[id] ?? 0, current[id]);
    }
  }

  return streaks;
};

const toInsightItems = (
  itemIds: string[],
  complementsById: Map<string, Item>,
  counts: Record<string, number>,
) => itemIds.flatMap(id => {
  const item = complementsById.get(id);
  if (!item) return [];
  return [{
    id,
    nome: item.nome,
    categoria: item.categoria,
    count: counts[id] ?? 0,
  }];
});

export const buildInsightMetrics = ({
  complements,
  history,
  daySelection,
  now = new Date(),
}: BuildInsightMetricsParams): InsightMetrics => {
  const safeHistory = sanitizeHistory(history);
  const safeDaySelection = sanitizeDaySelection(daySelection);
  const mergedHistory = mergeCurrentDay(safeHistory, safeDaySelection, now);
  const complementsById = new Map(complements.map(item => [item.id, item]));
  const totalCounts = buildCounts(mergedHistory);
  const lastSeen = buildLastSeen(mergedHistory);
  const streaks = buildStreaks(mergedHistory);
  const weekday = now.getUTCDay();
  const weekdayLabel = WEEKDAY_LABELS[weekday];

  const topItems = toInsightItems(
    Object.keys(totalCounts).sort((a, b) => {
      const diff = (totalCounts[b] ?? 0) - (totalCounts[a] ?? 0);
      if (diff !== 0) return diff;
      return (complementsById.get(a)?.nome ?? '').localeCompare(complementsById.get(b)?.nome ?? '', 'pt-BR');
    }).slice(0, 5),
    complementsById,
    totalCounts,
  );

  const weekdayStats = Array.from({ length: 7 }, (_, index) => {
    const entries = mergedHistory.filter(entry => getWeekdayFromDateKey(entry.dateKey) === index);
    const total = entries.reduce((sum, entry) => sum + entry.ids.length, 0);
    return {
      weekday: index,
      label: WEEKDAY_LABELS[index],
      average: entries.length > 0 ? Number((total / entries.length).toFixed(1)) : 0,
      sampleSize: entries.length,
    };
  });

  const categoryCounts = new Map<string, Record<string, number>>();
  for (const [id, count] of Object.entries(totalCounts)) {
    const item = complementsById.get(id);
    if (!item) continue;
    const counts = categoryCounts.get(item.categoria) ?? {};
    counts[id] = count;
    categoryCounts.set(item.categoria, counts);
  }

  const categoryLeaders = Array.from(categoryCounts.entries()).flatMap(([, counts]) => {
    const bestId = Object.keys(counts).sort((a, b) => {
      const diff = counts[b] - counts[a];
      if (diff !== 0) return diff;
      return (complementsById.get(a)?.nome ?? '').localeCompare(complementsById.get(b)?.nome ?? '', 'pt-BR');
    })[0];
    if (!bestId) return [];
    return toInsightItems([bestId], complementsById, totalCounts);
  }).sort((a, b) => b.count - a.count).slice(0, 4);

  const streakItems = toInsightItems(
    Object.keys(streaks).sort((a, b) => {
      const diff = (streaks[b] ?? 0) - (streaks[a] ?? 0);
      if (diff !== 0) return diff;
      return (complementsById.get(a)?.nome ?? '').localeCompare(complementsById.get(b)?.nome ?? '', 'pt-BR');
    }).slice(0, 4),
    complementsById,
    totalCounts,
  ).map(item => ({ ...item, streak: streaks[item.id] ?? 0 }));

  const neglectedItems = complements
    .map(item => ({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      count: totalCounts[item.id] ?? 0,
      lastSeen: lastSeen[item.id] ?? null,
    }))
    .sort((a, b) => {
      const diff = a.count - b.count;
      if (diff !== 0) return diff;
      if (!a.lastSeen && !b.lastSeen) return a.nome.localeCompare(b.nome, 'pt-BR');
      if (!a.lastSeen) return -1;
      if (!b.lastSeen) return 1;
      return a.lastSeen.localeCompare(b.lastSeen);
    })
    .slice(0, 5);

  const sameWeekdayHistory = mergedHistory.filter(entry => getWeekdayFromDateKey(entry.dateKey) === weekday).slice(0, 8);
  const sameWeekdayCounts = buildCounts(sameWeekdayHistory);
  const selectedToday = new Set(safeDaySelection);

  const suggestedItems = complements
    .filter(item => !selectedToday.has(item.id))
    .map(item => {
      const overall = totalCounts[item.id] ?? 0;
      const sameWeekday = sameWeekdayCounts[item.id] ?? 0;
      const recentIndex = mergedHistory.findIndex(entry => entry.ids.includes(item.id));
      const recencyBonus = recentIndex >= 0 ? Math.max(0, 6 - recentIndex) : 0;
      const streakPenalty = Math.max(0, (streaks[item.id] ?? 0) - 2);
      const score = overall + (sameWeekday * 2) + recencyBonus - streakPenalty;

      let reason = 'Historico moderado de uso';
      if (sameWeekday > 0) {
        reason = `Muito usado no padrão de ${weekdayLabel}`;
      } else if (overall >= 4) {
        reason = `Apareceu ${overall} vezes no período`;
      } else if (recentIndex >= 0) {
        reason = 'Usado recentemente';
      }

      return {
        id: item.id,
        nome: item.nome,
        categoria: item.categoria,
        score,
        reason,
        totalCount: overall,
        weekdayCount: sameWeekday,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    })
    .slice(0, 5);

  return {
    topItems,
    weekdayAverages: weekdayStats,
    categoryLeaders,
    streakItems,
    neglectedItems,
    suggestedItems,
    trackedDays: mergedHistory.length,
    weekdayLabel,
  };
};
