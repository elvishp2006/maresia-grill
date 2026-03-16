import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { ModalProvider } from '../contexts/ModalContext';

vi.mock('../hooks/useUpdateNotification', () => ({
  useUpdateNotification: vi.fn(),
}));

vi.mock('../hooks/useMenuInsights', () => ({
  useMenuInsights: vi.fn(() => ({
    loading: false,
    error: null,
    trackedDays: 8,
    weekdayLabel: 'Seg',
    topItems: [{ id: '1', nome: 'Alface', categoria: 'Saladas', count: 4 }],
    weekdayAverages: [{ weekday: 1, label: 'Seg', average: 3, sampleSize: 2 }],
    categoryLeaders: [{ id: '1', nome: 'Alface', categoria: 'Saladas', count: 4 }],
    streakItems: [{ id: '1', nome: 'Alface', categoria: 'Saladas', count: 4, streak: 2 }],
    neglectedItems: [{ id: '2', nome: 'Frango', categoria: 'Carnes', count: 0, lastSeen: null }],
    suggestedItems: [{ id: '2', nome: 'Frango', categoria: 'Carnes', score: 8, reason: 'Usado recentemente', totalCount: 2, weekdayCount: 1 }],
  })),
}));

const toggleItem = vi.fn();

vi.mock('../hooks/useMenuState', () => ({
  useMenuState: vi.fn(() => ({
    categories: ['Saladas', 'Carnes'],
    complements: [
      { id: '1', nome: 'Alface', categoria: 'Saladas' },
      { id: '2', nome: 'Frango', categoria: 'Carnes' },
    ],
    daySelection: ['1'],
    usageCounts: {},
    sortMode: 'alpha',
    loading: false,
    toggleSortMode: vi.fn(),
    toggleItem,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    renameItem: vi.fn(),
    addCategory: vi.fn(),
    removeCategory: vi.fn(),
    moveCategory: vi.fn(),
  })),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toggleItem.mockReset();
    vi.stubGlobal('alert', vi.fn());
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it('opens the first visible category by default', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    expect(screen.getByRole('button', { name: 'Colapsar Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Carnes' })).toBeInTheDocument();
    expect(screen.queryByText('Sugestoes inteligentes')).not.toBeInTheDocument();
  });

  it('allows collapsing the currently open category', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Colapsar Saladas' }));

    expect(screen.getByRole('button', { name: 'Expandir Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expandir Carnes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Alface do menu do dia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar Frango do menu do dia' })).not.toBeInTheDocument();
  });

  it('opens only the category that was explicitly selected', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Expandir Carnes' }));

    expect(screen.getByRole('button', { name: 'Expandir Saladas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Colapsar Carnes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover Alface do menu do dia' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar Frango do menu do dia' })).toBeInTheDocument();
  });

  it('renders suggestions and selects an item from insights', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Estatisticas' }));
    expect(screen.getByText('Sugestoes inteligentes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar' }));
    expect(toggleItem).toHaveBeenCalledWith('2');
  });

  it('hides toolbar and categories in statistics area', () => {
    render(
      <ModalProvider>
        <App />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Estatisticas' }));

    expect(screen.queryByPlaceholderText('Buscar item para o menu de hoje')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Colapsar Saladas' })).not.toBeInTheDocument();
    expect(screen.getByText('Leitura do cardapio')).toBeInTheDocument();
  });
});
