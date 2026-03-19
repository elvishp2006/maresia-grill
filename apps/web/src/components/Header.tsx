import { useEffect, useRef } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface HeaderProps {
  activeCount: number;
  dateShort: string;
  isOnline: boolean;
  showUpdateIndicator?: boolean;
  showPublicSyncPendingIndicator?: boolean;
  onApplyUpdate?: () => void;
  onSignOut?: () => void;
  userEmail?: string | null;
  viewMode: 'menu' | 'stats' | 'manage' | 'orders';
  onViewModeChange: (mode: 'menu' | 'stats' | 'manage' | 'orders') => void;
  onHeightChange?: (height: number) => void;
}

export default function Header({
  activeCount,
  dateShort,
  isOnline,
  showUpdateIndicator = false,
  showPublicSyncPendingIndicator = false,
  onApplyUpdate,
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
            <span className="neon-gold-border neon-gold-text rounded-full bg-[var(--accent-soft)] px-[10px] py-[3px] text-[12px] font-semibold text-[var(--accent)]">
              {activeCount} • {dateShort}
            </span>
          ) : (
            <span className="text-[12px] text-[var(--text-dim)]">{dateShort}</span>
          )}
          {showPublicSyncPendingIndicator ? (
            <span
              aria-label="Sincronização pública pendente"
              title="Sincronização pública pendente"
              className="relative flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border border-[rgba(255,106,122,0.72)] bg-[rgba(255,106,122,0.12)] text-[#FF7A88] shadow-[0_0_0_1px_rgba(255,106,122,0.18),0_0_12px_rgba(255,86,104,0.42),0_0_24px_rgba(255,86,104,0.18)]"
            >
              <span className="absolute inset-[6px] rounded-full border border-[rgba(255,170,178,0.34)]" aria-hidden="true" />
              <span className="absolute right-[6px] top-[6px] h-[5px] w-[5px] rounded-full bg-[#FFD6DA]" aria-hidden="true" />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </span>
          ) : null}
          {showUpdateIndicator && onApplyUpdate ? (
            <button
              type="button"
              aria-label="Aplicar atualização do app"
              title="Nova versão disponível"
              className="relative flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border border-[rgba(110,214,116,0.68)] bg-[rgba(110,214,116,0.14)] text-[#8CFF93] shadow-[0_0_0_1px_rgba(110,214,116,0.22),0_0_14px_rgba(110,214,116,0.48),0_0_28px_rgba(110,214,116,0.24)] transition-transform hover:scale-[1.03] hover:bg-[rgba(110,214,116,0.22)]"
              onClick={() => {
                lightTap();
                onApplyUpdate();
              }}
            >
              <span className="absolute inset-[6px] rounded-full border border-[rgba(180,255,184,0.38)]" aria-hidden="true" />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v10" />
                <path d="M8.5 11.5 12 15l3.5-3.5" />
                <path d="M5 19h14" />
              </svg>
            </button>
          ) : null}
          {onSignOut ? (
            <button
              type="button"
              aria-label="Sair da conta"
              title={userEmail ?? undefined}
              className="neon-gold-text flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[12px] font-bold text-[var(--accent)] transition-colors hover:border-[var(--accent)]"
              onClick={() => {
                lightTap();
                onSignOut();
              }}
            >
              {(userEmail?.[0] ?? '?').toUpperCase()}
            </button>
          ) : null}
        </div>
      </div>

      <div role="tablist" className="subtle-panel mt-[10px] grid grid-cols-4 gap-[6px] p-[4px]">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'menu'}
          aria-label="Menu"
          className={`flex min-h-[44px] items-center justify-center rounded-[16px] px-[10px] transition-colors ${viewMode === 'menu' ? 'neon-gold-fill bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('menu');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'stats'}
          aria-label="Estatísticas"
          className={`flex min-h-[44px] items-center justify-center rounded-[16px] px-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${viewMode === 'stats' ? 'neon-gold-fill bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
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
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'orders'}
          aria-label="Pedidos"
          className={`flex min-h-[44px] items-center justify-center rounded-[16px] px-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${viewMode === 'orders' ? 'neon-gold-fill bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('orders');
          }}
          disabled={!isOnline}
          aria-disabled={!isOnline}
          title={isOnline ? undefined : 'Pedidos indisponíveis sem internet'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 11h6M9 15h6M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>
            <path d="M9 7h6"/>
          </svg>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'manage'}
          aria-label="Catálogo"
          className={`flex min-h-[44px] items-center justify-center rounded-[16px] px-[10px] transition-colors ${viewMode === 'manage' ? 'neon-gold-fill bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('manage');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
