import { useMemo, useState } from 'react';
import type { Item } from '../types';
import { normalize } from '../lib/utils';
import ItemRow from './ItemRow';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ItemListProps {
  items: Item[];
  daySelection: string[];
  search: string;
  sortMode: 'alpha' | 'usage';
  usageCounts: Record<string, number>;
  viewMode: 'select' | 'manage';
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate?: (id: string, input: { nome: string; priceCents: number }) => void;
  onUpdateAlwaysActive?: (itemId: string, alwaysActive: boolean) => void;
  onRename?: (id: string, newNome: string) => void;
  isOnline?: boolean;
}

const INITIAL_VISIBLE_ITEMS = 8;

export default function ItemList({
  items,
  daySelection,
  search,
  sortMode,
  usageCounts,
  viewMode,
  onToggle,
  onRemove,
  onUpdate,
  onUpdateAlwaysActive,
  onRename,
  isOnline = true,
}: ItemListProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const { lightTap } = useHapticFeedback();

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

  const handleShowMore = () => {
    lightTap();
    setVisibleCount(count => count + INITIAL_VISIBLE_ITEMS);
  };

  if (sortedItems.length === 0) {
    return (
      <p className="rounded-[20px] border border-dashed border-[var(--border)] px-[14px] py-[18px] text-[14px] leading-[1.6] text-[var(--text-dim)]">
        {viewMode === 'manage'
          ? 'Nenhum item nesta categoria. Use "Novo item" para preencher.'
          : 'Nenhum item encontrado nesta categoria.'}
      </p>
    );
  }

  return (
    <>
      <ul className="flex list-none flex-col gap-[10px]">
        {itemsToRender.map(item => (
          <ItemRow
            key={item.id}
            item={item}
            active={daySelection.includes(item.id)}
            onToggle={() => onToggle(item.id)}
            onRemove={() => onRemove(item.id)}
            onUpdate={onUpdate ? (input) => onUpdate(item.id, input) : undefined}
            onUpdateAlwaysActive={onUpdateAlwaysActive ? (alwaysActive) => onUpdateAlwaysActive(item.id, alwaysActive) : undefined}
            onRename={onRename ? (newNome) => onRename(item.id, newNome) : undefined}
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
  );
}
