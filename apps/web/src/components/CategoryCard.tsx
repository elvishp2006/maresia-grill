import { useEffect, useRef, useState } from 'react';
import type { CategoryEntry, CategorySelectionRule, Item } from '../types';
import type { RefObject } from 'react';
import ItemList from './ItemList';
import ItemEditorForm from './ItemEditorForm';
import BottomSheet from './BottomSheet';
import CategoryRuleSheet from './CategoryRuleSheet';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useModal } from '../hooks/useModal';
import {
  describeCategorySelectionRule,
  type CategorySelectionRuleInput,
} from '../lib/categorySelectionRules';

interface CategoryCardProps {
  categoria: CategoryEntry;
  items: Item[];
  allCategories: CategoryEntry[];
  categoryRule?: CategorySelectionRule | null;
  allCategoryRules?: CategorySelectionRule[];
  daySelection: string[];
  onToggle: (id: string) => void;
  onAdd: (nome: string, categoriaId: string, priceCents?: number | null) => void;
  onRemove: (id: string) => void;
  onUpdateItem?: (id: string, input: { nome: string; priceCents: number }) => void;
  onUpdateItemAlwaysActive?: (itemId: string, alwaysActive: boolean) => void;
  onRename?: (id: string, newNome: string) => void;
  onRenameCategory?: (id: string, newName: string) => void;
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

interface CategoryManageHeaderProps {
  categoria: CategoryEntry;
  selectedCount: number;
  itemCount: number;
  isFirst: boolean;
  isLast: boolean;
  isOnline: boolean;
  isRenaming: boolean;
  draftName: string;
  expanded: boolean;
  ruleSummary: string | null | undefined;
  categoryRule?: CategorySelectionRule | null;
  onUpdateExcludeFromShare?: (excl: boolean) => void;
  onRenameCategory?: (id: string, name: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onExpandToggle: () => void;
  onStartRename: () => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onRemoveCategory: () => void;
  onSetDraftName: (name: string) => void;
  renameInputRef: RefObject<HTMLInputElement | null>;
  onLightTap: () => void;
}

function CategoryExcludeButton({
  categoria,
  categoryRule,
  isOnline,
  onUpdateExcludeFromShare,
  onLightTap,
}: {
  categoria: CategoryEntry;
  categoryRule?: CategorySelectionRule | null;
  isOnline: boolean;
  onUpdateExcludeFromShare: (excl: boolean) => void;
  onLightTap: () => void;
}) {
  const excluded = categoryRule?.excludeFromShare === true;
  return (
    <button
      type="button"
      className={`flex h-[36px] w-[36px] items-center justify-center rounded-full border transition-colors ${
        excluded
          ? 'border-[var(--accent)] bg-[rgba(215,176,92,0.16)] text-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)]'
      } disabled:cursor-not-allowed disabled:opacity-40`}
      onClick={() => { onLightTap(); onUpdateExcludeFromShare(!excluded); }}
      aria-pressed={excluded}
      aria-label={excluded
        ? `Incluir ${categoria.name} no texto compartilhado`
        : `Excluir ${categoria.name} do texto compartilhado`}
      disabled={!isOnline}
    >
      {excluded ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

function CategoryManageHeader({
  categoria,
  selectedCount,
  itemCount,
  isFirst,
  isLast,
  isOnline,
  isRenaming,
  draftName,
  expanded,
  ruleSummary,
  categoryRule,
  onUpdateExcludeFromShare,
  onRenameCategory,
  onMoveUp,
  onMoveDown,
  onExpandToggle,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onRemoveCategory,
  onSetDraftName,
  renameInputRef,
  onLightTap,
}: CategoryManageHeaderProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); onConfirmRename(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancelRename(); }
  };

  return (
    <div className="flex items-start gap-[10px]">
      <div className="flex shrink-0 flex-col gap-[6px] pt-[4px]">
        <button
          type="button"
          className="flex h-[32px] w-[32px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => { onLightTap(); onMoveUp?.(); }}
          disabled={isFirst || !isOnline}
          aria-label={`Mover ${categoria.name} para cima`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 15l-6-6-6 6"/>
          </svg>
        </button>
        <button
          type="button"
          className="flex h-[32px] w-[32px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => { onLightTap(); onMoveDown?.(); }}
          disabled={isLast || !isOnline}
          aria-label={`Mover ${categoria.name} para baixo`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-[14px]">
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={draftName}
                onChange={(e) => onSetDraftName(e.target.value)}
                onBlur={onConfirmRename}
                onKeyDown={handleKeyDown}
                aria-label="Nome da categoria"
                className="w-full overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-display)] text-[22px] font-bold text-[var(--text)] bg-transparent border-b border-[var(--accent)] outline-none"
              />
            ) : (
              <button
                type="button"
                className="w-full bg-transparent text-left"
                onClick={onExpandToggle}
                aria-expanded={expanded}
                aria-label={expanded ? `Colapsar ${categoria.name}` : `Expandir ${categoria.name}`}
              >
                <h2 className="overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-display)] text-[22px] font-bold text-[var(--text)]">
                  {categoria.name}
                </h2>
              </button>
            )}
            <p className="mt-[6px] text-[12px] leading-[1.5] text-[var(--text-dim)]">
              {selectedCount}/{itemCount} itens
            </p>
            <p className={`mt-[6px] text-[11px] leading-[1.5] ${categoryRule && (ruleSummary || categoryRule.allowRepeatedItems) ? 'text-[var(--accent)]' : 'text-[var(--text-dim)]'}`}>
              {ruleSummary ?? (categoryRule?.allowRepeatedItems ? 'Sem limite e permite repetir item' : 'Sem limite no pedido público')}
            </p>
          </div>
          {!isRenaming ? (
            <div className="flex shrink-0 items-center gap-[6px]">
              {onUpdateExcludeFromShare ? (
                <CategoryExcludeButton
                  categoria={categoria}
                  categoryRule={categoryRule}
                  isOnline={isOnline}
                  onUpdateExcludeFromShare={onUpdateExcludeFromShare}
                  onLightTap={onLightTap}
                />
              ) : null}
              {onRenameCategory ? (
                <button
                  type="button"
                  onClick={onStartRename}
                  disabled={!isOnline}
                  aria-label={`Renomear ${categoria.name}`}
                  className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                className="flex h-[36px] w-[36px] items-center justify-center rounded-full border border-[var(--accent-red)] bg-[rgba(208,109,86,0.06)] text-[var(--accent-red)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={onRemoveCategory}
                aria-label={`Remover categoria ${categoria.name}`}
                disabled={!isOnline}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={onExpandToggle}
                aria-label={expanded ? `Colapsar ${categoria.name}` : `Expandir ${categoria.name}`}
                className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[16px] text-[var(--text-dim)]"
              >
                <svg
                  className={`h-[17px] w-[17px] transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
  onRenameCategory,
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
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(categoria.name);
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();
  const renameInputRef = useRef<HTMLInputElement>(null);

  const selectedCount = items.filter(item => daySelection.includes(item.id)).length;
  const ruleSummary = describeCategorySelectionRule(categoria.name, allCategoryRules);
  const availableLinkedCategories = allCategories.filter(category => category.id !== categoria.id);

  const handleRemoveCategory = async () => {
    if (!isOnline) return;
    mediumTap();
    const msg = items.length > 0
      ? `Remover também os ${items.length} itens desta categoria?`
      : 'Esta ação não pode ser desfeita.';
    const ok = await confirm(`Remover "${categoria.name}"`, msg);
    if (ok) onRemoveCategory();
  };

  const handleExpandToggle = () => { lightTap(); onToggleCollapse(); };
  const handleOpenAddSheet = () => { lightTap(); setShowAddSheet(true); };
  const handleOpenRuleSheet = () => {
    if (!onSaveCategoryRule) return;
    lightTap();
    setShowRuleSheet(true);
  };

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  const handleStartRename = () => {
    if (!isOnline || !onRenameCategory) return;
    setDraftName(categoria.name);
    setIsRenaming(true);
  };

  const handleConfirmRename = () => {
    if (!isRenaming) return;
    setIsRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== categoria.name) onRenameCategory?.(categoria.id, trimmed);
  };

  const handleCancelRename = () => { setIsRenaming(false); setDraftName(categoria.name); };

  return (
    <>
      <section className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_10px_24px_rgba(0,0,0,0.12)]">
        {viewMode === 'manage' ? (
          <CategoryManageHeader
            categoria={categoria}
            selectedCount={selectedCount}
            itemCount={items.length}
            isFirst={isFirst}
            isLast={isLast}
            isOnline={isOnline}
            isRenaming={isRenaming}
            draftName={draftName}
            expanded={expanded}
            ruleSummary={ruleSummary}
            categoryRule={categoryRule}
            onUpdateExcludeFromShare={onUpdateExcludeFromShare}
            onRenameCategory={onRenameCategory}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onExpandToggle={handleExpandToggle}
            onStartRename={handleStartRename}
            onConfirmRename={handleConfirmRename}
            onCancelRename={handleCancelRename}
            onRemoveCategory={() => void handleRemoveCategory()}
            onSetDraftName={setDraftName}
            renameInputRef={renameInputRef}
            onLightTap={lightTap}
          />
        ) : (
          <button
            type="button"
            className="w-full rounded-[20px] bg-transparent text-left"
            onClick={handleExpandToggle}
            aria-expanded={expanded}
            aria-label={expanded ? `Colapsar ${categoria.name}` : `Expandir ${categoria.name}`}
          >
            <div className="flex items-start gap-[14px]">
              <div className="min-w-0 flex-1">
                <h2 className="overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-display)] text-[22px] font-bold text-[var(--text)]">
                  {categoria.name}
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
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

                <button
                  type="button"
                  className="neon-gold-fill flex h-[40px] w-full items-center justify-center rounded-[14px] bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleOpenAddSheet}
                  aria-label={`Adicionar item em ${categoria.name}`}
                  disabled={!isOnline}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
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
        title={`Novo item em ${categoria.name}`}
        description="Adicione um complemento e ele entra selecionado no menu do dia."
      >
        <ItemEditorForm
          onSubmit={({ nome, priceCents }) => {
            onAdd(nome, categoria.id, priceCents);
            setShowAddSheet(false);
          }}
          onClose={() => setShowAddSheet(false)}
          submitLabel="Adicionar"
          disabled={!isOnline}
        />
      </BottomSheet>

      <CategoryRuleSheet
        key={String(showRuleSheet)}
        open={showRuleSheet}
        onClose={() => setShowRuleSheet(false)}
        categoria={categoria}
        categoryRule={categoryRule}
        allCategoryRules={allCategoryRules}
        availableLinkedCategories={availableLinkedCategories}
        onSave={(input) => { onSaveCategoryRule?.(input); }}
        isOnline={isOnline}
      />
    </>
  );
}
