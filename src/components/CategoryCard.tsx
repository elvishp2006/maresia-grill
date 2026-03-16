import { useState } from 'react';
import type { Categoria, Item } from '../types';
import ItemRow from './ItemRow';
import AddForm from './AddForm';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

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
}

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
}: CategoryCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { lightTap, mediumTap } = useHapticFeedback();

  const filteredItems = search.trim()
    ? items.filter(item => item.nome.toLowerCase().includes(search.trim().toLowerCase()))
    : items;

  const sortByMode = (a: Item, b: Item) => {
    if (sortMode === 'usage') {
      const diff = (usageCounts[b.id] ?? 0) - (usageCounts[a.id] ?? 0);
      if (diff !== 0) return diff;
    }
    return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  };

  const activeItems = filteredItems.filter(item => daySelection.includes(item.id)).sort(sortByMode);
  const inactiveItems = filteredItems.filter(item => !daySelection.includes(item.id)).sort(sortByMode);
  const sortedItems = [...activeItems, ...inactiveItems];

  const selectedCount = items.filter(item => daySelection.includes(item.id)).length;

  const handleRemoveCategory = () => {
    const msg = items.length > 0
      ? `Remover categoria "${categoria}" e todos os seus ${items.length} itens?`
      : `Remover categoria "${categoria}"?`;
    if (window.confirm(msg)) {
      mediumTap();
      onRemoveCategory();
    }
  };

  const handleCollapse = () => {
    lightTap();
    setCollapsed(c => !c);
  };

  const handleMoveUp = () => {
    lightTap();
    onMoveUp?.();
  };

  const handleMoveDown = () => {
    lightTap();
    onMoveDown?.();
  };

  const handleShowForm = () => {
    lightTap();
    setShowForm(true);
    setCollapsed(false);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[6px] p-[14px]">
      <div className="category-header group flex items-center justify-between mb-[10px]">
        <button
          type="button"
          className="flex items-center gap-[6px] bg-transparent border-none cursor-pointer p-0 text-left flex-1 min-h-[44px]"
          onClick={handleCollapse}
          aria-expanded={!collapsed}
        >
          <h2 className="font-[Georgia,'Times_New_Roman',serif] text-[18px] font-bold text-[var(--text)] tracking-[0.2px]">
            {categoria}
          </h2>
          <span className="text-[11px] text-[var(--text-dim)] font-mono font-normal">
            ({selectedCount}/{items.length})
          </span>
          <span className="text-[12px] text-[var(--text-dim)] leading-none">
            {collapsed ? '▸' : '▾'}
          </span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="move-btn text-[14px] leading-none text-[var(--text-dim)] bg-transparent border-none cursor-pointer px-[6px] py-1 rounded opacity-40 disabled:opacity-15 disabled:cursor-default hover:not-disabled:opacity-100 hover:not-disabled:text-[var(--accent)] min-h-[32px] shrink-0 touch-manipulation transition-[opacity,color]"
            onClick={handleMoveUp}
            disabled={isFirst}
            aria-label={`Mover ${categoria} para cima`}
          >
            ↑
          </button>
          <button
            type="button"
            className="move-btn text-[14px] leading-none text-[var(--text-dim)] bg-transparent border-none cursor-pointer px-[6px] py-1 rounded opacity-40 disabled:opacity-15 disabled:cursor-default hover:not-disabled:opacity-100 hover:not-disabled:text-[var(--accent)] min-h-[32px] shrink-0 touch-manipulation transition-[opacity,color]"
            onClick={handleMoveDown}
            disabled={isLast}
            aria-label={`Mover ${categoria} para baixo`}
          >
            ↓
          </button>
          <button
            type="button"
            className="font-mono text-[20px] leading-none text-[var(--accent)] bg-transparent border border-[var(--border)] rounded w-8 h-8 flex items-center justify-center cursor-pointer hover:border-[var(--accent)] shrink-0 touch-manipulation transition-colors"
            onClick={handleShowForm}
            aria-label={`Adicionar item em ${categoria}`}
          >
            +
          </button>
          <button
            type="button"
            className="remove-category-btn text-[18px] leading-none text-[var(--text-dim)] bg-transparent border-none cursor-pointer px-[6px] py-1 rounded opacity-40 hover:opacity-100 hover:text-[var(--accent-red)] min-h-[32px] shrink-0 touch-manipulation transition-[opacity,color]"
            onClick={handleRemoveCategory}
            aria-label={`Remover categoria ${categoria}`}
          >
            ×
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {showForm && (
            <AddForm
              onAdd={(nome) => onAdd(nome, categoria)}
              onClose={() => setShowForm(false)}
            />
          )}

          {sortedItems.length === 0 && !showForm ? (
            <p className="text-[11px] text-[var(--text-dim)] italic py-2 px-1">
              Nenhum item. Use + para adicionar.
            </p>
          ) : (
            <ul className="item-list list-none flex flex-col gap-[2px] max-h-[280px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {sortedItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  active={daySelection.includes(item.id)}
                  onToggle={() => onToggle(item.id)}
                  onRemove={() => onRemove(item.id)}
                  onRename={(newNome) => onRename(item.id, newNome)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
