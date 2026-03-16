import { useState, useEffect, useRef } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface HeaderProps {
  activeCount: number;
  dateShort: string;
  onCopy: () => void;
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
  onCopy,
  isOnline,
  onSignOut,
  userEmail,
  viewMode,
  onViewModeChange,
  onHeightChange,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { success, lightTap } = useHapticFeedback();

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

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

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    success();
  };

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-30 -mx-[16px] mb-[14px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[14px] pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-[18px]"
    >
      <div className="flex flex-col items-center">
        <div className="flex w-full justify-center">
          <div className="flex items-center justify-center md:hidden">
            <img
              src="/brand/menu-mark.svg"
              alt="Logo do Maresia Grill"
              className="h-[52px] w-[52px] max-w-none shrink-0 object-cover object-top drop-shadow-[0_10px_18px_rgba(0,0,0,0.18)]"
            />
          </div>
          <img
            src="/brand/menu-mark.svg"
            alt=""
            aria-hidden="true"
            className="hidden h-[84px] w-[132px] shrink-0 object-contain px-[2px] py-[2px] drop-shadow-[0_10px_18px_rgba(0,0,0,0.18)] md:block"
          />
        </div>
        <div className="mt-[10px] flex w-full items-center justify-between gap-[12px]">
          <span className="min-w-0 text-[13px] text-[var(--text-dim)] md:text-[14px]">
            {activeCount} iten{activeCount !== 1 ? 's' : ''} selecionado{activeCount !== 1 ? 's' : ''} • {dateShort}
          </span>
          <button
            className={`min-h-[44px] shrink-0 rounded-[16px] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--bg)] shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-colors md:min-h-[48px] md:rounded-[18px] md:px-[16px] md:py-[12px] md:text-[14px] ${copied ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'}`}
            onClick={handleCopy}
            type="button"
            aria-label="Copiar menu do dia"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="subtle-panel mt-[16px] grid grid-cols-3 gap-[6px] p-[4px]">
        <button
          type="button"
          className={`min-h-[44px] rounded-[16px] px-[10px] text-[13px] font-semibold transition-colors ${viewMode === 'menu' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('menu');
          }}
        >
          Montar menu
        </button>
        <button
          type="button"
          className={`min-h-[44px] rounded-[16px] px-[10px] text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${viewMode === 'stats' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('stats');
          }}
          disabled={!isOnline}
          aria-disabled={!isOnline}
          title={isOnline ? undefined : 'Estatísticas indisponíveis sem internet'}
        >
          Estatísticas
        </button>
        <button
          type="button"
          className={`min-h-[44px] rounded-[16px] px-[10px] text-[13px] font-semibold transition-colors ${viewMode === 'manage' ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.14)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('manage');
          }}
        >
          Editar catálogo
        </button>
      </div>

      {onSignOut ? (
        <div className="mt-[12px] flex items-center justify-between gap-[12px]">
          <span className="min-w-0 truncate text-[12px] text-[var(--text-dim)]">
            {userEmail ?? 'Sessao autenticada'}
          </span>
          <button
            type="button"
            className="min-h-[38px] shrink-0 rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] px-[12px] text-[12px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
            onClick={onSignOut}
          >
            Sair
          </button>
        </div>
      ) : null}
    </header>
  );
}
