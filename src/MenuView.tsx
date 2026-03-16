import { useState } from 'react';
import type { Categoria, Item } from './types';
import CategoryCard from './components/CategoryCard';
import AddForm from './components/AddForm';
import BottomSheet from './components/BottomSheet';
import InsightsPanel from './components/InsightsPanel';
import type { useMenuInsights } from './hooks/useMenuInsights';

interface MenuViewProps {
  viewMode: 'menu' | 'stats' | 'manage';
  visibleCategories: Categoria[];
  categories: Categoria[];
  complements: Item[];
  daySelection: string[];
  usageCounts: Record<string, number>;
  sortMode: 'alpha' | 'usage';
  search: string;
  expandedCategory: string | null;
  onToggleCollapse: (categoria: string) => void;
  isOnline: boolean;
  insights: ReturnType<typeof useMenuInsights>;
  onToggle: (id: string) => void;
  onAddItem: (nome: string, categoria: Categoria) => void;
  onRemoveItem: (id: string) => void;
  onRenameItem: (id: string, newNome: string) => void;
  onMoveCategory: (categoria: Categoria, dir: 'up' | 'down') => void;
  onRemoveCategory: (categoria: Categoria) => void;
  onAddCategory: (nome: string) => void;
  onClearSearch: () => void;
}

export default function MenuView({
  viewMode,
  visibleCategories,
  categories,
  complements,
  daySelection,
  usageCounts,
  sortMode,
  search,
  expandedCategory,
  onToggleCollapse,
  isOnline,
  insights,
  onToggle,
  onAddItem,
  onRemoveItem,
  onRenameItem,
  onMoveCategory,
  onRemoveCategory,
  onAddCategory,
  onClearSearch,
}: MenuViewProps) {
  const [showAddCategorySheet, setShowAddCategorySheet] = useState(false);
  const [showQuickAddSheet, setShowQuickAddSheet] = useState(false);
  const [quickAddCategory, setQuickAddCategory] = useState<Categoria | null>(null);

  return (
    <>
      <main className="pb-[24px]">
        <section className="section-card mb-[18px]">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
            {viewMode === 'menu' ? 'Fluxo principal' : viewMode === 'stats' ? 'Área analítica' : 'Modo administrativo'}
          </p>
          <p className="mt-[8px] max-w-[56ch] text-[15px] leading-[1.6] text-[var(--text)]">
            {viewMode === 'menu'
              ? daySelection.length === 0
                ? 'Toque nos itens para montar rapidamente o menu de hoje.'
                : `${daySelection.length} ${daySelection.length === 1 ? 'item' : 'itens'} no menu de hoje.`
              : viewMode === 'stats'
                ? 'Consulte sugestões e histórico sem interferir no fluxo principal de seleção.'
                : 'Organize categorias e mantenha o catálogo atualizado sem poluir a tela principal.'}
          </p>
        </section>

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
              <h2 className="font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
                Estatísticas indisponíveis
              </h2>
              <p className="mt-[8px] text-[15px] leading-[1.5] text-[var(--text-dim)]">
                Conecte-se a internet para consultar sugestões e histórico.
              </p>
            </section>
          )
        ) : visibleCategories.length === 0 ? (
          <section className="section-card border-dashed text-center">
            <h2 className="font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
              Nada encontrado
            </h2>
            <p className="mt-[8px] text-[15px] leading-[1.5] text-[var(--text-dim)]">
              {search.trim()
                ? `Nenhum resultado para "${search}".`
                : 'Ajuste a busca para encontrar itens.'}
            </p>
            {search.trim() && isOnline && categories.length > 0 ? (
              <button
                type="button"
                className="mt-[16px] min-h-[48px] rounded-[22px] border border-[var(--accent)] bg-transparent px-[20px] text-[14px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--bg)]"
                onClick={() => setShowQuickAddSheet(true)}
              >
                + Cadastrar "{search}" no catálogo
              </button>
            ) : null}
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
            {visibleCategories.map(categoria => (
              <CategoryCard
                key={`${categoria}-${viewMode}-${search ? 'filtered' : 'default'}`}
                categoria={categoria}
                items={complements.filter(item => item.categoria === categoria)}
                daySelection={daySelection}
                onToggle={onToggle}
                onAdd={onAddItem}
                onRemove={onRemoveItem}
                onRename={onRenameItem}
                search={search}
                sortMode={sortMode}
                usageCounts={usageCounts}
                onMoveUp={() => onMoveCategory(categoria, 'up')}
                onMoveDown={() => onMoveCategory(categoria, 'down')}
                onRemoveCategory={() => onRemoveCategory(categoria)}
                isFirst={categories.indexOf(categoria) === 0}
                isLast={categories.indexOf(categoria) === categories.length - 1}
                viewMode={viewMode === 'menu' ? 'select' : 'manage'}
                expanded={expandedCategory === categoria}
                onToggleCollapse={() => onToggleCollapse(categoria)}
                isOnline={isOnline}
              />
            ))}
          </div>
        )}

        {viewMode === 'manage' ? (
          <button
            type="button"
            className="mt-[18px] min-h-[56px] w-full rounded-[22px] border border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] px-[18px] text-[15px] font-semibold text-[var(--accent)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => setShowAddCategorySheet(true)}
            disabled={!isOnline}
          >
            + Nova categoria
          </button>
        ) : null}
      </main>

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
          disabled={!isOnline}
        />
      </BottomSheet>

      <BottomSheet
        open={showQuickAddSheet}
        onClose={() => { setShowQuickAddSheet(false); setQuickAddCategory(null); }}
        title={quickAddCategory ? `Novo item em ${quickAddCategory}` : 'Em qual categoria?'}
        description={quickAddCategory ? undefined : 'Escolha onde cadastrar o novo item.'}
      >
        {quickAddCategory ? (
          <AddForm
            initialValue={search}
            onAdd={(nome) => {
              onAddItem(nome, quickAddCategory);
              onClearSearch();
              setShowQuickAddSheet(false);
              setQuickAddCategory(null);
            }}
            onClose={() => { setShowQuickAddSheet(false); setQuickAddCategory(null); }}
          />
        ) : (
          <ul className="flex flex-col gap-[10px]">
            {categories.map(cat => (
              <li key={cat}>
                <button
                  type="button"
                  className="w-full rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[16px] py-[14px] text-left text-[15px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                  onClick={() => setQuickAddCategory(cat)}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
