import { useMemo, useState } from 'react';
import type { Categoria, Item } from '../types';
import { normalize } from '../utils';
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
  isOnline?: boolean;
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
  isOnline = true,
}: CategoryCardProps) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const normalized = normalize(search.trim());
    return items.filter(item => normalize(item.nome).includes(normalized));
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
      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
        <button
          type="button"
          className="w-full rounded-[20px] bg-transparent text-left"
          onClick={handleExpandToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Colapsar ${categoria}` : `Expandir ${categoria}`}
        >
          <div className="flex items-start gap-[14px]">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
                {viewMode === 'select' ? 'Categoria' : 'Edicao'}
              </p>
              <h2 className="mt-[4px] overflow-hidden text-ellipsis whitespace-nowrap font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
                {categoria}
              </h2>
              <p className="mt-[10px] text-[14px] leading-[1.6] text-[var(--text-dim)]">
                {selectedCount} de {items.length} itens no menu de hoje
              </p>
            </div>
            <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[18px] text-[var(--text-dim)]">
              <svg
                className={`h-[18px] w-[18px] transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 7.5L10 12.5L15 7.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </button>

        {expanded ? (
          <div className="mt-[16px] border-t border-[var(--border)] pt-[16px]">
            {viewMode === 'manage' ? (
              <div className="mb-[16px] grid grid-cols-2 gap-[10px]">
                <button
                  type="button"
                  className="min-h-[44px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={onMoveUp}
                  disabled={isFirst || !isOnline}
                  aria-label={`Mover ${categoria} para cima`}
                >
                  Subir
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={onMoveDown}
                  disabled={isLast || !isOnline}
                  aria-label={`Mover ${categoria} para baixo`}
                >
                  Descer
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-[18px] bg-[var(--accent)] px-[12px] text-[13px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleShowAddSheet}
                  aria-label={`Adicionar item em ${categoria}`}
                  disabled={!isOnline}
                >
                  Novo item
                </button>
                <button
                  type="button"
                  className="min-h-[44px] rounded-[18px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.06)] px-[12px] text-[13px] font-semibold text-[var(--accent-red)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleRemoveCategory}
                  aria-label={`Remover categoria ${categoria}`}
                  disabled={!isOnline}
                >
                  Excluir
                </button>
              </div>
            ) : null}

            {sortedItems.length === 0 ? (
              <p className="rounded-[20px] border border-dashed border-[var(--border)] px-[14px] py-[18px] text-[14px] leading-[1.6] text-[var(--text-dim)]">
                {viewMode === 'manage'
                  ? 'Nenhum item nesta categoria. Use "Novo item" para preencher.'
                  : 'Nenhum item encontrado nesta categoria.'}
              </p>
            ) : (
              <>
                <ul className="flex list-none flex-col gap-[10px]">
                  {itemsToRender.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      active={daySelection.includes(item.id)}
                      onToggle={() => onToggle(item.id)}
                      onRemove={() => onRemove(item.id)}
                      onRename={(newNome) => onRename(item.id, newNome)}
                      mode={viewMode}
                      isOnline={isOnline}
                    />
                  ))}
                </ul>

                {hasHiddenItems ? (
                  <button
                    type="button"
                    className="mt-[14px] min-h-[44px] w-full rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[14px] text-[14px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
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
          disabled={!isOnline}
        />
      </BottomSheet>
    </>
  );
}
