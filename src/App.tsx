import { useMemo, useState } from 'react';
import './App.css';
import { formatMenuText, normalize } from './lib/utils';
import { useMenuState } from './hooks/useMenuState';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import LoadingSpinner from './components/LoadingSpinner';
import AuthScreen from './components/AuthScreen';
import InstallBanner from './components/InstallBanner';
import UpdateBanner from './components/UpdateBanner';
import { useAuthSession } from './hooks/useAuthSession';
import { useMenuInsights } from './hooks/useMenuInsights';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useToast } from './contexts/ToastContext';
import { useModal } from './contexts/ModalContext';
import MenuView from './MenuView';

interface AuthenticatedAppProps {
  onSignOut: () => void;
  userEmail?: string | null;
}

function AuthenticatedApp({ onSignOut, userEmail }: AuthenticatedAppProps) {
  const { isOnline } = useOnlineStatus();
  const { showToast } = useToast();
  const { confirm } = useModal();
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

  const shareMenu = async () => {
    const text = formatMenuText(complements, daySelection, categories);
    if (navigator.share) {
      await navigator.share({ title: 'Menu do Maresia Grill', text });
    } else {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Menu copiado!', 'success');
      } catch {
        alert(text);
      }
    }
  };

  const handleSignOut = async () => {
    const ok = await confirm('Sair da conta', 'Deseja encerrar a sessão?');
    if (ok) onSignOut();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="app-shell">
      <Header
        activeCount={daySelection.length}
        dateShort={dateShort}
        isOnline={isOnline}
        onSignOut={() => { void handleSignOut(); }}
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

      <MenuView
        viewMode={viewMode}
        visibleCategories={visibleCategories}
        categories={categories}
        complements={complements}
        daySelection={daySelection}
        usageCounts={usageCounts}
        sortMode={sortMode}
        search={search}
        expandedCategory={expandedCategory}
        onToggleCollapse={(categoria) => setManualExpandedCategory(expandedCategory === categoria ? null : categoria)}
        isOnline={isOnline}
        insights={insights}
        onToggle={toggleItem}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onRenameItem={renameItem}
        onMoveCategory={moveCategory}
        onRemoveCategory={removeCategory}
        onAddCategory={addCategory}
        onClearSearch={() => setSearch('')}
        onShare={shareMenu}
      />

      <UpdateBanner />
      <InstallBanner />
    </div>
  );
}

export default function App() {
  const {
    user,
    loading,
    authError,
    signInPending,
    signIn,
    signOut,
  } = useAuthSession();

  if (loading) return <LoadingSpinner />;

  if (!user) {
    return (
      <AuthScreen
        error={authError}
        onPrimaryAction={() => { void signIn(); }}
        primaryActionLabel={signInPending ? 'Entrando...' : 'Entrar com Google'}
        primaryDisabled={signInPending}
      />
    );
  }

  return <AuthenticatedApp onSignOut={() => { void signOut(); }} userEmail={user.email} />;
}
