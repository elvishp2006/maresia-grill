import { useState, useEffect } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface HeaderProps {
  activeCount: number;
  dateShort: string;
  onCopy: () => void;
}

export default function Header({ activeCount, dateShort, onCopy }: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const { success } = useHapticFeedback();

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    success();
  };

  return (
    <header className="flex items-center justify-between gap-[12px] pt-[16px] pb-[20px] border-b border-[var(--border)] mb-[20px] flex-wrap max-[480px]:flex-col max-[480px]:items-start">
      <div>
        <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[28px] font-bold text-[var(--accent)] tracking-[-0.5px]">
          Menu do Dia
        </h1>
        <span className="block text-[11px] text-[var(--text-dim)] mt-[2px] font-mono">
          {activeCount} iten{activeCount !== 1 ? 's' : ''} • {dateShort}
        </span>
      </div>
      <button
        className={`font-mono text-[13px] font-semibold text-[var(--bg)] border-none rounded-[4px] px-[18px] py-[10px] min-h-[44px] cursor-pointer touch-manipulation transition-colors whitespace-nowrap max-[480px]:w-full ${copied ? 'bg-[var(--green)]' : 'bg-[var(--accent)]'}`}
        onClick={handleCopy}
        type="button"
      >
        {copied ? '✓ Copiado!' : 'Copiar Menu'}
      </button>
    </header>
  );
}
