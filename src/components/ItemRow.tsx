import { useState, useRef, useEffect } from 'react';
import type { Item } from '../types';

interface ItemRowProps {
  item: Item;
  active: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (newNome: string) => void;
}

export default function ItemRow({ item, active, onToggle, onRemove, onRename }: ItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditValue(item.nome);
    setEditing(true);
  };

  const confirmEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.nome) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const handleRemove = () => {
    if (window.confirm(`Remover "${item.nome}"?`)) {
      onRemove();
    }
  };

  return (
    <li className={`item${active ? ' active' : ''}`}>
      <label className="toggle-wrapper" htmlFor={`toggle-${item.id}`}>
        <input
          type="checkbox"
          id={`toggle-${item.id}`}
          className="toggle-input"
          checked={active}
          onChange={onToggle}
        />
        <span className="toggle-slider" />
      </label>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="item-edit-input"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={confirmEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
        />
      ) : (
        <span className="item-name">{item.nome}</span>
      )}

      <button
        type="button"
        className="edit-btn"
        onClick={startEdit}
        aria-label={`Renomear ${item.nome}`}
      >
        ✎
      </button>
      <button
        type="button"
        className="remove-btn"
        onClick={handleRemove}
        aria-label={`Remover ${item.nome}`}
      >
        ×
      </button>
    </li>
  );
}
