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
import { useEditorLock } from './hooks/useEditorLock';
import { LOCK_TIMEOUT_MS } from './lib/storage';

interface AuthenticatedAppProps {
  onSignOut: () => void;
  userEmail?: string | null;
}

function AuthenticatedApp({ onSignOut, userEmail }: AuthenticatedAppProps) {
  const { isOnline } = useOnlineStatus();
  const { showToast } = useToast();
  const { confirm } = useModal();
  const {
    canEdit,
    lock,
    isExpired,
    error: editorLockError,
    requestEditAccess,
    releaseEditAccess,
  } = useEditorLock(userEmail, isOnline);
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
  } = useMenuState(isOnline, canEdit);

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
    if (ok) {
      await releaseEditAccess();
      onSignOut();
    }
  };

  if (loading) return <LoadingSpinner />;

  const isReadOnly = isOnline && !canEdit;
  const canTakeOver = isReadOnly && isExpired;
  const hasEditorLockPermissionIssue = editorLockError?.toLowerCase().includes('permission') ?? false;

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

      {isReadOnly ? (
        <section className="section-card mb-[18px] border border-[var(--accent)] bg-[var(--accent-soft)]">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
            Leitura somente
          </p>
          <p className="mt-[8px] text-[14px] leading-[1.6] text-[var(--text)]">
            {hasEditorLockPermissionIssue
              ? 'O controle de edição não conseguiu acessar o documento de lock no Firestore.'
              : isExpired
                ? `${lock?.userEmail ?? 'Outra pessoa'} ficou com a edição travada em ${lock?.deviceLabel ?? 'outro dispositivo'}.`
                : `${lock?.userEmail ?? 'Outra pessoa'} está editando em ${lock?.deviceLabel ?? 'outro dispositivo'}.`}
          </p>
          <p className="mt-[6px] text-[13px] leading-[1.5] text-[var(--text-dim)]">
            {hasEditorLockPermissionIssue
              ? 'Publique as regras mais recentes do Firestore para liberar leitura e escrita em config/editorLock.'
              : isExpired
                ? 'A sessão anterior expirou. Você já pode assumir a edição.'
                : `Se essa sessão parar de responder, o bloqueio expira em até ${Math.ceil(LOCK_TIMEOUT_MS / 1000)}s.`}
          </p>
          {canTakeOver && !hasEditorLockPermissionIssue ? (
            <button
              type="button"
              className="neon-gold-fill mt-[14px] min-h-[48px] rounded-[18px] bg-[var(--accent)] px-[18px] text-[14px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
              onClick={() => {
                void requestEditAccess().then((granted) => {
                  if (!granted) showToast('Nao foi possivel assumir a edição.', 'error');
                });
              }}
            >
              Assumir edição
            </button>
          ) : null}
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
        canEdit={canEdit}
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
