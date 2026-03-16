import { useMemo, useState } from 'react';
import type { Categoria, Item } from '../types';
import ItemRow from './ItemRow';
import AddForm from './AddForm';
import BottomSheet from './BottomSheet';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useModal } from '../contexts/ModalContext';

interface CategoryCardProps {
  categoria: Categoria;
  items: Item[];
  daySelection: string[];
  onToggle: (id: string) => void;
  onAdd: (nome: string, categoria: Categoria) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, newNome: string) => void;
  search: string;
  sortMode: 'alpha' | 'usage';
  usageCounts: Record<string, number>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemoveCategory: () => void;
  isFirst: boolean;
  isLast: boolean;
  viewMode: 'select' | 'manage';
  expanded: boolean;
  onToggleCollapse: () => void;
}

const INITIAL_VISIBLE_ITEMS = 8;

export default function CategoryCard({
  categoria,
  items,
  daySelection,
  onToggle,
  onAdd,
  onRemove,
  onRename,
  search,
  sortMode,
  usageCounts,
  onMoveUp,
  onMoveDown,
  onRemoveCategory,
  isFirst,
  isLast,
  viewMode,
  expanded,
  onToggleCollapse,
}: CategoryCardProps) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const normalized = search.trim().toLowerCase();
    return items.filter(item => item.nome.toLowerCase().includes(normalized));
  }, [items, search]);

  const sortedItems = useMemo(() => {
    const sortByMode = (a: Item, b: Item) => {
      if (sortMode === 'usage') {
        const diff = (usageCounts[b.id] ?? 0) - (usageCounts[a.id] ?? 0);
        if (diff !== 0) return diff;
      }
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    };

    const activeItems = filteredItems
      .filter(item => daySelection.includes(item.id))
      .sort(sortByMode);
    const inactiveItems = filteredItems
      .filter(item => !daySelection.includes(item.id))
      .sort(sortByMode);

    return [...activeItems, ...inactiveItems];
  }, [daySelection, filteredItems, sortMode, usageCounts]);

  const itemsToRender = useMemo(() => {
    if (viewMode === 'manage' || search.trim()) return sortedItems;
    return sortedItems.slice(0, visibleCount);
  }, [search, sortedItems, viewMode, visibleCount]);

  const hasHiddenItems = viewMode === 'select' && !search.trim() && sortedItems.length > itemsToRender.length;
  const selectedCount = items.filter(item => daySelection.includes(item.id)).length;

  const handleRemoveCategory = async () => {
    const msg = items.length > 0
      ? `Remover tambem os ${items.length} itens desta categoria?`
      : 'Esta acao nao pode ser desfeita.';
    const ok = await confirm(`Remover "${categoria}"`, msg);
    if (ok) {
      mediumTap();
      onRemoveCategory();
    }
  };

  const handleExpandToggle = () => {
    lightTap();
    onToggleCollapse();
  };

  const handleShowAddSheet = () => {
    lightTap();
    setShowAddSheet(true);
  };

  const handleShowMore = () => {
    lightTap();
    setVisibleCount(count => count + INITIAL_VISIBLE_ITEMS);
  };

  return (
    <>
      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-[14px] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
        <button
          type="button"
          className="w-full rounded-[18px] bg-transparent text-left"
          onClick={handleExpandToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Colapsar ${categoria}` : `Expandir ${categoria}`}
        >
          <div className="flex items-start gap-[12px]">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
                {viewMode === 'select' ? 'Categoria' : 'Edicao'}
              </p>
              <h2 className="mt-[4px] overflow-hidden text-ellipsis whitespace-nowrap font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
                {categoria}
              </h2>
              <p className="mt-[8px] text-[14px] leading-[1.5] text-[var(--text-dim)]">
                {selectedCount} de {items.length} itens no menu de hoje
              </p>
            </div>
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[var(--border)] text-[18px] text-[var(--text-dim)]">
              {expanded ? '−' : '+'}
            </div>
          </div>
        </button>

        {expanded ? (
          <div className="mt-[14px] border-t border-[var(--border)] pt-[14px]">
            {viewMode === 'manage' ? (
              <div className="mb-[14px] grid grid-cols-2 gap-[8px]">
                <button
                  type="button"
                  className="min-h-[44px] rounded-[16px] border border-[var(--border)] px-[12px] text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:opacity-40"
                  onClick={onMoveUp}
                  disabled={isFirst}
                  aria-label={`Mover ${categoria} para cima`}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-[16px] border border-[var(--border)] px-[12px] text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:opacity-40"
                  onClick={onMoveDown}
                  disabled={isLast}
                  aria-label={`Mover ${categoria} para baixo`}
                >
                  Descer
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-[16px] bg-[var(--accent)] px-[12px] text-[13px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
                  onClick={handleShowAddSheet}
                  aria-label={`Adicionar item em ${categoria}`}
                >
                  Novo item
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-[16px] border border-[var(--accent-red)] px-[12px] text-[13px] font-semibold text-[var(--accent-red)] transition-opacity hover:opacity-90"
                  onClick={handleRemoveCategory}
                  aria-label={`Remover categoria ${categoria}`}
                >
                  Excluir
                </button>
              </div>
            ) : null}

            {sortedItems.length === 0 ? (
              <p className="rounded-[18px] border border-dashed border-[var(--border)] px-[14px] py-[18px] text-[14px] leading-[1.5] text-[var(--text-dim)]">
                {viewMode === 'manage'
                  ? 'Nenhum item nesta categoria. Use "Novo item" para preencher.'
                  : 'Nenhum item encontrado nesta categoria.'}
              </p>
            ) : (
              <>
                <ul className="flex list-none flex-col gap-[8px]">
                  {itemsToRender.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      active={daySelection.includes(item.id)}
                      onToggle={() => onToggle(item.id)}
                      onRemove={() => onRemove(item.id)}
                      onRename={(newNome) => onRename(item.id, newNome)}
                      mode={viewMode}
                    />
                  ))}
                </ul>

                {hasHiddenItems ? (
                  <button
                    type="button"
                    className="mt-[12px] min-h-[44px] w-full rounded-[16px] border border-[var(--border)] px-[14px] text-[14px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                    onClick={handleShowMore}
                  >
                    Ver mais {Math.min(INITIAL_VISIBLE_ITEMS, sortedItems.length - itemsToRender.length)} itens
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>

      <BottomSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title={`Novo item em ${categoria}`}
        description="Adicione um complemento e ele entra selecionado no menu do dia."
      >
        <AddForm
          onAdd={(nome) => {
            onAdd(nome, categoria);
            setShowAddSheet(false);
          }}
          onClose={() => setShowAddSheet(false)}
        />
      </BottomSheet>
    </>
  );
}
