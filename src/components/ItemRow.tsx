import { useState, useRef, useEffect } from 'react';
import type { Item } from '../types';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useModal } from '../contexts/ModalContext';

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
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    lightTap();
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

  const handleRemove = async () => {
    const ok = await confirm('Remover item', `Remover "${item.nome}"?`);
    if (ok) {
      mediumTap();
      onRemove();
    }
  };

  const handleToggle = () => {
    lightTap();
    onToggle();
  };

  return (
    <li className={`item group flex items-center gap-[8px] px-[4px] py-[6px] rounded-[4px] min-h-[44px] select-none transition-colors${active ? ' active bg-[rgba(212,168,67,0.08)]' : ''}`}>
      <label className="toggle-wrapper" htmlFor={`toggle-${item.id}`}>
        <input
          type="checkbox"
          id={`toggle-${item.id}`}
          className="toggle-input"
          checked={active}
          onChange={handleToggle}
        />
        <span className="toggle-slider" />
      </label>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="font-mono text-[11px] text-[var(--text)] bg-[rgba(240,235,224,0.08)] border border-[var(--accent)] rounded-[4px] px-[6px] py-[2px] flex-1 outline-none min-w-0"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={confirmEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
        />
      ) : (
        <span className={`flex-1 text-[11px] font-mono transition-colors leading-[1.4]${active ? ' text-[var(--accent)]' : ' text-[var(--text-dim)]'}`}>
          {item.nome}
        </span>
      )}

      <button
        type="button"
        className="edit-btn text-[14px] leading-none text-[var(--text-dim)] bg-transparent border-none cursor-pointer px-[5px] py-[4px] rounded-[4px] opacity-40 hover:opacity-100 hover:text-[var(--accent)] shrink-0 touch-manipulation transition-[opacity,color] active:scale-95"
        onClick={startEdit}
        aria-label={`Renomear ${item.nome}`}
      >
        ✎
      </button>
      <button
        type="button"
        className="remove-btn text-[18px] leading-none text-[var(--text-dim)] bg-transparent border-none cursor-pointer px-[6px] py-[4px] rounded-[4px] opacity-40 hover:opacity-100 hover:text-[var(--accent-red)] shrink-0 touch-manipulation transition-[opacity,color] active:scale-95"
        onClick={handleRemove}
        aria-label={`Remover ${item.nome}`}
      >
        ×
      </button>
    </li>
  );
}
