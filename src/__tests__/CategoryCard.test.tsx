import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CategoryCard from '../components/CategoryCard';
import { ModalProvider } from '../contexts/ModalContext';
import type { Item } from '../types';

const items: Item[] = [
  { id: '1', nome: 'Zanahoria', categoria: 'Saladas' },
  { id: '2', nome: 'Alface', categoria: 'Saladas' },
  { id: '3', nome: 'Beterraba', categoria: 'Saladas' },
];

const defaultProps = {
  categoria: 'Saladas',
  items,
  daySelection: [],
  onToggle: vi.fn(),
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onRename: vi.fn(),
  onRemoveCategory: vi.fn(),
  search: '',
  sortMode: 'alpha' as const,
  usageCounts: {},
  isFirst: false,
  isLast: false,
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ModalProvider>{ui}</ModalProvider>);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CategoryCard', () => {
  it('renders category title', () => {
    renderWithProviders(<CategoryCard {...defaultProps} />);
    expect(screen.getByText('Saladas')).toBeInTheDocument();
  });

  it('shows count badge with selected/total', () => {
    renderWithProviders(<CategoryCard {...defaultProps} daySelection={['1']} />);
    expect(screen.getByText('(1/3)')).toBeInTheDocument();
  });

  it('sorts items alphabetically by default', () => {
    renderWithProviders(<CategoryCard {...defaultProps} />);
    const names = screen.getAllByRole('listitem').map(el => el.textContent);
    expect(names[0]).toContain('Alface');
    expect(names[1]).toContain('Beterraba');
    expect(names[2]).toContain('Zanahoria');
  });

  it('places active items first', () => {
    renderWithProviders(<CategoryCard {...defaultProps} daySelection={['3']} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0].textContent).toContain('Beterraba');
  });

  it('filters items by search', () => {
    renderWithProviders(<CategoryCard {...defaultProps} search="alface" />);
    expect(screen.getByText('Alface')).toBeInTheDocument();
    expect(screen.queryByText('Zanahoria')).not.toBeInTheDocument();
    expect(screen.queryByText('Beterraba')).not.toBeInTheDocument();
  });

  it('collapses and hides items when title is clicked', () => {
    renderWithProviders(<CategoryCard {...defaultProps} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('sorts by usage when sortMode is usage', () => {
    const usageCounts = { '3': 5, '1': 2, '2': 1 };
    renderWithProviders(<CategoryCard {...defaultProps} sortMode="usage" usageCounts={usageCounts} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0].textContent).toContain('Beterraba');
    expect(listItems[1].textContent).toContain('Zanahoria');
    expect(listItems[2].textContent).toContain('Alface');
  });

  it('disables ↑ button when isFirst', () => {
    renderWithProviders(<CategoryCard {...defaultProps} isFirst={true} />);
    expect(screen.getByLabelText('Mover Saladas para cima')).toBeDisabled();
  });

  it('disables ↓ button when isLast', () => {
    renderWithProviders(<CategoryCard {...defaultProps} isLast={true} />);
    expect(screen.getByLabelText('Mover Saladas para baixo')).toBeDisabled();
  });

  it('calls onRemoveCategory after confirmation', async () => {
    const onRemoveCategory = vi.fn();
    renderWithProviders(<CategoryCard {...defaultProps} onRemoveCategory={onRemoveCategory} />);
    fireEvent.click(screen.getByLabelText('Remover categoria Saladas'));
    await act(async () => {
      fireEvent.click(await screen.findByText('Confirmar'));
    });
    expect(onRemoveCategory).toHaveBeenCalledTimes(1);
  });

  it('does not call onRemoveCategory when confirmation is cancelled', async () => {
    const onRemoveCategory = vi.fn();
    renderWithProviders(<CategoryCard {...defaultProps} onRemoveCategory={onRemoveCategory} />);
    fireEvent.click(screen.getByLabelText('Remover categoria Saladas'));
    await act(async () => {
      fireEvent.click(await screen.findByText('Cancelar'));
    });
    expect(onRemoveCategory).not.toHaveBeenCalled();
  });

  it('shows modal when remove category is clicked', async () => {
    renderWithProviders(<CategoryCard {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Remover categoria Saladas'));
    expect(await screen.findByText('Remover "Saladas"')).toBeInTheDocument();
  });
});
