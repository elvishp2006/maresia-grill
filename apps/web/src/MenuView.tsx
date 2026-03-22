import { useState } from 'react';
import type { CategoryEntry, CategorySelectionRule, Item } from './types';
import type { CategorySelectionRuleInput } from './lib/categorySelectionRules';
import CategoryCard from './components/CategoryCard';
import AddForm from './components/AddForm';
import BottomSheet from './components/BottomSheet';
import InsightsPanel from './components/InsightsPanel';
import type { useMenuInsights } from './hooks/useMenuInsights';
import { useHapticFeedback } from './hooks/useHapticFeedback';
import { normalize } from './lib/utils';

interface MenuViewProps {
  viewMode: 'menu' | 'stats' | 'manage' | 'orders';
  visibleCategories: CategoryEntry[];
  categories: CategoryEntry[];
  complements: Item[];
  categorySelectionRules: CategorySelectionRule[];
  daySelection: string[];
  usageCounts: Record<string, number>;
  sortMode: 'alpha' | 'usage';
  search: string;
  expandedCategory: CategoryEntry | null;
  onToggleCollapse: (categoria: CategoryEntry) => void;
  isOnline: boolean;
  canEdit: boolean;
  insights: ReturnType<typeof useMenuInsights>;
  onToggle: (id: string) => void;
  onAddItem: (nome: string, categoriaId: string, priceCents?: number | null) => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, input: { nome: string; priceCents: number | null }) => void;
  onUpdateItemAlwaysActive: (itemId: string, alwaysActive: boolean) => void;
  onMoveCategory: (id: string, dir: 'up' | 'down') => void;
  onRemoveCategory: (id: string) => void;
  onAddCategory: (nome: string) => void;
  onSaveCategoryRule: (categoryEntry: CategoryEntry, input: CategorySelectionRuleInput) => void;
  onUpdateCategoryExcludeFromShare: (categoryName: string, excludeFromShare: boolean) => void;
  onRenameCategory?: (id: string, newName: string) => void;
  onClearSearch: () => void;
  onShare: () => void;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- TODO: refactor
export default function MenuView({
  viewMode,
  visibleCategories,
  categories,
  complements,
  categorySelectionRules,
  daySelection,
  usageCounts,
  sortMode,
  search,
  expandedCategory,
  onToggleCollapse,
  isOnline,
  canEdit,
  insights,
  onToggle,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onUpdateItemAlwaysActive,
  onMoveCategory,
  onRemoveCategory,
  onAddCategory,
  onSaveCategoryRule,
  onUpdateCategoryExcludeFromShare,
  onRenameCategory,
  onClearSearch,
  onShare,
}: MenuViewProps) {
  const { lightTap, success } = useHapticFeedback();
  const [showAddCategorySheet, setShowAddCategorySheet] = useState(false);
  const [showQuickAddSheet, setShowQuickAddSheet] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState<CategoryEntry | null>(null);

  const searchTerm = search.trim();
  const exactMatch = searchTerm
    ? complements.some(item => normalize(item.nome) === normalize(searchTerm))
    : false;
  const showCreateButton = Boolean(searchTerm && canEdit && categories.length > 0 && !exactMatch);

  return (
    <>
      <main className="pb-[24px]">
        {viewMode === 'stats' ? (
          isOnline ? (
            <InsightsPanel
              loading={insights.loading}
              error={insights.error}
              trackedDays={insights.trackedDays}
              weekdayLabel={insights.weekdayLabel}
              topItems={insights.topItems}
              weekdayAverages={insights.weekdayAverages}
              categoryLeaders={insights.categoryLeaders}
              streakItems={insights.streakItems}
              neglectedItems={insights.neglectedItems}
              suggestedItems={insights.suggestedItems}
              onSelectSuggestion={onToggle}
            />
          ) : (
            <section className="section-card border-dashed text-center">
              <h2 className="font-[var(--font-display)] text-[22px] font-bold text-[var(--text)]">
                Estatísticas indisponíveis
              </h2>
              <p className="mt-[8px] text-[14px] leading-[1.5] text-[var(--text-dim)]">
                Conecte-se a internet para consultar sugestões e histórico.
              </p>
            </section>
          )
        ) : visibleCategories.length === 0 ? (
          <section className="section-card border-dashed text-center">
            <h2 className="font-[var(--font-display)] text-[22px] font-bold text-[var(--text)]">
              Nada encontrado
            </h2>
            <p className="mt-[8px] text-[14px] leading-[1.5] text-[var(--text-dim)]">
              {search.trim()
                ? `Nenhum resultado para "${search}".`
                : 'Ajuste a busca para encontrar itens.'}
            </p>
            {showCreateButton ? (
              <button
                type="button"
                className="neon-gold-border neon-gold-text mt-[16px] min-h-[48px] rounded-[22px] border border-[var(--accent)] bg-transparent px-[20px] text-[14px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--bg)]"
                onClick={() => {
                  lightTap();
                  setShowQuickAddSheet(true);
                }}
              >
                + Cadastrar "{search}" no catálogo
              </button>
            ) : null}
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
            {visibleCategories.map(categoria => (
              <CategoryCard
                key={`${categoria.id}-${viewMode}-${search ? 'filtered' : 'default'}`}
                categoria={categoria}
                items={complements.filter(item => item.categoria === categoria.id)}
                allCategories={categories}
                categoryRule={categorySelectionRules.find(rule => rule.category === categoria.name) ?? null}
                allCategoryRules={categorySelectionRules}
                daySelection={daySelection}
                onToggle={onToggle}
                onAdd={onAddItem}
                onRemove={onRemoveItem}
                onUpdateItem={onUpdateItem}
                onUpdateItemAlwaysActive={onUpdateItemAlwaysActive}
                search={search}
                sortMode={sortMode}
                usageCounts={usageCounts}
                onMoveUp={() => onMoveCategory(categoria.id, 'up')}
                onMoveDown={() => onMoveCategory(categoria.id, 'down')}
                onRemoveCategory={() => onRemoveCategory(categoria.id)}
                onSaveCategoryRule={(input) => onSaveCategoryRule(categoria, input)}
                onUpdateExcludeFromShare={(excl) => onUpdateCategoryExcludeFromShare(categoria.name, excl)}
                onRenameCategory={onRenameCategory}
                isFirst={categories.findIndex(c => c.id === categoria.id) === 0}
                isLast={categories.findIndex(c => c.id === categoria.id) === categories.length - 1}
                viewMode={viewMode === 'menu' ? 'select' : 'manage'}
                expanded={expandedCategory?.id === categoria.id}
                onToggleCollapse={() => onToggleCollapse(categoria)}
                isOnline={canEdit}
              />
            ))}
          </div>
        )}

        {visibleCategories.length > 0 && showCreateButton ? (
          <button
            type="button"
            className="neon-gold-text mt-[12px] min-h-[48px] w-full rounded-[22px] border border-dashed border-[var(--accent)] bg-transparent px-[20px] text-[14px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--bg)]"
            onClick={() => { lightTap(); setShowQuickAddSheet(true); }}
          >
            + Cadastrar "{search}" no catálogo
          </button>
        ) : null}

        {viewMode === 'manage' ? (
          <button
            type="button"
            className="neon-gold-text mt-[18px] min-h-[56px] w-full rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] px-[18px] text-[14px] font-semibold text-[var(--accent)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => {
              lightTap();
              setShowAddCategorySheet(true);
            }}
            disabled={!canEdit}
          >
            + Nova categoria
          </button>
        ) : null}
      </main>

      {viewMode === 'menu' && daySelection.length > 0 ? (
        <button
          type="button"
          aria-label="Compartilhar menu"
          className="neon-gold-fill fixed bottom-[calc(env(safe-area-inset-bottom,0px)+20px)] right-[16px] z-[45] flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-all hover:opacity-90 active:scale-95"
          onClick={() => { success(); onShare(); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      ) : null}

      <BottomSheet
        open={showAddCategorySheet}
        onClose={() => setShowAddCategorySheet(false)}
        title="Nova categoria"
        description="Crie uma categoria para separar os itens do cardápio."
      >
        <AddForm
          onAdd={(nome) => {
            onAddCategory(nome);
            setShowAddCategorySheet(false);
          }}
          onClose={() => setShowAddCategorySheet(false)}
          placeholder="Nome da categoria"
          disabled={!canEdit}
          disabledMessage={canEdit ? undefined : 'Outro dispositivo está editando o cardápio neste momento.'}
        />
      </BottomSheet>

      <BottomSheet
        open={showQuickAddSheet}
        onClose={() => { setShowQuickAddSheet(false); setQuickAddCategory(null); }}
        title={quickAddCategory ? `Novo item em ${quickAddCategory.name}` : 'Em qual categoria?'}
        description={quickAddCategory ? undefined : 'Escolha onde cadastrar o novo item.'}
      >
        {quickAddCategory ? (
          <AddForm
            initialValue={search}
            onAdd={(nome) => {
              onAddItem(nome, quickAddCategory.id);
              onClearSearch();
              setShowQuickAddSheet(false);
              setQuickAddCategory(null);
            }}
            onClose={() => { setShowQuickAddSheet(false); setQuickAddCategory(null); }}
            disabled={!canEdit}
            disabledMessage="Outro dispositivo está editando o cardápio neste momento."
          />
        ) : (
          <ul className="flex flex-col gap-[10px]">
            {categories.map(cat => (
              <li key={cat.id}>
                <button
                  type="button"
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[16px] py-[14px] text-left text-[14px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                  onClick={() => {
                    lightTap();
                    setQuickAddCategory(cat);
                  }}
                  disabled={!canEdit}
                >
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
