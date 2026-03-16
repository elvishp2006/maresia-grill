interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: 'alpha' | 'usage';
  onToggleSort: () => void;
}

export default function Toolbar({ search, onSearchChange, sortMode, onToggleSort }: ToolbarProps) {
  return (
    <div className="toolbar">
      <input
        type="search"
        className="toolbar-search"
        placeholder="Filtrar itens..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
      />
      <button
        type="button"
        className="sort-btn"
        onClick={onToggleSort}
        title={sortMode === 'alpha' ? 'Ordenar por uso recente' : 'Ordenar A–Z'}
      >
        {sortMode === 'alpha' ? 'A–Z' : 'Uso'}
      </button>
    </div>
  );
}
