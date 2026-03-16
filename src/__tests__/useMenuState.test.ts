import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { ToastProvider } from '../contexts/ToastContext';
import { useMenuState } from '../hooks/useMenuState';

vi.mock('../firebase', () => ({ db: {} }));

vi.mock('../storage', () => ({
  loadCategories: vi.fn().mockResolvedValue(['Saladas', 'Carnes']),
  loadComplements: vi.fn().mockResolvedValue([
    { id: '1', nome: 'Alface', categoria: 'Saladas' },
    { id: '2', nome: 'Frango', categoria: 'Carnes' },
  ]),
  loadDaySelection: vi.fn().mockResolvedValue(['1']),
  loadRecentSelections: vi.fn().mockResolvedValue({ '1': 3 }),
  saveCategories: vi.fn().mockResolvedValue(undefined),
  saveComplements: vi.fn().mockResolvedValue(undefined),
  saveDaySelection: vi.fn().mockResolvedValue(undefined),
}));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(ToastProvider, null, children);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMenuState', () => {
  it('starts with loading=true and resolves data', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.categories).toEqual(['Saladas', 'Carnes']);
    expect(result.current.complements).toHaveLength(2);
    expect(result.current.daySelection).toEqual(['1']);
    expect(result.current.usageCounts).toEqual({ '1': 3 });
  });

  it('toggleItem adds item to selection if not selected', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.toggleItem('2'));
    expect(result.current.daySelection).toContain('2');
  });

  it('toggleItem removes item from selection if already selected', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.toggleItem('1'));
    expect(result.current.daySelection).not.toContain('1');
  });

  it('addItem creates new item and auto-selects it', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.addItem('Tomate', 'Saladas'));
    expect(result.current.complements.some(i => i.nome === 'Tomate')).toBe(true);
    const tomate = result.current.complements.find(i => i.nome === 'Tomate');
    expect(result.current.daySelection).toContain(tomate?.id);
  });

  it('removeItem removes item from complements and daySelection', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.removeItem('1'));
    expect(result.current.complements.find(i => i.id === '1')).toBeUndefined();
    expect(result.current.daySelection).not.toContain('1');
  });

  it('renameItem updates item name', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.renameItem('1', 'Alface Americana'));
    expect(result.current.complements.find(i => i.id === '1')?.nome).toBe('Alface Americana');
  });

  it('toggleSortMode switches between alpha and usage', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sortMode).toBe('alpha');
    act(() => result.current.toggleSortMode());
    expect(result.current.sortMode).toBe('usage');
    act(() => result.current.toggleSortMode());
    expect(result.current.sortMode).toBe('alpha');
  });
});
