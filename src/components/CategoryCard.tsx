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
}

export default function CategoryCard({
  categoria,
  items,
  daySelection,
  onToggle,
  onAdd,
  onRemove,
}: CategoryCardProps) {
  const [showForm, setShowForm] = useState(false);

  const sortedItems = [...items].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );

  return (
    <div className="category-card">
      <div className="category-header">
        <h2 className="category-title">{categoria}</h2>
        <button
          type="button"
          className="add-btn"
          onClick={() => setShowForm(true)}
          aria-label={`Adicionar item em ${categoria}`}
        >
          +
        </button>
      </div>

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
            />
          ))}
        </ul>
      )}
    </div>
  );
}
