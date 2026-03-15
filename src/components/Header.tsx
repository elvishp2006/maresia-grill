import { useState, useEffect } from 'react';

interface HeaderProps {
  activeCount: number;
  dateShort: string;
  onCopy: () => void;
}

export default function Header({ activeCount, dateShort, onCopy }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <h1>Cardápio do Dia</h1>
        <span className="header-meta">{activeCount} iten{activeCount !== 1 ? 's' : ''} • {dateShort}</span>
      </div>
      <button
        className={`copy-btn${copied ? ' copied' : ''}`}
        onClick={handleCopy}
        type="button"
      >
        {copied ? '✓ Copiado!' : 'Copiar Cardápio'}
      </button>
    </header>
  );
}
