import type { Item } from '../types';

interface ItemRowProps {
  item: Item;
  active: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

export default function ItemRow({ item, active, onToggle, onRemove }: ItemRowProps) {
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
      <span className="item-name">{item.nome}</span>
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
