import { useRef } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: 'alpha' | 'usage';
  onToggleSort: () => void;
}

export default function Toolbar({ search, onSearchChange, sortMode, onToggleSort }: ToolbarProps) {
  const { lightTap } = useHapticFeedback();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleToggleSort = () => {
    lightTap();
    onToggleSort();
  };

  const handleClearSearch = () => {
    onSearchChange('');
    searchInputRef.current?.focus();
  };

  return (
    <div className="flex gap-[8px] mb-[16px] items-center">
      <div className="relative flex-1">
        <input
          ref={searchInputRef}
          type="search"
          className="font-mono text-[16px] text-[var(--text)] bg-[rgba(240,235,224,0.05)] border border-[var(--border)] rounded-[4px] px-[10px] py-[8px] pr-[38px] w-full outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-dim)] transition-colors"
          placeholder="Filtrar itens..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        {search.trim().length > 0 ? (
          <button
            type="button"
            aria-label="Limpar busca"
            className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[28px] h-[28px] rounded-[4px] border border-transparent bg-transparent text-[var(--text-dim)] cursor-pointer touch-manipulation transition-colors hover:text-[var(--text)] hover:border-[var(--border)]"
            onClick={handleClearSearch}
          >
            ×
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="font-mono text-[12px] font-semibold text-[var(--accent)] bg-transparent border border-[var(--border)] rounded-[4px] px-[14px] py-[8px] cursor-pointer min-h-[44px] whitespace-nowrap touch-manipulation hover:border-[var(--accent)] transition-colors"
        onClick={handleToggleSort}
        title={sortMode === 'alpha' ? 'Ordenar por uso recente' : 'Ordenar A–Z'}
      >
        {sortMode === 'alpha' ? 'A–Z' : 'Uso'}
      </button>
    </div>
  );
}
