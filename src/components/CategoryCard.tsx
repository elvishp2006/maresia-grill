import { useState } from 'react';
import type { Categoria, Item } from '../types';
import ItemRow from './ItemRow';
import AddForm from './AddForm';

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
    if (window.confirm(msg)) onRemoveCategory();
  };

  return (
    <div className="category-card">
      <div className="category-header">
        <button
          type="button"
          className="category-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          aria-expanded={!collapsed}
        >
          <h2 className="category-title">{categoria}</h2>
          <span className="category-count">({selectedCount}/{items.length})</span>
          <span className="collapse-arrow">{collapsed ? '▸' : '▾'}</span>
        </button>
        <div className="category-actions">
          <button
            type="button"
            className="move-btn"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Mover ${categoria} para cima`}
          >
            ↑
          </button>
          <button
            type="button"
            className="move-btn"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Mover ${categoria} para baixo`}
          >
            ↓
          </button>
          <button
            type="button"
            className="add-btn"
            onClick={() => { setShowForm(true); setCollapsed(false); }}
            aria-label={`Adicionar item em ${categoria}`}
          >
            +
          </button>
          <button
            type="button"
            className="remove-category-btn"
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
            <p className="empty-state">Nenhum item. Use + para adicionar.</p>
          ) : (
            <ul className="item-list">
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
