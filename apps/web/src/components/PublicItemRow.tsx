import type { Item } from '../types';
import { formatCurrency } from '../lib/billing';

interface PublicItemRowProps {
  item: Item;
  quantity: number;
  allowsRepeating: boolean;
  blockingViolation: { message: string } | null | undefined;
  submitting: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onToggle: () => void;
}

function PriceTag({ priceCents }: { priceCents?: number | null }) {
  if (typeof priceCents !== 'number' || priceCents <= 0) return null;
  return (
    <span className="neon-gold-text mt-[5px] block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
      {formatCurrency(priceCents)}
    </span>
  );
}

function BlockingMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <span className="mt-[5px] block text-[11px] leading-[1.45] text-[var(--text-dim)]">
      {message}
    </span>
  );
}

function RepeatingItemRow({
  item,
  quantity,
  blockingViolation,
  submitting,
  onDecrement,
  onIncrement,
}: Omit<PublicItemRowProps, 'allowsRepeating' | 'onToggle'>) {
  const active = quantity > 0;
  const blockingMessage = !active && blockingViolation ? blockingViolation.message : null;
  return (
    <li>
      <div
        className={`public-choice grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-[12px] px-[14px] py-[13px] ${
          blockingViolation && quantity === 0 ? 'opacity-80' : ''
        }`}
      >
        <span className="min-w-0">
          <span className={`block text-[14px] leading-[1.25] ${
            active ? 'font-semibold text-[var(--text)]' : 'font-medium text-[var(--text-muted)]'
          }`}>
            {item.nome}
          </span>
          <PriceTag priceCents={item.priceCents} />
          <BlockingMessage message={blockingMessage} />
        </span>
        <div className="flex min-w-[116px] shrink-0 items-center justify-end gap-[8px] self-center">
          <button
            type="button"
            onClick={onDecrement}
            disabled={submitting || quantity === 0}
            aria-label={`Diminuir ${item.nome}`}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[17px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            -
          </button>
          <span className="flex min-w-[26px] items-center justify-center text-[14px] font-semibold text-[var(--text)]">
            {quantity}
          </span>
          <button
            type="button"
            onClick={onIncrement}
            disabled={submitting || Boolean(blockingViolation)}
            aria-label={`Aumentar ${item.nome}`}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[17px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    </li>
  );
}

function ToggleItemRow({
  item,
  quantity,
  blockingViolation,
  submitting,
  onToggle,
}: Omit<PublicItemRowProps, 'allowsRepeating' | 'onDecrement' | 'onIncrement'>) {
  const active = quantity > 0;
  const blockingMessage = !active && blockingViolation ? blockingViolation.message : null;
  const iconCls = active
    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] shadow-[0_6px_16px_rgba(215,176,92,0.22)]'
    : blockingViolation
      ? 'border-[var(--border)] bg-[rgba(255,255,255,0.01)] text-transparent'
      : 'border-[var(--border-strong)] bg-[rgba(255,255,255,0.02)] text-transparent';
  const textCls = active
    ? 'font-semibold text-[var(--text)]'
    : blockingViolation
      ? 'font-medium text-[var(--text-dim)]'
      : 'font-medium text-[var(--text-muted)]';
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={submitting || Boolean(blockingViolation && !active)}
        aria-pressed={active}
        aria-label={`${active ? 'Remover' : 'Adicionar'} ${item.nome} do menu do dia`}
        className={`public-choice flex min-h-[68px] w-full items-center gap-[12px] px-[14px] py-[12px] text-left disabled:cursor-not-allowed ${
          blockingViolation && !active ? 'opacity-45 grayscale-[0.2]' : 'disabled:opacity-60'
        }`}
      >
        <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[12px] border text-[14px] font-bold transition-colors ${iconCls}`} aria-hidden="true">
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[14px] leading-[1.25] ${textCls}`}>
            {item.nome}
          </span>
          <PriceTag priceCents={item.priceCents} />
          <BlockingMessage message={blockingMessage} />
        </span>
      </button>
    </li>
  );
}

export default function PublicItemRow({
  item,
  quantity,
  allowsRepeating,
  blockingViolation,
  submitting,
  onDecrement,
  onIncrement,
  onToggle,
}: PublicItemRowProps) {
  if (allowsRepeating) {
    return (
      <RepeatingItemRow
        item={item}
        quantity={quantity}
        blockingViolation={blockingViolation}
        submitting={submitting}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
      />
    );
  }
  return (
    <ToggleItemRow
      item={item}
      quantity={quantity}
      blockingViolation={blockingViolation}
      submitting={submitting}
      onToggle={onToggle}
    />
  );
}
