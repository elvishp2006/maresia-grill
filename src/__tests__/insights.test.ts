import { describe, it, expect } from 'vitest';
import { buildInsightMetrics } from '../insights';
import type { Item } from '../types';
import type { SelectionHistoryEntry } from '../storage';

const complements: Item[] = [
  { id: '1', nome: 'Arroz', categoria: 'Acompanhamentos' },
  { id: '2', nome: 'Feijao', categoria: 'Acompanhamentos' },
  { id: '3', nome: 'Frango', categoria: 'Carnes' },
  { id: '4', nome: 'Alface', categoria: 'Saladas' },
];

const history: SelectionHistoryEntry[] = [
  { dateKey: '2026-03-16', ids: ['1', '3'] },
  { dateKey: '2026-03-09', ids: ['1', '2'] },
  { dateKey: '2026-03-02', ids: ['1', '3'] },
  { dateKey: '2026-03-10', ids: ['4'] },
  { dateKey: '2026-03-08', ids: ['3'] },
];

describe('buildInsightMetrics', () => {
  it('builds top items and weekday averages from history', () => {
    const metrics = buildInsightMetrics({
      complements,
      history,
      daySelection: ['1', '3'],
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(metrics.topItems[0]).toMatchObject({ id: '1', count: 3 });
    expect(metrics.weekdayAverages.find(entry => entry.label === 'Seg')).toMatchObject({
      average: 2,
      sampleSize: 3,
    });
  });

  it('suggests items based on same weekday and excludes already selected ones', () => {
    const metrics = buildInsightMetrics({
      complements,
      history,
      daySelection: ['1'],
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(metrics.suggestedItems.some(item => item.id === '1')).toBe(false);
    expect(metrics.suggestedItems.find(item => item.id === '3')).toMatchObject({
      id: '3',
      weekdayCount: 1,
    });
  });

  it('lists neglected items with unseen complements first', () => {
    const metrics = buildInsightMetrics({
      complements,
      history,
      daySelection: [],
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(metrics.neglectedItems[0]).toMatchObject({
      id: '2',
      count: 1,
    });
    expect(metrics.neglectedItems.at(-1)?.id).toBe('1');
  });

  it('ignores malformed history rows instead of crashing', () => {
    const malformedHistory = [
      ...history,
      { dateKey: '2026-03-15', ids: undefined },
      { dateKey: 42, ids: ['1'] },
    ] as unknown as SelectionHistoryEntry[];

    const metrics = buildInsightMetrics({
      complements,
      history: malformedHistory,
      daySelection: ['1'],
      now: new Date('2026-03-16T12:00:00Z'),
    });

    expect(metrics.topItems[0]).toMatchObject({ id: '1', count: 3 });
    expect(metrics.weekdayAverages.find(entry => entry.label === 'Dom')).toMatchObject({
      sampleSize: 1,
    });
  });
});
