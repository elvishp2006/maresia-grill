import { useState, useEffect, useRef } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface HeaderProps {
  activeCount: number;
  dateShort: string;
  onCopy: () => void;
  viewMode: 'select' | 'manage';
  onViewModeChange: (mode: 'select' | 'manage') => void;
  onHeightChange?: (height: number) => void;
}

export default function Header({
  activeCount,
  dateShort,
  onCopy,
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
      className="sticky top-0 z-30 -mx-[16px] mb-[12px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[16px] pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-[18px]"
    >
      <div className="flex items-start justify-between gap-[12px]">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--text-dim)]">
            Operacao do dia
          </p>
          <h1 className="mt-[6px] font-[Georgia,'Times_New_Roman',serif] text-[32px] font-bold leading-[1] tracking-[-0.04em] text-[var(--text)]">
            Menu do Dia
          </h1>
          <span className="mt-[8px] block text-[14px] text-[var(--text-dim)]">
            {activeCount} iten{activeCount !== 1 ? 's' : ''} selecionado{activeCount !== 1 ? 's' : ''} • {dateShort}
          </span>
        </div>
        <button
          className={`min-h-[48px] shrink-0 rounded-[16px] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--bg)] transition-colors ${copied ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'}`}
          onClick={handleCopy}
          type="button"
          aria-label="Copiar menu do dia"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="mt-[16px] grid grid-cols-2 gap-[8px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] p-[4px]">
        <button
          type="button"
          className={`min-h-[44px] rounded-[14px] px-[12px] text-[14px] font-semibold transition-colors ${viewMode === 'select' ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('select');
          }}
        >
          Montar menu
        </button>
        <button
          type="button"
          className={`min-h-[44px] rounded-[14px] px-[12px] text-[14px] font-semibold transition-colors ${viewMode === 'manage' ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--text-dim)]'}`}
          onClick={() => {
            lightTap();
            onViewModeChange('manage');
          }}
        >
          Editar catalogo
        </button>
      </div>
    </header>
  );
}
