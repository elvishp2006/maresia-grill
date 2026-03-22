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
const saveCategoryExcludeFromShare = vi.fn().mockResolvedValue(undefined);
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
  saveCategoryExcludeFromShare: (...args: unknown[]) => saveCategoryExcludeFromShare(...args),
  saveCategories: (...args: unknown[]) => saveCategories(...args),
  saveComplements: (...args: unknown[]) => saveComplements(...args),
  saveDaySelection: (...args: unknown[]) => saveDaySelection(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(ToastProvider, null, children);

beforeEach(() => {
  vi.clearAllMocks();

  subscribeCategories.mockImplementation((onValue: (value: unknown[]) => void) => {
    queueMicrotask(() => onValue([
      { id: 'cat-saladas', name: 'Saladas' },
      { id: 'cat-carnes', name: 'Carnes' },
    ]));
    return vi.fn();
  });
  subscribeComplements.mockImplementation((onValue: (value: unknown[]) => void) => {
    queueMicrotask(() => onValue([
      { id: '1', nome: 'Alface', categoria: 'cat-saladas' },
      { id: '2', nome: 'Frango', categoria: 'cat-carnes' },
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
    expect(result.current.categories).toEqual([
      { id: 'cat-saladas', name: 'Saladas' },
      { id: 'cat-carnes', name: 'Carnes' },
    ]);
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

  it('updateItem normalizes price and persists the edited item', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.updateItem('1', { nome: 'Alface premium', priceCents: 99.7 });
      await Promise.resolve();
    });

    expect(result.current.complements.find(i => i.id === '1')).toEqual(
      expect.objectContaining({ nome: 'Alface premium', priceCents: 100 }),
    );
    expect(saveComplements).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: '1', nome: 'Alface premium', priceCents: 100 }),
    ]));
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
      result.current.saveCategoryRule({ id: 'cat-churrasco', name: 'Churrasco' }, {
        maxSelections: 2,
        linkedCategories: ['Carnes'],
      });
      await Promise.resolve();
    });

    expect(saveCategorySelectionRules).toHaveBeenCalledWith([
      expect.objectContaining({ category: 'Churrasco', maxSelections: 2, sharedLimitGroupId: 'shared:Carnes__Churrasco' }),
      expect.objectContaining({ category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'shared:Carnes__Churrasco' }),
    ], [
      { id: 'cat-saladas', name: 'Saladas' },
      { id: 'cat-carnes', name: 'Carnes' },
    ]);
  });

  it('shows the storage message when saving category limits fails', async () => {
    saveCategorySelectionRules.mockRejectedValueOnce(new Error('Não foi possível salvar os limites da categoria. Recarregue a tela e tente novamente.'));
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.saveCategoryRule({ id: 'cat-carnes', name: 'Carnes' }, { maxSelections: 2 });
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

    expect(result.current.categories).toEqual([
      { id: 'cat-saladas', name: 'Saladas' },
      { id: 'cat-carnes', name: 'Carnes' },
    ]);
    expect(saveCategories).not.toHaveBeenCalled();
    expect(screen.getByText('Outro dispositivo esta editando o cardapio neste momento.')).toBeInTheDocument();
  });

  it('removes a category along with its items, day selection and linked rules', async () => {
    subscribeCategorySelectionRules.mockImplementation((onValue: (value: unknown[]) => void) => {
      queueMicrotask(() => onValue([{ category: 'Saladas', maxSelections: 1 }]));
      return vi.fn();
    });

    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.removeCategory('cat-saladas');
      await Promise.resolve();
    });

    expect(result.current.categories).toEqual([{ id: 'cat-carnes', name: 'Carnes' }]);
    expect(result.current.complements).toEqual([{ id: '2', nome: 'Frango', categoria: 'cat-carnes' }]);
    expect(result.current.daySelection).toEqual([]);
    expect(saveCategories).toHaveBeenCalledWith([{ id: 'cat-carnes', name: 'Carnes' }]);
    expect(saveComplements).toHaveBeenCalledWith([{ id: '2', nome: 'Frango', categoria: 'cat-carnes' }]);
    expect(saveDaySelection).toHaveBeenCalledWith(expect.any(String), []);
    expect(saveCategorySelectionRules).toHaveBeenCalledWith([], [{ id: 'cat-carnes', name: 'Carnes' }]);
  });

  it('moves categories up and down but ignores invalid moves', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.moveCategory('cat-carnes', 'up');
      await Promise.resolve();
    });
    expect(saveCategories).toHaveBeenCalledWith([
      { id: 'cat-carnes', name: 'Carnes' },
      { id: 'cat-saladas', name: 'Saladas' },
    ]);

    saveCategories.mockClear();

    await act(async () => {
      result.current.moveCategory('cat-carnes', 'up');
      result.current.moveCategory('inexistente', 'down');
      await Promise.resolve();
    });
    expect(saveCategories).not.toHaveBeenCalled();
  });

  it('tracks pending writes and persisted revisions after successful saves', async () => {
    let resolveWrite: (() => void) | null = null;
    saveDaySelection.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveWrite = resolve;
    }));

    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    act(() => {
      result.current.toggleItem('2');
    });

    expect(result.current.pendingWrites).toBe(1);
    expect(result.current.dataRevision).toBe(1);
    expect(result.current.persistedRevision).toBe(0);

    await act(async () => {
      resolveWrite?.();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.pendingWrites).toBe(0));
    expect(result.current.persistedRevision).toBe(1);
  });

  it('keeps the current revision unpersisted when a save fails', async () => {
    saveDaySelection.mockRejectedValueOnce(new Error('Falha ao salvar'));

    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.toggleItem('2');
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.pendingWrites).toBe(0));
    expect(result.current.persistedRevision).toBe(0);
    expect(screen.getByText('Falha ao salvar')).toBeInTheDocument();
  });

  it('surfaces recent selection load errors', async () => {
    subscribeCategories.mockImplementation((onValue: (value: unknown[]) => void) => {
      queueMicrotask(() => onValue([]));
      return vi.fn();
    });
    loadRecentSelections.mockRejectedValueOnce(new Error('Falha em histórico'));

    const { result } = renderHook(() => useMenuState(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.categories).toEqual([]);
    expect(screen.getByText('Não foi possível carregar os dados do admin.')).toBeInTheDocument();
  });

  it('updateCategoryExcludeFromShare sets flag on existing rule', async () => {
    subscribeCategorySelectionRules.mockImplementation((onValue: (value: unknown[]) => void) => {
      queueMicrotask(() => onValue([{ category: 'Saladas', maxSelections: 2 }]));
      return vi.fn();
    });

    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.updateCategoryExcludeFromShare('Saladas', true);
    });

    expect(result.current.categorySelectionRules.find(r => r.category === 'Saladas')?.excludeFromShare).toBe(true);
    expect(saveCategoryExcludeFromShare).toHaveBeenCalledWith('cat-saladas', true);
  });

  it('updateCategoryExcludeFromShare creates a new rule when none exists', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.updateCategoryExcludeFromShare('Saladas', true);
    });

    expect(result.current.categorySelectionRules.find(r => r.category === 'Saladas')?.excludeFromShare).toBe(true);
    expect(saveCategoryExcludeFromShare).toHaveBeenCalledWith('cat-saladas', true);
  });

  it('renames a category and updates its selection rules', async () => {
    subscribeCategorySelectionRules.mockImplementation((onValue: (value: unknown[]) => void) => {
      queueMicrotask(() => onValue([{ category: 'Saladas', maxSelections: 2 }]));
      return vi.fn();
    });

    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.renameCategory('cat-saladas', 'Saladas Mix');
    });

    expect(result.current.categories).toEqual([
      { id: 'cat-saladas', name: 'Saladas Mix' },
      { id: 'cat-carnes', name: 'Carnes' },
    ]);
    expect(saveCategories).toHaveBeenCalledWith([
      { id: 'cat-saladas', name: 'Saladas Mix' },
      { id: 'cat-carnes', name: 'Carnes' },
    ]);
    expect(saveCategorySelectionRules).toHaveBeenCalledWith(
      [{ category: 'Saladas Mix', maxSelections: 2 }],
      [{ id: 'cat-saladas', name: 'Saladas Mix' }, { id: 'cat-carnes', name: 'Carnes' }],
    );
  });

  it('ignores renameCategory when new name is blank', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.renameCategory('cat-saladas', '   ');
    });

    expect(saveCategories).not.toHaveBeenCalled();
  });

  it('ignores renameCategory when name already taken by another category', async () => {
    const { result } = renderHook(() => useMenuState(), { wrapper });
    await waitForReady(result);

    await act(async () => {
      result.current.renameCategory('cat-saladas', 'Carnes');
    });

    expect(saveCategories).not.toHaveBeenCalled();
    expect(screen.getByText('Já existe uma categoria com este nome.')).toBeInTheDocument();
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
