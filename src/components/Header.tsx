import { useEffect, useRef } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface HeaderProps {
  activeCount: number;
  dateShort: string;
  isOnline: boolean;
  onSignOut?: () => void;
  userEmail?: string | null;
  viewMode: 'menu' | 'stats' | 'manage';
  onViewModeChange: (mode: 'menu' | 'stats' | 'manage') => void;
  onHeightChange?: (height: number) => void;
}

export default function Header({
  activeCount,
  dateShort,
  isOnline,
  onSignOut,
  userEmail,
  viewMode,
  onViewModeChange,
  onHeightChange,
}: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);
  const { lightTap } = useHapticFeedback();

  useEffect(() => {
    if (!onHeightChange || !headerRef.current) return;

    const measure = () => {
      const nextHeight = Math.round(headerRef.current?.getBoundingClientRect().height ?? 0);
      if (nextHeight > 0) onHeightChange(nextHeight);
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(headerRef.current);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeCount, onHeightChange, viewMode]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 -mx-[16px] mb-[14px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[10px] pt-[max(10px,env(safe-area-inset-top))] backdrop-blur-[18px]"
    >
      <div className="flex items-center justify-between gap-[8px]">
        <div className="flex items-center gap-[8px]">
          <img
            src="/brand/menu-mark.svg"
            alt="Logo do Maresia Grill"
            className="h-[28px] w-[28px] shrink-0 object-cover object-top"
          />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">
            Maresia Grill
          </span>
        </div>

        <div className="flex items-center gap-[8px]">
          {activeCount > 0 ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-[10px] py-[3px] text-[12px] font-semibold text-[var(--accent)]">
              {activeCount} • {dateShort}
            </span>
          ) : (
            <span className="text-[12px] text-[var(--text-dim)]">{dateShort}</span>
          )}
          {onSignOut ? (
            <button
              type="button"
              aria-label="Sair da conta"
              title={userEmail ?? undefined}
              className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[12px] font-bold text-[var(--accent)] transition-colors hover:border-[var(--accent)]"
              onClick={onSignOut}
            >
              {(userEmail?.[0] ?? '?').toUpperCase()}
            </button>
          ) : null}
        </div>
      </div>

      <div role="tablist" className="subtle-panel mt-[10px] grid grid-cols-3 gap-[6px] p-[4px]">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'menu'}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-[3px] rounded-[16px] px-[10px] transition-colors ${viewMode === 'menu' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('menu');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
          <span className="text-[11px] font-semibold">Menu</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'stats'}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-[3px] rounded-[16px] px-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${viewMode === 'stats' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('stats');
          }}
          disabled={!isOnline}
          aria-disabled={!isOnline}
          title={isOnline ? undefined : 'Estatísticas indisponíveis sem internet'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <span className="text-[11px] font-semibold">Estatísticas</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'manage'}
          className={`flex min-h-[44px] flex-col items-center justify-center gap-[3px] rounded-[16px] px-[10px] transition-colors ${viewMode === 'manage' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('manage');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span className="text-[11px] font-semibold">Catálogo</span>
        </button>
      </div>
    </header>
  );
}
