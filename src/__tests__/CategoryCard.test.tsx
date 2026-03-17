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
  viewMode: 'select' as const,
  expanded: true,
  onToggleCollapse: vi.fn(),
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(<ModalProvider>{ui}</ModalProvider>);

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CategoryCard', () => {
  it('renders category title and count copy', () => {
    renderWithProviders(<CategoryCard {...defaultProps} daySelection={['1']} />);
    expect(screen.getByText('Saladas')).toBeInTheDocument();
    expect(screen.getByText('1/3 itens')).toBeInTheDocument();
  });

  it('keeps the title truncatable in narrow layouts', () => {
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        categoria="Categoria com um nome extremamente longo para telas pequenas"
      />
    );

    const title = screen.getByRole('heading', {
      name: 'Categoria com um nome extremamente longo para telas pequenas',
    });

    expect(title.className).toContain('overflow-hidden');
    expect(title.className).toContain('text-ellipsis');
    expect(title.className).toContain('whitespace-nowrap');
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

  it('filters items without diacritics matching accented names', () => {
    const accentedItems = [{ id: '4', nome: 'Açaí', categoria: 'Saladas' }, ...items];
    renderWithProviders(<CategoryCard {...defaultProps} items={accentedItems} search="acai" />);
    expect(screen.getByText('Açaí')).toBeInTheDocument();
    expect(screen.queryByText('Alface')).not.toBeInTheDocument();
  });

  it('calls onToggleCollapse when header is clicked', () => {
    const onToggleCollapse = vi.fn();
    renderWithProviders(<CategoryCard {...defaultProps} onToggleCollapse={onToggleCollapse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Colapsar Saladas' }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('hides list when collapsed', () => {
    renderWithProviders(<CategoryCard {...defaultProps} expanded={false} />);
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

  it('renders management actions in manage mode', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);
    expect(screen.getByLabelText('Mover Saladas para cima')).toBeInTheDocument();
    expect(screen.getByLabelText('Adicionar item em Saladas')).toBeInTheDocument();
    expect(screen.getByLabelText('Remover categoria Saladas')).toBeInTheDocument();
  });

  it('calls onRemoveCategory after confirmation', async () => {
    const onRemoveCategory = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        onRemoveCategory={onRemoveCategory}
      />
    );
    fireEvent.click(screen.getByLabelText('Remover categoria Saladas'));
    await act(async () => {
      fireEvent.click(await screen.findByText('Confirmar'));
    });
    expect(onRemoveCategory).toHaveBeenCalledTimes(1);
  });

  it('opens the add item sheet in manage mode', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);
    fireEvent.click(screen.getByLabelText('Adicionar item em Saladas'));
    expect(screen.getByRole('dialog', { name: 'Novo item em Saladas' })).toBeInTheDocument();
  });

  it('disables management actions when offline', () => {
    const onMoveUp = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        isOnline={false}
        onMoveUp={onMoveUp}
      />
    );

    const addButton = screen.getByLabelText('Adicionar item em Saladas');
    const moveUpButton = screen.getByLabelText('Mover Saladas para cima');

    expect(addButton).toBeDisabled();
    expect(moveUpButton).toBeDisabled();

    fireEvent.click(addButton);
    fireEvent.click(moveUpButton);

    expect(screen.queryByRole('dialog', { name: 'Novo item em Saladas' })).not.toBeInTheDocument();
    expect(onMoveUp).not.toHaveBeenCalled();
  });
});
