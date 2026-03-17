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
      <div className="mb-[10px] flex items-center justify-between gap-[10px]">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
          {viewMode === 'menu' ? 'Seleção rápida' : 'Busca e organização'}
        </p>
        <p className="text-[12px] text-[var(--text-dim)]">
          {sortMode === 'alpha' ? 'Ordem alfabética' : 'Prioridade por frequência'}
        </p>
      </div>
      <div className="flex items-center gap-[10px]">
        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="search"
            className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] pr-[52px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
            placeholder={viewMode === 'menu' ? 'Buscar item para o menu de hoje' : 'Buscar item ou categoria'}
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
          className="min-h-[48px] shrink-0 rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[14px] text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
          onClick={handleToggleSort}
          title={sortMode === 'alpha' ? 'Ordenar por uso recente' : 'Ordenar A-Z'}
        >
          {sortMode === 'alpha' ? 'Mais usados' : 'A-Z'}
        </button>
      </div>
    </div>
  );
}
