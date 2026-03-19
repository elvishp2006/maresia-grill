import { useState } from 'react';
import type { Item } from '../types';
import BottomSheet from './BottomSheet';
import ItemEditorForm from './ItemEditorForm';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useModal } from '../contexts/ModalContext';
import { formatCurrency } from '../lib/billing';

interface ItemRowProps {
  item: Item;
  active: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate?: (input: { nome: string; priceCents: number }) => void;
  onRename?: (newNome: string) => void;
  mode: 'select' | 'manage';
  isOnline?: boolean;
}

export default function ItemRow({
  item,
  active,
  onToggle,
  onRemove,
  onUpdate,
  onRename,
  mode,
  isOnline = true,
}: ItemRowProps) {
  const [showRenameSheet, setShowRenameSheet] = useState(false);
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();

  const handleRemove = async () => {
    if (!isOnline) return;
    mediumTap();
    const ok = await confirm('Remover item', `Remover "${item.nome}"?`);
    if (ok) {
      onRemove();
    }
  };

  const handleToggle = () => {
    lightTap();
    onToggle();
  };

  if (mode === 'select') {
    return (
      <li className={`item rounded-[22px] border px-[14px] py-[13px] transition-colors ${active ? 'active neon-gold-border border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_8px_18px_rgba(0,0,0,0.08)]' : 'border-[var(--border)] bg-[var(--bg-elevated)]'}`}>
        <button
          type="button"
          className="flex w-full items-center gap-[14px] text-left"
          onClick={handleToggle}
          disabled={!isOnline}
          aria-disabled={!isOnline}
          aria-pressed={active}
          aria-label={`${active ? 'Remover' : 'Adicionar'} ${item.nome} do menu do dia`}
        >
          <span
            className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border text-[15px] font-bold transition-colors ${active ? 'neon-gold-fill border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]' : 'border-[var(--border-strong)] text-transparent'}`}
            aria-hidden="true"
          >
            ✓
          </span>
          <span className={`flex-1 text-[15px] leading-[1.5] ${active ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
            {item.nome}
            {typeof item.priceCents === 'number' ? (
              <span className="mt-[4px] block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                {formatCurrency(item.priceCents)}
              </span>
            ) : null}
          </span>
        </button>
      </li>
    );
  }

  return (
    <>
      <li className="item rounded-[22px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[14px] py-[12px]">
        <div className="flex items-center gap-[14px]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium leading-[1.4] text-[var(--text)]">
              {item.nome}
            </p>
            <p className="mt-[4px] text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              {formatCurrency(item.priceCents ?? 0)}
            </p>
          </div>
          <div className="flex shrink-0 gap-[8px]">
            <button
              type="button"
              className="flex h-[36px] w-[36px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() => {
                if (!isOnline) return;
                lightTap();
                setShowRenameSheet(true);
              }}
              aria-label={`Renomear ${item.nome}`}
              disabled={!isOnline}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              type="button"
              className="flex h-[36px] w-[36px] items-center justify-center rounded-[12px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.06)] text-[var(--accent-red)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleRemove}
              aria-label={`Remover ${item.nome}`}
              disabled={!isOnline}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
      </li>

      <BottomSheet
        open={showRenameSheet}
        onClose={() => setShowRenameSheet(false)}
        title={`Renomear ${item.nome}`}
        description="Atualize o nome do item no catálogo."
      >
        <ItemEditorForm
          onSubmit={(input) => {
            if (onUpdate) {
              onUpdate(input);
              return;
            }
            onRename?.(input.nome);
          }}
          onClose={() => setShowRenameSheet(false)}
          initialName={item.nome}
          initialPriceCents={item.priceCents}
          submitLabel="Salvar"
          disabled={!isOnline}
        />
      </BottomSheet>
    </>
  );
}
