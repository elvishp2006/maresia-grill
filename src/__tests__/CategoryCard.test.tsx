import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryCard from '../components/CategoryCard';
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

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CategoryCard', () => {
  it('renders category title', () => {
    render(<CategoryCard {...defaultProps} />);
    expect(screen.getByText('Saladas')).toBeInTheDocument();
  });

  it('shows count badge with selected/total', () => {
    render(<CategoryCard {...defaultProps} daySelection={['1']} />);
    expect(screen.getByText('(1/3)')).toBeInTheDocument();
  });

  it('sorts items alphabetically by default', () => {
    render(<CategoryCard {...defaultProps} />);
    const names = screen.getAllByRole('listitem').map(el => el.textContent);
    expect(names[0]).toContain('Alface');
    expect(names[1]).toContain('Beterraba');
    expect(names[2]).toContain('Zanahoria');
  });

  it('places active items first', () => {
    render(<CategoryCard {...defaultProps} daySelection={['3']} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0].textContent).toContain('Beterraba');
  });

  it('filters items by search', () => {
    render(<CategoryCard {...defaultProps} search="alface" />);
    expect(screen.getByText('Alface')).toBeInTheDocument();
    expect(screen.queryByText('Zanahoria')).not.toBeInTheDocument();
    expect(screen.queryByText('Beterraba')).not.toBeInTheDocument();
  });

  it('collapses and hides items when title is clicked', () => {
    render(<CategoryCard {...defaultProps} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('sorts by usage when sortMode is usage', () => {
    const usageCounts = { '3': 5, '1': 2, '2': 1 };
    render(<CategoryCard {...defaultProps} sortMode="usage" usageCounts={usageCounts} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0].textContent).toContain('Beterraba');
    expect(listItems[1].textContent).toContain('Zanahoria');
    expect(listItems[2].textContent).toContain('Alface');
  });

  it('disables ↑ button when isFirst', () => {
    render(<CategoryCard {...defaultProps} isFirst={true} />);
    expect(screen.getByLabelText('Mover Saladas para cima')).toBeDisabled();
  });

  it('disables ↓ button when isLast', () => {
    render(<CategoryCard {...defaultProps} isLast={true} />);
    expect(screen.getByLabelText('Mover Saladas para baixo')).toBeDisabled();
  });

  it('calls onRemoveCategory after confirmation when category has items', () => {
    const onRemoveCategory = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CategoryCard {...defaultProps} onRemoveCategory={onRemoveCategory} />);
    fireEvent.click(screen.getByLabelText('Remover categoria Saladas'));
    expect(window.confirm).toHaveBeenCalledWith(
      'Remover categoria "Saladas" e todos os seus 3 itens?'
    );
    expect(onRemoveCategory).toHaveBeenCalledTimes(1);
  });

  it('does not call onRemoveCategory when confirmation is cancelled', () => {
    const onRemoveCategory = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CategoryCard {...defaultProps} onRemoveCategory={onRemoveCategory} />);
    fireEvent.click(screen.getByLabelText('Remover categoria Saladas'));
    expect(onRemoveCategory).not.toHaveBeenCalled();
  });

  it('shows simpler confirm message for empty categories', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CategoryCard {...defaultProps} items={[]} />);
    fireEvent.click(screen.getByLabelText('Remover categoria Saladas'));
    expect(window.confirm).toHaveBeenCalledWith('Remover categoria "Saladas"?');
  });
});
