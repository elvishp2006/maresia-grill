import { useState } from 'react';
import type { Categoria, CategorySelectionRule, Item } from '../types';
import ItemList from './ItemList';
import ItemEditorForm from './ItemEditorForm';
import BottomSheet from './BottomSheet';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useModal } from '../contexts/ModalContext';
import {
  describeCategorySelectionRule,
  getLinkedCategories,
  type CategorySelectionRuleInput,
} from '../lib/categorySelectionRules';

interface CategoryCardProps {
  categoria: Categoria;
  items: Item[];
  allCategories: Categoria[];
  categoryRule?: CategorySelectionRule | null;
  allCategoryRules?: CategorySelectionRule[];
  daySelection: string[];
  onToggle: (id: string) => void;
  onAdd: (nome: string, categoria: Categoria, priceCents?: number | null) => void;
  onRemove: (id: string) => void;
  onUpdateItem?: (id: string, input: { nome: string; priceCents: number }) => void;
  onUpdateItemAlwaysActive?: (itemId: string, alwaysActive: boolean) => void;
  onRename?: (id: string, newNome: string) => void;
  search: string;
  sortMode: 'alpha' | 'usage';
  usageCounts: Record<string, number>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemoveCategory: () => void;
  onSaveCategoryRule?: (input: CategorySelectionRuleInput) => void;
  onUpdateExcludeFromShare?: (excludeFromShare: boolean) => void;
  isFirst: boolean;
  isLast: boolean;
  viewMode: 'select' | 'manage';
  expanded: boolean;
  onToggleCollapse: () => void;
  isOnline?: boolean;
}

const DEFAULT_LIMIT = 1;
const EMPTY_RULES: CategorySelectionRule[] = [];

export default function CategoryCard({
  categoria,
  items,
  allCategories,
  categoryRule = null,
  allCategoryRules = EMPTY_RULES,
  daySelection,
  onToggle,
  onAdd,
  onRemove,
  onUpdateItem,
  onUpdateItemAlwaysActive,
  onRename,
  search,
  sortMode,
  usageCounts,
  onMoveUp,
  onMoveDown,
  onRemoveCategory,
  onSaveCategoryRule,
  onUpdateExcludeFromShare,
  isFirst,
  isLast,
  viewMode,
  expanded,
  onToggleCollapse,
  isOnline = true,
}: CategoryCardProps) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showRuleSheet, setShowRuleSheet] = useState(false);
  const [draftMinSelections, setDraftMinSelections] = useState<number | null>(categoryRule?.minSelections ?? null);
  const [draftMaxSelections, setDraftMaxSelections] = useState<number | null>(categoryRule?.maxSelections ?? null);
  const [draftLinkedCategories, setDraftLinkedCategories] = useState<string[]>(() => getLinkedCategories(categoria, allCategoryRules));
  const [draftAllowRepeatedItems, setDraftAllowRepeatedItems] = useState(Boolean(categoryRule?.allowRepeatedItems));
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();

  const selectedCount = items.filter(item => daySelection.includes(item.id)).length;
  const ruleSummary = describeCategorySelectionRule(categoria, allCategoryRules);
  const hasRule = typeof categoryRule?.maxSelections === 'number' || typeof categoryRule?.minSelections === 'number';

  const availableLinkedCategories = allCategories.filter(category => category !== categoria);

  const handleRemoveCategory = async () => {
    if (!isOnline) return;
    mediumTap();
    const msg = items.length > 0
      ? `Remover também os ${items.length} itens desta categoria?`
      : 'Esta ação não pode ser desfeita.';
    const ok = await confirm(`Remover "${categoria}"`, msg);
    if (ok) {
      onRemoveCategory();
    }
  };

  const handleExpandToggle = () => {
    lightTap();
    onToggleCollapse();
  };

  const handleOpenAddSheet = () => {
    lightTap();
    setShowAddSheet(true);
  };

  const handleOpenRuleSheet = () => {
    if (!onSaveCategoryRule) return;
    lightTap();
    setDraftMinSelections(categoryRule?.minSelections ?? null);
    setDraftMaxSelections(categoryRule?.maxSelections ?? null);
    setDraftLinkedCategories(getLinkedCategories(categoria, allCategoryRules));
    setDraftAllowRepeatedItems(Boolean(categoryRule?.allowRepeatedItems));
    setShowRuleSheet(true);
  };

  const handleToggleLinkedCategory = (targetCategory: string) => {
    lightTap();
    setDraftLinkedCategories(prev => (
      prev.includes(targetCategory)
        ? prev.filter(category => category !== targetCategory)
        : [...prev, targetCategory]
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
    setDraftMaxSelections(prev => {
      const next = Math.max(1, (prev ?? DEFAULT_LIMIT) + 1);
      return next;
    });
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

  const handleSaveCategoryRule = () => {
    if (!onSaveCategoryRule || !isOnline || (draftMaxSelections === null && draftMinSelections === null)) return;
    lightTap();
    onSaveCategoryRule({
      minSelections: draftMinSelections,
      maxSelections: draftMaxSelections,
      sharedLimitGroupId: categoryRule?.sharedLimitGroupId ?? null,
      linkedCategories: draftLinkedCategories,
      allowRepeatedItems: draftAllowRepeatedItems ? true : undefined,
    });
    setShowRuleSheet(false);
  };

  const handleClearCategoryRule = () => {
    if (!onSaveCategoryRule || !isOnline) return;
    lightTap();
    setDraftMinSelections(null);
    setDraftMaxSelections(null);
    setDraftLinkedCategories([]);
    setDraftAllowRepeatedItems(false);
    onSaveCategoryRule({
      minSelections: null,
      maxSelections: null,
      sharedLimitGroupId: null,
      linkedCategories: [],
      allowRepeatedItems: false,
    });
    setShowRuleSheet(false);
  };

  return (
    <>
      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
        {viewMode === 'manage' ? (
          <div className="flex items-start gap-[10px]">
            <div className="flex shrink-0 flex-col gap-[6px] pt-[4px]">
              <button
                type="button"
                className="flex h-[32px] w-[32px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  lightTap();
                  onMoveUp?.();
                }}
                disabled={isFirst || !isOnline}
                aria-label={`Mover ${categoria} para cima`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 15l-6-6-6 6"/>
                </svg>
              </button>
              <button
                type="button"
                className="flex h-[32px] w-[32px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  lightTap();
                  onMoveDown?.();
                }}
                disabled={isLast || !isOnline}
                aria-label={`Mover ${categoria} para baixo`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
            </div>
            <button
              type="button"
              className="min-w-0 flex-1 rounded-[20px] bg-transparent text-left"
              onClick={handleExpandToggle}
              aria-expanded={expanded}
              aria-label={expanded ? `Colapsar ${categoria}` : `Expandir ${categoria}`}
            >
              <div className="flex items-start gap-[14px]">
                <div className="min-w-0 flex-1">
                  <h2 className="overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-display)] text-[22px] font-bold text-[var(--text)]">
                    {categoria}
                  </h2>
                  <p className="mt-[6px] text-[12px] leading-[1.5] text-[var(--text-dim)]">
                    {selectedCount}/{items.length} itens
                  </p>
                <p className={`mt-[6px] text-[11px] leading-[1.5] ${hasRule ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`}>
                    {ruleSummary ?? (categoryRule?.allowRepeatedItems ? 'Sem limite e permite repetir item' : 'Sem limite no pedido público')}
                  </p>
                </div>
                <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[16px] text-[var(--text-dim)]">
                  <svg
                    className={`h-[17px] w-[17px] transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </button>
            {onUpdateExcludeFromShare ? (
              <button
                type="button"
                className={`mt-[4px] flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                  categoryRule?.excludeFromShare
                    ? 'border-[var(--accent)] bg-[rgba(215,176,92,0.16)] text-[var(--accent)]'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
                onClick={() => {
                  lightTap();
                  onUpdateExcludeFromShare(!categoryRule?.excludeFromShare);
                }}
                aria-pressed={categoryRule?.excludeFromShare === true}
                aria-label={categoryRule?.excludeFromShare
                  ? `Incluir ${categoria} no texto compartilhado`
                  : `Excluir ${categoria} do texto compartilhado`}
                disabled={!isOnline}
              >
                {categoryRule?.excludeFromShare ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="w-full rounded-[20px] bg-transparent text-left"
            onClick={handleExpandToggle}
            aria-expanded={expanded}
            aria-label={expanded ? `Colapsar ${categoria}` : `Expandir ${categoria}`}
          >
            <div className="flex items-start gap-[14px]">
              <div className="min-w-0 flex-1">
                <h2 className="overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-display)] text-[22px] font-bold text-[var(--text)]">
                  {categoria}
                </h2>
                <p className="mt-[6px] text-[12px] leading-[1.5] text-[var(--text-dim)]">
                  {selectedCount}/{items.length} itens
                </p>
                {ruleSummary ? (
                  <p className="mt-[6px] text-[11px] leading-[1.5] text-[var(--accent)]">
                    {ruleSummary}
                  </p>
                ) : null}
              </div>
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[16px] text-[var(--text-dim)]">
                <svg
                  className={`h-[17px] w-[17px] transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </button>
        )}

        {expanded ? (
          <div className="mt-[16px] border-t border-[var(--border)] pt-[16px]">
            {viewMode === 'manage' ? (
              <div className="mb-[16px] space-y-[12px]">
                <section className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-elevated)] p-[14px]">
                  <div className="flex items-start justify-between gap-[12px]">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
                        Pedido público
                      </p>
                      <p className="mt-[8px] text-[13px] leading-[1.6] text-[var(--text)]">
                        {ruleSummary ?? (categoryRule?.allowRepeatedItems ? 'Sem limite de seleção e com repetição do mesmo item liberada.' : 'Sem limite de seleção para esta categoria.')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="neon-gold-fill min-h-[42px] rounded-[16px] bg-[var(--accent)] px-[14px] text-[12px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={handleOpenRuleSheet}
                      disabled={!isOnline}
                    >
                      Configurar limite
                    </button>
                  </div>
                </section>

                <div className="flex gap-[8px]">
                  <button
                    type="button"
                    className="neon-gold-fill flex h-[40px] flex-1 items-center justify-center rounded-[14px] bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={handleOpenAddSheet}
                    aria-label={`Adicionar item em ${categoria}`}
                    disabled={!isOnline}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="flex h-[40px] w-[40px] items-center justify-center rounded-[14px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.06)] text-[var(--accent-red)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={handleRemoveCategory}
                    aria-label={`Remover categoria ${categoria}`}
                    disabled={!isOnline}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}

            <ItemList
              items={items}
              daySelection={daySelection}
              search={search}
              sortMode={sortMode}
              usageCounts={usageCounts}
              viewMode={viewMode}
              onToggle={onToggle}
              onRemove={onRemove}
              onUpdate={onUpdateItem}
              onUpdateAlwaysActive={onUpdateItemAlwaysActive}
              onRename={onRename}
              isOnline={isOnline}
            />
          </div>
        ) : null}
      </section>

      <BottomSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title={`Novo item em ${categoria}`}
        description="Adicione um complemento e ele entra selecionado no menu do dia."
      >
        <ItemEditorForm
          onSubmit={({ nome, priceCents }) => {
            onAdd(nome, categoria, priceCents);
            setShowAddSheet(false);
          }}
          onClose={() => setShowAddSheet(false)}
          submitLabel="Adicionar"
          disabled={!isOnline}
        />
      </BottomSheet>

      <BottomSheet
        open={showRuleSheet}
        onClose={() => setShowRuleSheet(false)}
        title={`Limite de ${categoria}`}
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
                aria-label={`Permitir repetir itens em ${categoria}`}
                className={`relative inline-flex h-[34px] w-[60px] shrink-0 items-center rounded-full border transition-colors ${
                  draftAllowRepeatedItems
                    ? 'border-[var(--accent)] bg-[rgba(215,176,92,0.28)]'
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
                aria-label={`Diminuir minimo de ${categoria}`}
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
                aria-label={`Aumentar minimo de ${categoria}`}
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
                    draftMinSelections === value
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                      : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]'
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
                  draftMinSelections === null
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]'
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
                aria-label={`Diminuir limite de ${categoria}`}
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
                aria-label={`Aumentar limite de ${categoria}`}
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
                    draftMaxSelections === value
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                      : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]'
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
                  draftMaxSelections === null
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]'
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
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-[10px] py-[5px] text-[12px] font-semibold text-[var(--accent)]">
                {draftLinkedCategories.length}
              </span>
            </div>
            <div className="mt-[12px] flex flex-wrap gap-[8px]">
              {availableLinkedCategories.length === 0 ? (
                <p className="text-[13px] text-[var(--text-dim)]">
                  Crie outra categoria para usar limite compartilhado.
                </p>
              ) : availableLinkedCategories.map(category => {
                const active = draftLinkedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    className={`min-h-[42px] rounded-[16px] border px-[14px] text-[13px] font-semibold transition-colors ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]'
                        : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)]'
                    }`}
                    onClick={() => handleToggleLinkedCategory(category)}
                    disabled={!isOnline || draftMaxSelections === null}
                    aria-pressed={active}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex gap-[10px]">
            <button
              type="button"
              className="min-h-[52px] flex-1 rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[18px] text-[15px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleClearCategoryRule}
              disabled={!isOnline}
            >
              Limpar regra
            </button>
            <button
              type="button"
              className="neon-gold-fill min-h-[52px] flex-1 rounded-[18px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleSaveCategoryRule}
              disabled={!isOnline || (draftMinSelections === null && draftMaxSelections === null && !draftAllowRepeatedItems)}
            >
              Salvar limite
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
