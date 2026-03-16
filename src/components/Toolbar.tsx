import { useRef } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortMode: 'alpha' | 'usage';
  onToggleSort: () => void;
  viewMode: 'select' | 'manage';
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
      className="sticky z-20 mb-[16px] rounded-[22px] border border-[var(--border)] bg-[rgba(30,32,23,0.92)] p-[10px] shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-[18px]"
      style={{ top: `${stickyTop}px` }}
    >
      <div className="mb-[8px] flex items-center justify-between gap-[8px]">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
          {viewMode === 'select' ? 'Selecao rapida' : 'Busca e organizacao'}
        </p>
        <p className="text-[12px] text-[var(--text-dim)]">
          {sortMode === 'alpha' ? 'Ordem alfabetica' : 'Prioridade por frequencia'}
        </p>
      </div>
      <div className="flex items-center gap-[8px]">
        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="search"
            className="w-full rounded-[16px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] pr-[52px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
            placeholder={viewMode === 'select' ? 'Buscar item para o menu de hoje' : 'Buscar item ou categoria'}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
          {search.trim().length > 0 ? (
            <button
              type="button"
              aria-label="Limpar busca"
              className="absolute right-[8px] top-1/2 flex h-[36px] w-[36px] -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-[var(--text-dim)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
              onClick={handleClearSearch}
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="min-h-[48px] shrink-0 rounded-[16px] border border-[var(--border)] px-[14px] text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
          onClick={handleToggleSort}
          title={sortMode === 'alpha' ? 'Ordenar por uso recente' : 'Ordenar A-Z'}
        >
          {sortMode === 'alpha' ? 'Mais usados' : 'A-Z'}
        </button>
      </div>
    </div>
  );
}
