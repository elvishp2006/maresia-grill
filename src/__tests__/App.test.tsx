import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { ModalProvider } from '../contexts/ModalContext';

vi.mock('../hooks/useUpdateNotification', () => ({
  useUpdateNotification: vi.fn(),
}));

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
    toggleItem: vi.fn(),
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
    expect(screen.queryByText('Alface')).not.toBeInTheDocument();
    expect(screen.queryByText('Frango')).not.toBeInTheDocument();
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
    expect(screen.queryByText('Alface')).not.toBeInTheDocument();
    expect(screen.getByText('Frango')).toBeInTheDocument();
  });
});
