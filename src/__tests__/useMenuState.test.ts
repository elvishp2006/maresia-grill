import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, screen } from '@testing-library/react';
import { createElement } from 'react';
import { ToastProvider } from '../contexts/ToastContext';
import { useMenuState } from '../hooks/useMenuState';

vi.mock('../lib/firebase', () => ({ db: {} }));

const subscribeCategories = vi.fn();
const subscribeComplements = vi.fn();
const subscribeCategorySelectionRules = vi.fn();
const subscribeDaySelection = vi.fn();
const loadRecentSelections = vi.fn().mockResolvedValue({ '1': 3 });
const saveCategorySelectionRules = vi.fn().mockResolvedValue(undefined);
const saveCategories = vi.fn().mockResolvedValue(undefined);
const saveComplements = vi.fn().mockResolvedValue(undefined);
const saveDaySelection = vi.fn().mockResolvedValue(undefined);

vi.mock('../lib/storage', () => ({
  getDateKey: vi.fn((date?: Date) => {
    const current = date ?? new Date();
    return [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, '0'),
      String(current.getDate()).padStart(2, '0'),
    ].join('-');
  }),
  subscribeCategories: (...args: unknown[]) => subscribeCategories(...args),
  subscribeComplements: (...args: unknown[]) => subscribeComplements(...args),
  subscribeCategorySelectionRules: (...args: unknown[]) => subscribeCategorySelectionRules(...args),
  subscribeDaySelection: (...args: unknown[]) => subscribeDaySelection(...args),
  loadRecentSelections: (...args: unknown[]) => loadRecentSelections(...args),
  saveCategorySelectionRules: (...args: unknown[]) => saveCategorySelectionRules(...args),
  saveCategories: (...args: unknown[]) => saveCategories(...args),
  saveComplements: (...args: unknown[]) => saveComplements(...args),
  saveDaySelection: (...args: unknown[]) => saveDaySelection(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(ToastProvider, null, children);

beforeEach(() => {
  vi.clearAllMocks();

  subscribeCategories.mockImplementation((onValue: (value: string[]) => void) => {
    queueMicrotask(() => onValue(['Saladas', 'Carnes']));
    return vi.fn();
  });
  subscribeComplements.mockImplementation((onValue: (value: unknown[]) => void) => {
    queueMicrotask(() => onValue([
      { id: '1', nome: 'Alface', categoria: 'Saladas' },
      { id: '2', nome: 'Frango', categoria: 'Carnes' },
    ]));
    return vi.fn();
  });
  subscribeCategorySelectionRules.mockImplementation((onValue: (value: unknown[]) => void) => {
    queueMicrotask(() => onValue([]));
    return vi.fn();
  });
  subscribeDaySelection.mockImplementation((_dateKey: string, onValue: (value: string[]) => void) => {
    queueMicrotask(() => onValue(['1']));
    return vi.fn();
  });
  loadRecentSelections.mockResolvedValue({ '1': 3 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useMenuState', () => {
  const waitForReady = async (result: { current: ReturnType<typeof useMenuState> }) => {
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.usageCounts).toEqual({ '1': 3 }));
  };

  it('starts with loading=true and resolves data from subscriptions', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitForReady(result);
    expect(result.current.categories).toEqual(['Saladas', 'Carnes']);
    expect(result.current.complements).toHaveLength(2);
    expect(result.current.categorySelectionRules).toEqual([]);
    expect(result.current.daySelection).toEqual(['1']);
    expect(result.current.usageCounts).toEqual({ '1': 3 });
  });

  it('toggleItem adds item to selection if not selected', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);
    await act(async () => {
      result.current.toggleItem('2');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.daySelection).toContain('2'));
    expect(saveDaySelection).toHaveBeenCalledWith(expect.any(String), ['1', '2']);
  });

  it('toggleItem removes item from selection if already selected', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);
    await act(async () => {
      result.current.toggleItem('1');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.daySelection).not.toContain('1'));
    expect(saveDaySelection).toHaveBeenCalledWith(expect.any(String), []);
  });

  it('addItem creates new item and auto-selects it', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);
    await act(async () => {
      result.current.addItem('Tomate', 'Saladas');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.complements.some(i => i.nome === 'Tomate')).toBe(true));
    const tomate = result.current.complements.find(i => i.nome === 'Tomate');
    await waitFor(() => expect(result.current.daySelection).toContain(tomate?.id));
    expect(saveComplements).toHaveBeenCalled();
    expect(saveDaySelection).toHaveBeenCalled();
  });

  it('removeItem removes item from complements and daySelection', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);
    await act(async () => {
      result.current.removeItem('1');
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.complements.find(i => i.id === '1')).toBeUndefined());
    await waitFor(() => expect(result.current.daySelection).not.toContain('1'));
  });

  it('renameItem updates item name', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);
    await act(async () => {
      result.current.renameItem('1', 'Alface Americana');
      await Promise.resolve();
    });
    expect(result.current.complements.find(i => i.id === '1')?.nome).toBe('Alface Americana');
  });

  it('toggleSortMode switches between alpha and usage', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);
    expect(result.current.sortMode).toBe('alpha');
    act(() => result.current.toggleSortMode());
    expect(result.current.sortMode).toBe('usage');
    act(() => result.current.toggleSortMode());
    expect(result.current.sortMode).toBe('alpha');
  });

  it('saves category rules and links categories under the same shared limit', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.saveCategoryRule('Churrasco', {
        maxSelections: 2,
        linkedCategories: ['Carnes'],
      });
      await Promise.resolve();
    });

    expect(saveCategorySelectionRules).toHaveBeenCalledWith([
      { category: 'Churrasco', maxSelections: 2, sharedLimitGroupId: 'shared:Carnes__Churrasco' },
      { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'shared:Carnes__Churrasco' },
    ], ['Saladas', 'Carnes']);
  });

  it('shows the storage message when saving category limits fails', async () => {
    saveCategorySelectionRules.mockRejectedValueOnce(new Error('Não foi possível salvar os limites da categoria. Recarregue a tela e tente novamente.'));
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.saveCategoryRule('Carnes', { maxSelections: 2 });
      await Promise.resolve();
    });

    expect(screen.getByText('Não foi possível salvar os limites da categoria. Recarregue a tela e tente novamente.')).toBeInTheDocument();
  });

  it('blocks remote actions and preserves state when offline', async () => {
    const { result } = renderHook(() => useMenuState(false, true), { wrapper });
    await waitForReady(result);

    act(() => result.current.toggleItem('2'));

    expect(result.current.daySelection).toEqual(['1']);
    expect(screen.getByText('Esta acao requer conexao com a internet.')).toBeInTheDocument();
  });

  it('blocks remote actions when another device owns the lock', async () => {
    const { result } = renderHook(() => useMenuState(true, false), { wrapper });
    await waitForReady(result);

    act(() => result.current.addCategory('Sobremesas'));

    expect(result.current.categories).toEqual(['Saladas', 'Carnes']);
    expect(saveCategories).not.toHaveBeenCalled();
    expect(screen.getByText('Outro dispositivo esta editando o cardapio neste momento.')).toBeInTheDocument();
  });

  it('switches to the new day and clears the selection after midnight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-17T23:59:58'));

    subscribeDaySelection.mockImplementation((dateKey: string, onValue: (value: string[]) => void) => {
      queueMicrotask(() => onValue(dateKey === '2026-03-17' ? ['1'] : []));
      return vi.fn();
    });

    const { result } = renderHook(() => useMenuState(), { wrapper });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.daySelection).toEqual(['1']);

    await act(async () => {
      vi.setSystemTime(new Date('2026-03-18T00:00:01'));
      vi.advanceTimersByTime(2_000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.daySelection).toEqual([]);
    expect(screen.getByText('Novo dia carregado.')).toBeInTheDocument();
  });
});
