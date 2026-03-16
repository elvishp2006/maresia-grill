import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: 'alpha' | 'usage';
  onToggleSort: () => void;
}

export default function Toolbar({ search, onSearchChange, sortMode, onToggleSort }: ToolbarProps) {
  const { lightTap } = useHapticFeedback();

  const handleToggleSort = () => {
    lightTap();
    onToggleSort();
  };

  return (
    <div className="flex gap-2 mb-4 items-center">
      <input
        type="search"
        className="font-mono text-[16px] text-[var(--text)] bg-[rgba(240,235,224,0.05)] border border-[var(--border)] rounded px-[10px] py-2 flex-1 outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-dim)] transition-colors"
        placeholder="Filtrar itens..."
        value={search}
        onChange={e => onSearchChange(e.target.value)}
      />
      <button
        type="button"
        className="font-mono text-[12px] font-semibold text-[var(--accent)] bg-transparent border border-[var(--border)] rounded px-[14px] py-2 cursor-pointer min-h-[44px] whitespace-nowrap touch-manipulation hover:border-[var(--accent)] transition-colors"
        onClick={handleToggleSort}
        title={sortMode === 'alpha' ? 'Ordenar por uso recente' : 'Ordenar A–Z'}
      >
        {sortMode === 'alpha' ? 'A–Z' : 'Uso'}
      </button>
    </div>
  );
}
