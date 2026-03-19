import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MenuView from '../MenuView';

const lightTapMock = vi.fn();
const successMock = vi.fn();

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    lightTap: lightTapMock,
    success: successMock,
  }),
}));

vi.mock('../components/CategoryCard', () => ({
  default: ({
    categoria,
    onMoveUp,
    onMoveDown,
    onRemoveCategory,
    onSaveCategoryRule,
    onToggleCollapse,
    isOnline,
    viewMode,
  }: {
    categoria: string;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onRemoveCategory: () => void;
    onSaveCategoryRule: (input: unknown) => void;
    onToggleCollapse: () => void;
    isOnline: boolean;
    viewMode: string;
  }) => (
    <div data-testid={`category-card-${categoria}`}>
      <span>{categoria}</span>
      <span>{viewMode}</span>
      <span>{isOnline ? 'online' : 'offline'}</span>
      <button onClick={onMoveUp}>up-{categoria}</button>
      <button onClick={onMoveDown}>down-{categoria}</button>
      <button onClick={onRemoveCategory}>remove-{categoria}</button>
      <button onClick={() => onSaveCategoryRule({ maxSelections: 2 })}>rule-{categoria}</button>
      <button onClick={onToggleCollapse}>collapse-{categoria}</button>
    </div>
  ),
}));

vi.mock('../components/BottomSheet', () => ({
  default: ({
    open,
    title,
    description,
    children,
  }: {
    open: boolean;
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => open ? (
    <div data-testid={`sheet-${title}`}>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ) : null,
}));

vi.mock('../components/AddForm', () => ({
  default: ({
    onAdd,
    onClose,
    initialValue,
    disabled,
    disabledMessage,
    placeholder,
  }: {
    onAdd: (name: string) => void;
    onClose: () => void;
    initialValue?: string;
    disabled?: boolean;
    disabledMessage?: string;
    placeholder?: string;
  }) => (
    <div data-testid={`add-form-${placeholder ?? initialValue ?? 'default'}`}>
      <span>{initialValue ?? ''}</span>
      <span>{disabled ? 'disabled' : 'enabled'}</span>
      {disabledMessage ? <span>{disabledMessage}</span> : null}
      <button onClick={() => onAdd((initialValue ?? 'Novo item').trim() || 'Novo item')}>confirm-add</button>
      <button onClick={onClose}>close-form</button>
    </div>
  ),
}));

vi.mock('../components/InsightsPanel', () => ({
  default: ({ onSelectSuggestion }: { onSelectSuggestion: (id: string) => void }) => (
    <div data-testid="insights-panel">
      <button onClick={() => onSelectSuggestion('item-1')}>select-suggestion</button>
    </div>
  ),
}));

const baseProps = {
  viewMode: 'menu' as const,
  visibleCategories: ['Saladas', 'Carnes'],
  categories: ['Saladas', 'Carnes'],
  complements: [
    { id: '1', nome: 'Alface', categoria: 'Saladas' },
    { id: '2', nome: 'Frango', categoria: 'Carnes' },
  ],
  categorySelectionRules: [],
  daySelection: ['1'],
  usageCounts: {},
  sortMode: 'alpha' as const,
  search: '',
  expandedCategory: 'Saladas',
  onToggleCollapse: vi.fn(),
  isOnline: true,
  canEdit: true,
  insights: {
    loading: false,
    error: null,
    trackedDays: 7,
    weekdayLabel: 'Seg',
    topItems: [],
    weekdayAverages: [],
    categoryLeaders: [],
    streakItems: [],
    neglectedItems: [],
    suggestedItems: [],
  },
  onToggle: vi.fn(),
  onAddItem: vi.fn(),
  onRemoveItem: vi.fn(),
  onUpdateItem: vi.fn(),
  onMoveCategory: vi.fn(),
  onRemoveCategory: vi.fn(),
  onAddCategory: vi.fn(),
  onSaveCategoryRule: vi.fn(),
  onClearSearch: vi.fn(),
  onShare: vi.fn(),
};

describe('MenuView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the offline stats empty state', () => {
    render(<MenuView {...baseProps} viewMode="stats" isOnline={false} />);

    expect(screen.getByText('Estatísticas indisponíveis')).toBeInTheDocument();
    expect(screen.queryByTestId('insights-panel')).not.toBeInTheDocument();
  });

  it('renders the insights panel online and selects a suggestion', () => {
    render(<MenuView {...baseProps} viewMode="stats" />);

    fireEvent.click(screen.getByRole('button', { name: 'select-suggestion' }));

    expect(screen.getByTestId('insights-panel')).toBeInTheDocument();
    expect(baseProps.onToggle).toHaveBeenCalledWith('item-1');
  });

  it('renders the generic empty state when there is no search term', () => {
    render(
      <MenuView
        {...baseProps}
        visibleCategories={[]}
        search="   "
      />,
    );

    expect(screen.getByText('Nada encontrado')).toBeInTheDocument();
    expect(screen.getByText('Ajuste a busca para encontrar itens.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Cadastrar/i })).not.toBeInTheDocument();
  });

  it('opens the quick-add flow from the empty search state and adds an item after choosing a category', () => {
    render(
      <MenuView
        {...baseProps}
        visibleCategories={[]}
        search="Molho"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Cadastrar "Molho" no catálogo' }));
    expect(lightTapMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sheet-Em qual categoria?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Saladas' }));
    expect(screen.getByTestId('sheet-Novo item em Saladas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'confirm-add' }));

    expect(baseProps.onAddItem).toHaveBeenCalledWith('Molho', 'Saladas');
    expect(baseProps.onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('closes the quick-add item form and resets the chosen category', () => {
    render(
      <MenuView
        {...baseProps}
        visibleCategories={[]}
        search="Molho"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '+ Cadastrar "Molho" no catálogo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saladas' }));
    expect(screen.getByTestId('sheet-Novo item em Saladas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'close-form' }));

    expect(screen.queryByTestId('sheet-Em qual categoria?')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sheet-Novo item em Saladas')).not.toBeInTheDocument();
  });

  it('renders search empty state without quick-add when editing is unavailable', () => {
    render(
      <MenuView
        {...baseProps}
        visibleCategories={[]}
        search="Molho"
        canEdit={false}
      />,
    );

    expect(screen.getByText('Nenhum resultado para "Molho".')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Cadastrar "Molho" no catálogo' })).not.toBeInTheDocument();
  });

  it('opens the new category sheet in manage mode and submits the category', () => {
    render(<MenuView {...baseProps} viewMode="manage" daySelection={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '+ Nova categoria' }));
    expect(lightTapMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sheet-Nova categoria')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'confirm-add' }));

    expect(baseProps.onAddCategory).toHaveBeenCalledWith('Novo item');
  });

  it('renders the disabled new category form when editing is unavailable in manage mode', () => {
    render(<MenuView {...baseProps} viewMode="manage" canEdit={false} daySelection={[]} />);

    expect(screen.getByRole('button', { name: '+ Nova categoria' })).toBeDisabled();
  });

  it('passes category actions through to the rendered category cards in manage mode', () => {
    render(<MenuView {...baseProps} viewMode="manage" daySelection={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'up-Saladas' }));
    fireEvent.click(screen.getByRole('button', { name: 'down-Carnes' }));
    fireEvent.click(screen.getByRole('button', { name: 'remove-Saladas' }));
    fireEvent.click(screen.getByRole('button', { name: 'rule-Carnes' }));
    fireEvent.click(screen.getByRole('button', { name: 'collapse-Carnes' }));

    expect(baseProps.onMoveCategory).toHaveBeenCalledWith('Saladas', 'up');
    expect(baseProps.onMoveCategory).toHaveBeenCalledWith('Carnes', 'down');
    expect(baseProps.onRemoveCategory).toHaveBeenCalledWith('Saladas');
    expect(baseProps.onSaveCategoryRule).toHaveBeenCalledWith('Carnes', { maxSelections: 2 });
    expect(baseProps.onToggleCollapse).toHaveBeenCalledWith('Carnes');
  });

  it('shares the menu only when there are selected items in menu mode', () => {
    const { rerender } = render(<MenuView {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar menu' }));
    expect(successMock).toHaveBeenCalledTimes(1);
    expect(baseProps.onShare).toHaveBeenCalledTimes(1);

    rerender(<MenuView {...baseProps} daySelection={[]} />);
    expect(screen.queryByRole('button', { name: 'Compartilhar menu' })).not.toBeInTheDocument();
  });
});
