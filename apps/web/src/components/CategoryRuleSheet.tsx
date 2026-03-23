import { useState } from 'react';
import type { CategoryEntry, CategorySelectionRule } from '../types';
import BottomSheet from './BottomSheet';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { getLinkedCategories, type CategorySelectionRuleInput } from '../lib/categorySelectionRules';

const DEFAULT_LIMIT = 1;
const BTN_ACTIVE_CLS = 'neon-gold-fill border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]';
const BTN_INACTIVE_CLS = 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]';

interface CategoryRuleSheetProps {
  open: boolean;
  onClose: () => void;
  categoria: CategoryEntry;
  categoryRule?: CategorySelectionRule | null;
  allCategoryRules: CategorySelectionRule[];
  availableLinkedCategories: CategoryEntry[];
  onSave: (input: CategorySelectionRuleInput) => void;
  isOnline: boolean;
}

export default function CategoryRuleSheet({
  open,
  onClose,
  categoria,
  categoryRule,
  allCategoryRules,
  availableLinkedCategories,
  onSave,
  isOnline,
}: CategoryRuleSheetProps) {
  const { lightTap } = useHapticFeedback();
  const [draftMinSelections, setDraftMinSelections] = useState<number | null>(categoryRule?.minSelections ?? null);
  const [draftMaxSelections, setDraftMaxSelections] = useState<number | null>(categoryRule?.maxSelections ?? null);
  const [draftLinkedCategories, setDraftLinkedCategories] = useState<string[]>(() => getLinkedCategories(categoria.name, allCategoryRules));
  const [draftAllowRepeatedItems, setDraftAllowRepeatedItems] = useState(Boolean(categoryRule?.allowRepeatedItems));

  const handleToggleLinkedCategory = (targetCategory: CategoryEntry) => {
    lightTap();
    setDraftLinkedCategories(prev => (
      prev.includes(targetCategory.name)
        ? prev.filter(name => name !== targetCategory.name)
        : [...prev, targetCategory.name]
    ));
  };

  const handleIncrementMinLimit = () => {
    lightTap();
    setDraftMinSelections(prev => {
      const next = Math.max(1, (prev ?? DEFAULT_LIMIT) + 1);
      setDraftMaxSelections(max => (max !== null && max < next ? next : max));
      return next;
    });
  };

  const handleDecrementMinLimit = () => {
    lightTap();
    setDraftMinSelections(prev => {
      const nextValue = (prev ?? DEFAULT_LIMIT) - 1;
      return nextValue < 1 ? 1 : nextValue;
    });
  };

  const handleIncrementLimit = () => {
    lightTap();
    setDraftMaxSelections(prev => Math.max(1, (prev ?? DEFAULT_LIMIT) + 1));
  };

  const handleDecrementLimit = () => {
    lightTap();
    setDraftMaxSelections(prev => {
      const nextValue = (prev ?? DEFAULT_LIMIT) - 1;
      const clamped = nextValue < 1 ? 1 : nextValue;
      setDraftMinSelections(min => (min !== null && min > clamped ? clamped : min));
      return clamped;
    });
  };

  const handleSave = () => {
    if (!isOnline || (draftMaxSelections === null && draftMinSelections === null)) return;
    lightTap();
    onSave({
      minSelections: draftMinSelections,
      maxSelections: draftMaxSelections,
      sharedLimitGroupId: categoryRule?.sharedLimitGroupId ?? null,
      linkedCategories: draftLinkedCategories,
      allowRepeatedItems: draftAllowRepeatedItems ? true : undefined,
    });
    onClose();
  };

  const handleClear = () => {
    if (!isOnline) return;
    lightTap();
    onSave({
      minSelections: null,
      maxSelections: null,
      sharedLimitGroupId: null,
      linkedCategories: [],
      allowRepeatedItems: false,
    });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Limite de ${categoria.name}`}
      description="Defina quantos itens o cliente pode escolher e, se quiser, vincule outras categorias ao mesmo limite."
    >
      <div className="space-y-[16px]">
        <section className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-[14px]">
          <div className="flex items-start justify-between gap-[12px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                Repetição do mesmo item
              </p>
              <p className="mt-[6px] text-[13px] leading-[1.6] text-[var(--text-dim)]">
                Quando ativo, o cliente pode aumentar a quantidade do mesmo item no pedido público.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draftAllowRepeatedItems}
              aria-label={`Permitir repetir itens em ${categoria.name}`}
              className={`relative inline-flex h-[34px] w-[60px] shrink-0 items-center rounded-full border transition-colors ${
                draftAllowRepeatedItems
                  ? 'neon-gold-border border-[var(--accent)] bg-[rgba(215,176,92,0.28)]'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)]'
              } disabled:cursor-not-allowed disabled:opacity-45`}
              onClick={() => {
                lightTap();
                setDraftAllowRepeatedItems(prev => !prev);
              }}
              disabled={!isOnline}
            >
              <span
                className={`absolute left-[4px] h-[24px] w-[24px] rounded-full bg-[var(--text)] shadow-[0_6px_14px_rgba(0,0,0,0.18)] transition-transform ${
                  draftAllowRepeatedItems ? 'translate-x-[26px]' : 'translate-x-0'
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        <section className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-[14px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Quantidade mínima
          </p>
          <div className="mt-[12px] flex items-center gap-[10px]">
            <button
              type="button"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[22px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleDecrementMinLimit}
              disabled={!isOnline || draftMinSelections === null || draftMinSelections <= 1}
              aria-label={`Diminuir minimo de ${categoria.name}`}
            >
              -
            </button>
            <div className="flex min-h-[52px] flex-1 items-center justify-center rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[14px] text-[20px] font-semibold text-[var(--text)]">
              {draftMinSelections ?? 'Sem mínimo'}
            </div>
            <button
              type="button"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[22px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleIncrementMinLimit}
              disabled={!isOnline}
              aria-label={`Aumentar minimo de ${categoria.name}`}
            >
              +
            </button>
          </div>
          <div className="mt-[12px] flex gap-[8px]">
            {[1, 2, 3].map(value => (
              <button
                key={value}
                type="button"
                className={`min-h-[38px] rounded-full border px-[14px] text-[13px] font-semibold transition-colors ${
                  draftMinSelections === value ? BTN_ACTIVE_CLS : BTN_INACTIVE_CLS
                }`}
                onClick={() => {
                  lightTap();
                  setDraftMinSelections(value);
                  setDraftMaxSelections(max => (max !== null && max < value ? value : max));
                }}
                disabled={!isOnline}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              className={`min-h-[38px] rounded-full border px-[14px] text-[13px] font-semibold transition-colors ${
                draftMinSelections === null ? BTN_ACTIVE_CLS : BTN_INACTIVE_CLS
              }`}
              onClick={() => {
                lightTap();
                setDraftMinSelections(null);
              }}
              disabled={!isOnline}
            >
              Sem mínimo
            </button>
          </div>
        </section>

        <section className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-[14px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Quantidade máxima
          </p>
          <div className="mt-[12px] flex items-center gap-[10px]">
            <button
              type="button"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[22px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleDecrementLimit}
              disabled={!isOnline || draftMaxSelections === null || draftMaxSelections <= 1}
              aria-label={`Diminuir limite de ${categoria.name}`}
            >
              -
            </button>
            <div className="flex min-h-[52px] flex-1 items-center justify-center rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[14px] text-[20px] font-semibold text-[var(--text)]">
              {draftMaxSelections ?? 'Sem limite'}
            </div>
            <button
              type="button"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[22px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleIncrementLimit}
              disabled={!isOnline}
              aria-label={`Aumentar limite de ${categoria.name}`}
            >
              +
            </button>
          </div>
          <div className="mt-[12px] flex gap-[8px]">
            {[1, 2, 3, 4].map(value => (
              <button
                key={value}
                type="button"
                className={`min-h-[38px] rounded-full border px-[14px] text-[13px] font-semibold transition-colors ${
                  draftMaxSelections === value ? BTN_ACTIVE_CLS : BTN_INACTIVE_CLS
                }`}
                onClick={() => {
                  lightTap();
                  setDraftMaxSelections(value);
                  setDraftMinSelections(min => (min !== null && min > value ? value : min));
                }}
                disabled={!isOnline}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              className={`min-h-[38px] rounded-full border px-[14px] text-[13px] font-semibold transition-colors ${
                draftMaxSelections === null ? BTN_ACTIVE_CLS : BTN_INACTIVE_CLS
              }`}
              onClick={() => {
                lightTap();
                setDraftMaxSelections(null);
                setDraftLinkedCategories([]);
              }}
              disabled={!isOnline}
            >
              Sem limite
            </button>
          </div>
        </section>

        <section className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] p-[14px]">
          <div className="flex items-start justify-between gap-[10px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                Compartilhar com outras categorias
              </p>
              <p className="mt-[6px] text-[13px] leading-[1.6] text-[var(--text-dim)]">
                As categorias marcadas usam o mesmo limite total do pedido publico.
              </p>
            </div>
            <span className="neon-gold-text rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-[10px] py-[5px] text-[12px] font-semibold text-[var(--accent)]">
              {draftLinkedCategories.length}
            </span>
          </div>
          <div className="mt-[12px] flex flex-wrap gap-[8px]">
            {availableLinkedCategories.length === 0 ? (
              <p className="text-[13px] text-[var(--text-dim)]">
                Crie outra categoria para usar limite compartilhado.
              </p>
            ) : availableLinkedCategories.map(category => {
              const active = draftLinkedCategories.includes(category.name);
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`min-h-[42px] rounded-[16px] border px-[14px] text-[13px] font-semibold transition-colors ${
                    active ? BTN_ACTIVE_CLS : BTN_INACTIVE_CLS
                  }`}
                  onClick={() => handleToggleLinkedCategory(category)}
                  disabled={!isOnline || draftMaxSelections === null}
                  aria-pressed={active}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex gap-[10px]">
          <button
            type="button"
            className="min-h-[52px] flex-1 rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[18px] text-[15px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleClear}
            disabled={!isOnline}
          >
            Limpar regra
          </button>
          <button
            type="button"
            className="neon-gold-fill min-h-[52px] flex-1 rounded-[18px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleSave}
            disabled={!isOnline || (draftMinSelections === null && draftMaxSelections === null && !draftAllowRepeatedItems)}
          >
            Salvar limite
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
