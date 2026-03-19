import { useState, useEffect, useId } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface AddFormProps {
  onAdd: (nome: string) => void;
  onClose: () => void;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function AddForm({
  onAdd,
  onClose,
  placeholder = 'Nome do item...',
  initialValue = '',
  submitLabel = 'Adicionar',
  disabled = false,
  disabledMessage = 'Esta ação requer conexão com a internet.',
}: AddFormProps) {
  const [nome, setNome] = useState(initialValue);
  const { lightTap, success } = useHapticFeedback();
  const inputId = useId();

  useEffect(() => {
    setNome(initialValue);
  }, [initialValue]);

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
      <label htmlFor={inputId} className="sr-only">{placeholder}</label>
      <input
        id={inputId}
        type="text"
        className="neon-gold-focus w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
        placeholder={placeholder}
        value={nome}
        disabled={disabled}
        onChange={e => setNome(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') handleClose(); }}
      />
      {disabled ? (
        <p className="text-[13px] leading-[1.5] text-[var(--accent-red)]">
          {disabledMessage}
        </p>
      ) : null}
      <div className="flex gap-[10px]">
        <button
          type="submit"
          className="neon-gold-fill min-h-[48px] flex-1 rounded-[18px] bg-[var(--accent)] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
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
    </form>
  );
}
