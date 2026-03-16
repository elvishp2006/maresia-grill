import { useState } from 'react';
import type { Item } from '../types';
import BottomSheet from './BottomSheet';
import AddForm from './AddForm';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useModal } from '../contexts/ModalContext';

interface ItemRowProps {
  item: Item;
  active: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (newNome: string) => void;
  mode: 'select' | 'manage';
}

export default function ItemRow({ item, active, onToggle, onRemove, onRename, mode }: ItemRowProps) {
  const [showRenameSheet, setShowRenameSheet] = useState(false);
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();

  const handleRemove = async () => {
    const ok = await confirm('Remover item', `Remover "${item.nome}"?`);
    if (ok) {
      mediumTap();
      onRemove();
    }
  };

  const handleToggle = () => {
    lightTap();
    onToggle();
  };

  if (mode === 'select') {
    return (
      <li className={`item rounded-[20px] border px-[12px] py-[12px] transition-colors ${active ? 'active border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--bg-elevated)]'}`}>
        <button
          type="button"
          className="flex w-full items-center gap-[12px] text-left"
          onClick={handleToggle}
          aria-pressed={active}
          aria-label={`${active ? 'Remover' : 'Adicionar'} ${item.nome} do menu do dia`}
        >
          <span
            className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border text-[15px] font-bold transition-colors ${active ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]' : 'border-[var(--border-strong)] text-transparent'}`}
            aria-hidden="true"
          >
            ✓
          </span>
          <span className={`flex-1 text-[15px] leading-[1.45] ${active ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
            {item.nome}
          </span>
        </button>
      </li>
    );
  }

  return (
    <>
      <li className="item rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] py-[12px]">
        <div className="flex items-center gap-[12px]">
          <span
            className={`flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full border text-[15px] font-bold transition-colors ${active ? 'border-[var(--green)] bg-[var(--green)] text-[var(--bg)]' : 'border-[var(--border-strong)] text-transparent'}`}
            aria-hidden="true"
          >
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium leading-[1.4] text-[var(--text)]">
              {item.nome}
            </p>
            <p className="mt-[2px] text-[13px] text-[var(--text-dim)]">
              {active ? 'Ja aparece no menu do dia' : 'Ainda nao selecionado'}
            </p>
          </div>
        </div>
        <div className="mt-[12px] flex gap-[8px]">
          <button
            type="button"
            className="min-h-[42px] flex-1 rounded-[14px] border border-[var(--border)] px-[12px] text-[13px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
            onClick={() => {
              lightTap();
              setShowRenameSheet(true);
            }}
            aria-label={`Renomear ${item.nome}`}
          >
            Renomear
          </button>
          <button
            type="button"
            className="min-h-[42px] flex-1 rounded-[14px] border border-[var(--accent-red)] px-[12px] text-[13px] font-semibold text-[var(--accent-red)] transition-opacity hover:opacity-90"
            onClick={handleRemove}
            aria-label={`Remover ${item.nome}`}
          >
            Remover
          </button>
        </div>
      </li>

      <BottomSheet
        open={showRenameSheet}
        onClose={() => setShowRenameSheet(false)}
        title={`Renomear ${item.nome}`}
        description="Atualize o nome do item no catalogo."
      >
        <AddForm
          onAdd={(nome) => {
            onRename(nome);
            setShowRenameSheet(false);
          }}
          onClose={() => setShowRenameSheet(false)}
          initialValue={item.nome}
          placeholder={item.nome}
          submitLabel="Salvar"
        />
      </BottomSheet>
    </>
  );
}
