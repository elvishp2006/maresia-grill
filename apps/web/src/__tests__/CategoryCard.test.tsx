import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CategoryCard from '../components/CategoryCard';
import { ModalProvider } from '../contexts/ModalContext';
import type { CategoryEntry, Item } from '../types';

const items: Item[] = [
  { id: '1', nome: 'Zanahoria', categoria: 'cat-saladas' },
  { id: '2', nome: 'Alface', categoria: 'cat-saladas' },
  { id: '3', nome: 'Beterraba', categoria: 'cat-saladas' },
];

const defaultProps = {
  categoria: { id: 'cat-saladas', name: 'Saladas' } as CategoryEntry,
  items,
  allCategories: [
    { id: 'cat-saladas', name: 'Saladas' },
    { id: 'cat-carnes', name: 'Carnes' },
    { id: 'cat-churrasco', name: 'Churrasco' },
  ] as CategoryEntry[],
  daySelection: [],
  onToggle: vi.fn(),
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onRename: vi.fn(),
  onRenameCategory: vi.fn(),
  onRemoveCategory: vi.fn(),
  onSaveCategoryRule: vi.fn(),
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
        categoria={{ id: 'cat-long', name: 'Categoria com um nome extremamente longo para telas pequenas' }}
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
    const accentedItems = [{ id: '4', nome: 'Açaí', categoria: 'cat-saladas' }, ...items];
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
    expect(screen.getByRole('button', { name: 'Configurar limite' })).toBeInTheDocument();
    expect(screen.getByLabelText('Adicionar item em Saladas')).toBeInTheDocument();
    expect(screen.getByLabelText('Remover categoria Saladas')).toBeInTheDocument();
  });

  it('calls move callbacks in manage mode', () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();

    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />,
    );

    fireEvent.click(screen.getByLabelText('Mover Saladas para cima'));
    fireEvent.click(screen.getByLabelText('Mover Saladas para baixo'));

    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('opens the limit configuration sheet in manage mode', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    expect(screen.getByRole('dialog', { name: 'Limite de Saladas' })).toBeInTheDocument();
    expect(screen.getByText('Compartilhar com outras categorias')).toBeInTheDocument();
  });

  it('saves the configured limit, linked categories and repeated items flag', () => {
    const onSaveCategoryRule = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        onSaveCategoryRule={onSaveCategoryRule}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getAllByRole('button', { name: '1' })[1]);
    fireEvent.click(screen.getByRole('switch', { name: 'Permitir repetir itens em Saladas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Carnes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limite' }));

    expect(onSaveCategoryRule).toHaveBeenCalledWith({
      minSelections: null,
      maxSelections: 1,
      sharedLimitGroupId: null,
      linkedCategories: ['Carnes'],
      allowRepeatedItems: true,
    });
  });

  it('adjusts the configured limit with increment and decrement controls', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar limite de Saladas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir limite de Saladas' }));

    expect(screen.getByRole('button', { name: 'Diminuir limite de Saladas' })).toBeDisabled();
  });

  it('keeps the shared limit group id when saving an existing rule', () => {
    const onSaveCategoryRule = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        categoryRule={{ category: 'Saladas', maxSelections: 2, sharedLimitGroupId: 'proteinas' }}
        allCategoryRules={[
          { category: 'Saladas', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
          { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
        ]}
        onSaveCategoryRule={onSaveCategoryRule}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limite' }));

    expect(onSaveCategoryRule).toHaveBeenCalledWith({
      minSelections: null,
      maxSelections: 2,
      sharedLimitGroupId: 'proteinas',
      linkedCategories: ['Carnes'],
      allowRepeatedItems: undefined,
    });
  });

  it('clears the category rule from the manage sheet', () => {
    const onSaveCategoryRule = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        categoryRule={{ category: 'Saladas', maxSelections: 2, sharedLimitGroupId: 'grupo' }}
        allCategoryRules={[
          { category: 'Saladas', maxSelections: 2, sharedLimitGroupId: 'grupo' },
          { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'grupo' },
        ]}
        onSaveCategoryRule={onSaveCategoryRule}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar regra' }));

    expect(onSaveCategoryRule).toHaveBeenCalledWith({
      minSelections: null,
      maxSelections: null,
      sharedLimitGroupId: null,
      linkedCategories: [],
      allowRepeatedItems: false,
    });
  });

  it('disables save limit when there is no limit and repeated items are off', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sem limite' }));

    expect(screen.getByRole('button', { name: 'Salvar limite' })).toBeDisabled();
  });

  it('renders the minimum quantity section in the rule sheet', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    expect(screen.getByText('Quantidade mínima')).toBeInTheDocument();
  });

  it('saves minSelections when a minimum is set', () => {
    const onSaveCategoryRule = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        onSaveCategoryRule={onSaveCategoryRule}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getAllByRole('button', { name: '1' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: '1' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limite' }));

    expect(onSaveCategoryRule).toHaveBeenCalledWith(
      expect.objectContaining({ minSelections: 1, maxSelections: 1 }),
    );
  });

  it('enables save limit when only a minimum is set', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar minimo de Saladas' }));

    expect(screen.getByRole('button', { name: 'Salvar limite' })).not.toBeDisabled();
  });

  it('clears minSelections along with maxSelections when clearing the rule', () => {
    const onSaveCategoryRule = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        categoryRule={{ category: 'Saladas', minSelections: 1, maxSelections: 2 }}
        onSaveCategoryRule={onSaveCategoryRule}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Configurar limite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar regra' }));

    expect(onSaveCategoryRule).toHaveBeenCalledWith(
      expect.objectContaining({ minSelections: null, maxSelections: null }),
    );
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

  it('adds an item from the manage sheet and closes it', () => {
    const onAdd = vi.fn();
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        onAdd={onAdd}
      />,
    );

    fireEvent.click(screen.getByLabelText('Adicionar item em Saladas'));
    fireEvent.change(screen.getByPlaceholderText('Nome do item'), {
      target: { value: 'Tomate' },
    });
    fireEvent.change(screen.getByPlaceholderText('0,00'), {
      target: { value: '450' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(onAdd).toHaveBeenCalledWith('Tomate', 'cat-saladas', 450);
    expect(screen.queryByRole('dialog', { name: 'Novo item em Saladas' })).not.toBeInTheDocument();
  });

  it('shows repeated-items copy when the category allows repetition without a limit', () => {
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        viewMode="manage"
        categoryRule={{ category: 'Saladas', maxSelections: null, sharedLimitGroupId: null, allowRepeatedItems: true }}
      />,
    );

    expect(screen.getByText('Sem limite e permite repetir item')).toBeInTheDocument();
    expect(screen.getByText('Sem limite de seleção e com repetição do mesmo item liberada.')).toBeInTheDocument();
  });

  it('shows the selection rule summary in select mode', () => {
    renderWithProviders(
      <CategoryCard
        {...defaultProps}
        categoryRule={{ category: 'Saladas', maxSelections: 1, sharedLimitGroupId: null }}
        allCategoryRules={[{ category: 'Saladas', maxSelections: 1, sharedLimitGroupId: null }]}
      />,
    );

    expect(screen.getByText('Escolha até 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configurar limite' })).not.toBeInTheDocument();
  });

  it('shows a rename button in manage mode', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);
    expect(screen.getByLabelText('Renomear Saladas')).toBeInTheDocument();
  });

  it('activates the rename input when the rename button is clicked', () => {
    renderWithProviders(<CategoryCard {...defaultProps} viewMode="manage" />);
    fireEvent.click(screen.getByLabelText('Renomear Saladas'));
    expect(screen.getByLabelText('Nome da categoria')).toBeInTheDocument();
    expect(screen.queryByLabelText('Renomear Saladas')).not.toBeInTheDocument();
  });

  it('calls onRenameCategory with the new name on Enter', () => {
    const onRenameCategory = vi.fn();
    renderWithProviders(
      <CategoryCard {...defaultProps} viewMode="manage" onRenameCategory={onRenameCategory} />,
    );
    fireEvent.click(screen.getByLabelText('Renomear Saladas'));
    const input = screen.getByLabelText('Nome da categoria');
    fireEvent.change(input, { target: { value: 'Saladas Mix' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameCategory).toHaveBeenCalledWith('cat-saladas', 'Saladas Mix');
    expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument();
  });

  it('cancels rename on Escape without calling onRenameCategory', () => {
    const onRenameCategory = vi.fn();
    renderWithProviders(
      <CategoryCard {...defaultProps} viewMode="manage" onRenameCategory={onRenameCategory} />,
    );
    fireEvent.click(screen.getByLabelText('Renomear Saladas'));
    const input = screen.getByLabelText('Nome da categoria');
    fireEvent.change(input, { target: { value: 'Outro nome' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRenameCategory).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument();
  });

  it('calls onRenameCategory on blur', () => {
    const onRenameCategory = vi.fn();
    renderWithProviders(
      <CategoryCard {...defaultProps} viewMode="manage" onRenameCategory={onRenameCategory} />,
    );
    fireEvent.click(screen.getByLabelText('Renomear Saladas'));
    const input = screen.getByLabelText('Nome da categoria');
    fireEvent.change(input, { target: { value: 'Saladas Premium' } });
    fireEvent.blur(input);
    expect(onRenameCategory).toHaveBeenCalledWith('cat-saladas', 'Saladas Premium');
  });

  it('disables the rename button when offline', () => {
    renderWithProviders(
      <CategoryCard {...defaultProps} viewMode="manage" isOnline={false} />,
    );
    expect(screen.getByLabelText('Renomear Saladas')).toBeDisabled();
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
