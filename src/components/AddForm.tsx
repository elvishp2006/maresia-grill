import { useState, useRef, useEffect } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface AddFormProps {
  onAdd: (nome: string) => void;
  onClose: () => void;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  disabled?: boolean;
}

export default function AddForm({
  onAdd,
  onClose,
  placeholder = 'Nome do item...',
  initialValue = '',
  submitLabel = 'Adicionar',
  disabled = false,
}: AddFormProps) {
  const [nome, setNome] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const { lightTap, success } = useHapticFeedback();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setNome(initialValue);
  }, [initialValue]);

  const handleSubmit = () => {
    if (disabled) return;
    const trimmed = nome.trim();
    if (!trimmed) return;
    success();
    onAdd(trimmed);
    setNome('');
    onClose();
  };

  const handleClose = () => {
    lightTap();
    onClose();
  };

  return (
    <div className="flex flex-col gap-[14px]">
      <input
        ref={inputRef}
        type="text"
        className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
        placeholder={placeholder}
        value={nome}
        disabled={disabled}
        onChange={e => setNome(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') handleClose(); }}
      />
      {disabled ? (
        <p className="text-[13px] leading-[1.5] text-[var(--accent-red)]">
          Esta acao requer conexao com a internet.
        </p>
      ) : null}
      <div className="flex gap-[10px]">
        <button
          type="button"
          className="min-h-[48px] flex-1 rounded-[18px] bg-[var(--accent)] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={handleSubmit}
          disabled={disabled}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          className="min-h-[48px] flex-1 rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[16px] py-[12px] text-[14px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
          onClick={handleClose}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
