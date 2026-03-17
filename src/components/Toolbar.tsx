import { useRef } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: 'alpha' | 'usage';
  onToggleSort: () => void;
  viewMode: 'menu' | 'manage';
  stickyTop: number;
}

export default function Toolbar({
  search,
  onSearchChange,
  sortMode,
  onToggleSort,
  viewMode,
  stickyTop,
}: ToolbarProps) {
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
    <div
      className="subtle-panel sticky z-20 mb-[18px] p-[12px]"
      style={{ top: `${stickyTop}px` }}
    >
      <div className="flex items-center gap-[10px]">
        <div className="relative flex-1">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] py-[10px] pl-[40px] pr-[52px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
            placeholder={viewMode === 'menu' ? 'Buscar item para o menu...' : 'Buscar item ou categoria'}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') searchInputRef.current?.blur(); }}
          />
          {search.trim().length > 0 ? (
            <button
              type="button"
              aria-label="Limpar busca"
              className="absolute right-[8px] top-1/2 flex h-[38px] w-[38px] -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-[var(--text-dim)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
              onClick={handleClearSearch}
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={sortMode === 'alpha' ? 'Ordenar por uso recente' : 'Ordenar A-Z'}
          title={sortMode === 'alpha' ? 'Ordenar por uso recente' : 'Ordenar A-Z'}
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] transition-colors hover:border-[var(--accent)]"
          onClick={handleToggleSort}
        >
          {sortMode === 'alpha' ? (
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18M7 12h10M11 18h2"/>
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
