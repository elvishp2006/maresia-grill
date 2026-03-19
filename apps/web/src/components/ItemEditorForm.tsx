import { useEffect, useId, useState } from 'react';
import { formatPriceInputFromCents, normalizePriceInputDigits, parsePriceInputToCents } from '../lib/billing';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface ItemEditorFormProps {
  onSubmit: (input: { nome: string; priceCents: number }) => void;
  onClose: () => void;
  initialName?: string;
  initialPriceCents?: number | null;
  submitLabel?: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export default function ItemEditorForm({
  onSubmit,
  onClose,
  initialName = '',
  initialPriceCents = null,
  submitLabel = 'Salvar',
  disabled = false,
  disabledMessage = 'Esta ação requer conexão com a internet.',
}: ItemEditorFormProps) {
  const [nome, setNome] = useState(initialName);
  const [priceInput, setPriceInput] = useState(() => formatPriceInputFromCents(initialPriceCents ?? 0));
  const [priceError, setPriceError] = useState('');
  const nameId = useId();
  const priceId = useId();
  const { lightTap, success } = useHapticFeedback();

  useEffect(() => {
    setNome(initialName);
  }, [initialName]);

  useEffect(() => {
    setPriceInput(formatPriceInputFromCents(initialPriceCents ?? 0));
  }, [initialPriceCents]);

  const handleSubmit = (event: { preventDefault(): void }) => {
    event.preventDefault();
    if (disabled) return;
    const trimmed = nome.trim();
    if (!trimmed) return;

    const priceCents = parsePriceInputToCents(priceInput);
    if (priceCents === null) {
      setPriceError('Informe um preço válido, por exemplo 4,50.');
      return;
    }

    setPriceError('');
    success();
    onSubmit({ nome: trimmed, priceCents });
    onClose();
  };

  const handleClose = () => {
    lightTap();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
      <label htmlFor={nameId} className="sr-only">Nome do item</label>
      <input
        id={nameId}
        type="text"
        className="neon-gold-focus w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
        placeholder="Nome do item"
        value={nome}
        disabled={disabled}
        onChange={e => setNome(e.target.value)}
      />

      <label htmlFor={priceId} className="block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
        Preço
        <input
          id={priceId}
          type="text"
          inputMode="numeric"
          placeholder="0,00"
          className="neon-gold-focus mt-[8px] w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
          value={priceInput}
          disabled={disabled}
          onChange={e => {
            setPriceInput(normalizePriceInputDigits(e.target.value));
            if (priceError) setPriceError('');
          }}
        />
      </label>

      {priceError ? (
        <p className="text-[13px] leading-[1.5] text-[var(--accent-red)]">
          {priceError}
        </p>
      ) : null}
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
