import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { formatMenuText, normalize } from './lib/utils';
import { useMenuState } from './hooks/useMenuState';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import LoadingSpinner from './components/LoadingSpinner';
import AuthScreen from './components/AuthScreen';
import InstallBanner from './components/InstallBanner';
import { useAuthSession } from './hooks/useAuthSession';
import { useMenuInsights } from './hooks/useMenuInsights';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useToast } from './contexts/ToastContext';
import { useModal } from './contexts/ModalContext';
import MenuView from './MenuView';
import { useEditorLock } from './hooks/useEditorLock';
import { useUpdateNotification } from './hooks/useUpdateNotification';
import OrdersPanel from './components/OrdersPanel';
import BottomSheet from './components/BottomSheet';
import {
  getOrCreateDailyShareLink,
  loadPublicMenuVersions,
  setOrderIntakeStatus,
  subscribeOrderIntakeStatus,
  subscribeOrders,
  syncPublicMenuSnapshotForDate,
} from './lib/storage';
import type { OrderEntry, PublicMenuVersion } from './types';
import PublicMenuPage from './PublicMenuPage';
import NotFoundPage from './NotFoundPage';

type AppRoute =
  | { kind: 'root' }
  | { kind: 'public-menu'; token: string }
  | { kind: 'not-found' };

const resolveRoute = (pathname: string): AppRoute => {
  if (pathname === '/') return { kind: 'root' };

  const publicMenuMatch = pathname.match(/^\/s\/([^/]+)$/);
  if (publicMenuMatch?.[1]) {
    return { kind: 'public-menu', token: decodeURIComponent(publicMenuMatch[1]) };
  }

  return { kind: 'not-found' };
};

interface AuthenticatedAppProps {
  onSignOut: () => void;
  userEmail?: string | null;
}

function AuthenticatedApp({ onSignOut, userEmail }: AuthenticatedAppProps) {
  const { isOnline } = useOnlineStatus();
  const { showToast } = useToast();
  const { confirm } = useModal();
  const { needRefresh, applyUpdate } = useUpdateNotification();
  const {
    canEdit,
    lock,
    error: editorLockError,
    takeControl,
    releaseEditAccess,
  } = useEditorLock(userEmail, isOnline);
  const {
    categories,
    complements,
    daySelection,
    usageCounts,
    sortMode,
    loading,
    currentDateKey,
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
  const [viewMode, setViewMode] = useState<'menu' | 'stats' | 'manage' | 'orders'>('menu');
  const [manualExpandedCategory, setManualExpandedCategory] = useState<string | null | undefined>(undefined);
  const [headerHeight, setHeaderHeight] = useState(188);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareLinkPending, setShareLinkPending] = useState(false);
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [orderMenuVersions, setOrderMenuVersions] = useState<Record<string, PublicMenuVersion>>({});
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [orderIntakePending, setOrderIntakePending] = useState(false);

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

  const shareDailyLink = async () => {
    if (!acceptingOrders) {
      showToast('Os pedidos do dia estão encerrados.', 'info');
      return;
    }

    setShareLinkPending(true);
    try {
      const { url } = await getOrCreateDailyShareLink({
        dateKey: currentDateKey,
        categories,
        complements,
        daySelection,
      });

      if (navigator.share) {
        await navigator.share({ title: 'Menu do Maresia Grill', text: 'Faça seu pedido do dia', url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast('Link copiado!', 'success');
      }
    } catch {
      showToast('Não foi possível compartilhar o link.', 'error');
    } finally {
      setShareLinkPending(false);
      setShowShareSheet(false);
    }
  };

  const handleSignOut = async () => {
    const ok = await confirm('Sair da conta', 'Deseja encerrar a sessão?');
    if (ok) {
      await releaseEditAccess();
      onSignOut();
    }
  };

  useEffect(() => {
    setOrdersLoading(true);
    setOrdersError(false);

    const unsubscribe = subscribeOrders(currentDateKey, (nextOrders) => {
      setOrders(nextOrders);
      setOrdersLoading(false);
    }, () => {
      setOrdersError(true);
      setOrdersLoading(false);
    });

    return () => unsubscribe();
  }, [currentDateKey]);

  useEffect(() => {
    const unsubscribe = subscribeOrderIntakeStatus(currentDateKey, (nextAcceptingOrders) => {
      setAcceptingOrders(nextAcceptingOrders);
    }, () => {
      setAcceptingOrders(true);
    });

    return () => unsubscribe();
  }, [currentDateKey]);

  useEffect(() => {
    const versionIds = Array.from(new Set(
      orders
        .map(order => order.menuVersionId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ));

    if (versionIds.length === 0) {
      setOrderMenuVersions({});
      return;
    }

    let active = true;

    loadPublicMenuVersions(versionIds)
      .then((versions) => {
        if (!active) return;
        setOrderMenuVersions(versions);
      })
      .catch(() => {
        if (!active) return;
        showToast('Nao foi possivel carregar o historico confiavel dos pedidos.', 'error');
      });

    return () => {
      active = false;
    };
  }, [orders, showToast]);

  useEffect(() => {
    if (loading || !isOnline || !canEdit) return;

    syncPublicMenuSnapshotForDate({
      dateKey: currentDateKey,
      categories,
      complements,
      daySelection,
    }).catch(() => {
      showToast('Não foi possível atualizar o link público do dia.', 'error');
    });
  }, [canEdit, categories, complements, currentDateKey, daySelection, isOnline, loading, showToast]);

  if (loading) return <LoadingSpinner />;

  const isReadOnly = isOnline && !canEdit;
  const hasEditorLockPermissionIssue = editorLockError?.toLowerCase().includes('permission') ?? false;
  const canManageOrderIntake = isOnline && canEdit;

  const handleToggleOrderIntake = async () => {
    if (!canManageOrderIntake || orderIntakePending) return;

    setOrderIntakePending(true);
    try {
      await setOrderIntakeStatus({
        dateKey: currentDateKey,
        categories,
        complements,
        daySelection,
        acceptingOrders: !acceptingOrders,
      });
      showToast(
        acceptingOrders ? 'Recebimento de pedidos encerrado.' : 'Recebimento de pedidos reaberto.',
        'success'
      );
    } catch {
      showToast('Não foi possível atualizar o recebimento de pedidos.', 'error');
    } finally {
      setOrderIntakePending(false);
    }
  };

  return (
    <div className="app-shell">
      <Header
        activeCount={daySelection.length}
        dateShort={dateShort}
        isOnline={isOnline}
        onSignOut={() => { void handleSignOut(); }}
        showUpdateIndicator={needRefresh}
        onApplyUpdate={() => { void applyUpdate(); }}
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
              : `${lock?.userEmail ?? 'Outra pessoa'} está editando em ${lock?.deviceLabel ?? 'outro dispositivo'}.`}
          </p>
          <p className="mt-[6px] text-[13px] leading-[1.5] text-[var(--text-dim)]">
            {hasEditorLockPermissionIssue
              ? 'Publique as regras mais recentes do Firestore para liberar leitura e escrita em config/editorLock.'
              : 'Clique abaixo para assumir o controle da edição neste dispositivo.'}
          </p>
          {!hasEditorLockPermissionIssue ? (
            <button
              type="button"
              className="neon-gold-fill mt-[14px] min-h-[48px] rounded-[18px] bg-[var(--accent)] px-[18px] text-[14px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
              onClick={() => {
                void takeControl().then((granted) => {
                  if (!granted) showToast('Nao foi possivel assumir o controle.', 'error');
                });
              }}
            >
              Assumir controle
            </button>
          ) : null}
        </section>
      ) : null}

      {viewMode === 'menu' || viewMode === 'manage' ? (
        <Toolbar
          search={search}
          onSearchChange={setSearch}
          sortMode={sortMode}
          onToggleSort={toggleSortMode}
          viewMode={viewMode}
          stickyTop={headerHeight}
        />
      ) : null}

      {viewMode === 'orders' ? (
        <OrdersPanel
          orders={orders}
          categories={categories}
          menuVersions={orderMenuVersions}
          acceptingOrders={acceptingOrders}
          intakePending={orderIntakePending}
          canManageIntake={canManageOrderIntake}
          onToggleIntake={() => { void handleToggleOrderIntake(); }}
          loading={ordersLoading}
          error={ordersError}
        />
      ) : (
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
          onShare={() => setShowShareSheet(true)}
        />
      )}
      <InstallBanner />

      <BottomSheet
        open={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title="Compartilhar cardápio"
        description="Escolha se deseja compartilhar o texto do menu ou um link diário para pedidos."
      >
        <div className="flex flex-col gap-[10px]">
          <button
            type="button"
            className="neon-gold-fill min-h-[52px] rounded-[18px] bg-[var(--accent)] px-[18px] text-left text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
            onClick={() => {
              setShowShareSheet(false);
              void shareMenu();
            }}
          >
            Compartilhar texto
          </button>
          <button
            type="button"
            className="min-h-[52px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[18px] text-left text-[15px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void shareDailyLink(); }}
            disabled={shareLinkPending || !acceptingOrders}
          >
            {shareLinkPending ? 'Gerando link...' : 'Compartilhar link único'}
          </button>
          {!acceptingOrders ? (
            <p className="px-[4px] text-[13px] leading-[1.5] text-[var(--text-dim)]">
              O link diário fica indisponível para compartilhamento enquanto o recebimento estiver encerrado.
            </p>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  );
}

export default function App() {
  const route = resolveRoute(window.location.pathname);

  if (route.kind === 'public-menu') {
    return <PublicMenuPage token={route.token} />;
  }

  if (route.kind === 'not-found') {
    return <NotFoundPage />;
  }

  return <RootApp />;
}

function RootApp() {
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
