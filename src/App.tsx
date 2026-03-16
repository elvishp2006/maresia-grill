import { useMemo, useState } from 'react';
import './App.css';
import { formatMenuText, normalize } from './utils';
import { useMenuState } from './hooks/useMenuState';
import Header from './components/Header';
import CategoryCard from './components/CategoryCard';
import Toolbar from './components/Toolbar';
import AddForm from './components/AddForm';
import BottomSheet from './components/BottomSheet';
import LoadingSpinner from './components/LoadingSpinner';
import AuthScreen from './components/AuthScreen';
import InstallBanner from './components/InstallBanner';
import InsightsPanel from './components/InsightsPanel';
import UpdateBanner from './components/UpdateBanner';
import { useAuthSession } from './hooks/useAuthSession';
import { useMenuInsights } from './hooks/useMenuInsights';
import { useOnlineStatus } from './hooks/useOnlineStatus';

interface AuthenticatedAppProps {
  onSignOut: () => void;
  userEmail?: string | null;
}

function AuthenticatedApp({ onSignOut, userEmail }: AuthenticatedAppProps) {
  const { isOnline } = useOnlineStatus();
  const {
    categories,
    complements,
    daySelection,
    usageCounts,
    sortMode,
    loading,
    toggleSortMode,
    toggleItem,
    addItem,
    removeItem,
    renameItem,
    addCategory,
    removeCategory,
    moveCategory,
  } = useMenuState(isOnline);

  const insights = useMenuInsights(complements, daySelection, isOnline);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'menu' | 'stats' | 'manage'>('menu');
  const [manualExpandedCategory, setManualExpandedCategory] = useState<string | null | undefined>(undefined);
  const [showAddCategorySheet, setShowAddCategorySheet] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(188);

  const visibleCategories = useMemo(() => {
    if (!search.trim()) return categories;

    const normalized = normalize(search.trim());
    return categories.filter(categoria => {
      if (normalize(categoria).includes(normalized)) return true;
      return complements.some(
        item => item.categoria === categoria && normalize(item.nome).includes(normalized)
      );
    });
  }, [categories, complements, search]);

  const expandedCategory = useMemo(() => {
    if (visibleCategories.length === 0) return null;
    if (manualExpandedCategory === null) return null;
    if (manualExpandedCategory && visibleCategories.includes(manualExpandedCategory)) {
      return manualExpandedCategory;
    }
    return visibleCategories[0];
  }, [manualExpandedCategory, visibleCategories]);

  const now = new Date();
  const dateShort = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const copyMenu = async () => {
    const text = formatMenuText(complements, daySelection, categories);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      alert(text);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="app-shell">
      <Header
        activeCount={daySelection.length}
        dateShort={dateShort}
        onCopy={copyMenu}
        isOnline={isOnline}
        onSignOut={onSignOut}
        userEmail={userEmail}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onHeightChange={setHeaderHeight}
      />

      {!isOnline ? (
        <section className="section-card mb-[18px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)]">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--accent-red)]">
            Sem internet
          </p>
          <p className="mt-[8px] text-[14px] leading-[1.6] text-[var(--text)]">
            Edição, seleção do menu e estatísticas estão indisponíveis até a conexão voltar.
          </p>
        </section>
      ) : null}

      {viewMode !== 'stats' ? (
        <Toolbar
          search={search}
          onSearchChange={setSearch}
          sortMode={sortMode}
          onToggleSort={toggleSortMode}
          viewMode={viewMode}
          stickyTop={headerHeight}
        />
      ) : null}

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
              onSelectSuggestion={toggleItem}
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
              Ajuste a busca ou mude para o modo de edição para cadastrar novos itens.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
            {visibleCategories.map(categoria => (
              <CategoryCard
                key={`${categoria}-${viewMode}-${search ? 'filtered' : 'default'}`}
                categoria={categoria}
                items={complements.filter(item => item.categoria === categoria)}
                daySelection={daySelection}
                onToggle={toggleItem}
                onAdd={addItem}
                onRemove={removeItem}
                onRename={renameItem}
                search={search}
                sortMode={sortMode}
                usageCounts={usageCounts}
                onMoveUp={() => moveCategory(categoria, 'up')}
                onMoveDown={() => moveCategory(categoria, 'down')}
                onRemoveCategory={() => removeCategory(categoria)}
                isFirst={categories.indexOf(categoria) === 0}
                isLast={categories.indexOf(categoria) === categories.length - 1}
                viewMode={viewMode === 'menu' ? 'select' : 'manage'}
                expanded={expandedCategory === categoria}
                onToggleCollapse={() => setManualExpandedCategory(expandedCategory === categoria ? null : categoria)}
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
            addCategory(nome);
            setShowAddCategorySheet(false);
          }}
          onClose={() => setShowAddCategorySheet(false)}
          placeholder="Nome da categoria"
          disabled={!isOnline}
        />
      </BottomSheet>

      <UpdateBanner />
      <InstallBanner />
    </div>
  );
}

export default function App() {
  const {
    user,
    loading,
    isAuthorized,
    authError,
    signInPending,
    signIn,
    signOut,
  } = useAuthSession();

  if (loading) return <LoadingSpinner />;

  if (!user) {
    return (
      <AuthScreen
        mode="sign-in"
        error={authError}
        onPrimaryAction={() => { void signIn(); }}
        primaryActionLabel={signInPending ? 'Entrando...' : 'Entrar com Google'}
        primaryDisabled={signInPending}
      />
    );
  }

  if (!isAuthorized) {
    return (
      <AuthScreen
        mode="unauthorized"
        email={user.email}
        error={authError}
        onPrimaryAction={() => { void signOut(); }}
        primaryActionLabel="Sair"
      />
    );
  }

  return <AuthenticatedApp onSignOut={() => { void signOut(); }} userEmail={user.email} />;
}
