import { useEffect, useMemo, useRef, useState } from 'react';
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
import { showAdminError, showAdminInfo, showAdminSuccess } from './lib/adminFeedback';
import type { OrderEntry, PublicMenuVersion } from './types';
import PublicMenuPage from './PublicMenuPage';
import NotFoundPage from './NotFoundPage';
import { useHapticFeedback } from './hooks/useHapticFeedback';

type AppRoute =
  | { kind: 'root' }
  | { kind: 'public-menu'; token: string }
  | { kind: 'not-found' };

const resolveRoute = (pathname: string): AppRoute => {
  if (pathname === '/') return { kind: 'root' };

  const publicMenuMatch = pathname.match(/^\/s\/([^/]+)\/?$/);
  if (publicMenuMatch?.[1]) {
    return { kind: 'public-menu', token: decodeURIComponent(publicMenuMatch[1]) };
  }

  return { kind: 'not-found' };
};

interface AuthenticatedAppProps {
  onSignOut: () => void;
  userEmail?: string | null;
  updateNotification: ReturnType<typeof useUpdateNotification>;
}

function AuthenticatedApp({ onSignOut, userEmail, updateNotification }: AuthenticatedAppProps) {
  const AUTO_SYNC_DEBOUNCE_MS = 750;
  const AUTO_SYNC_RETRY_MS = 2_000;
  const { isOnline } = useOnlineStatus();
  const { showToast } = useToast();
  const { confirm } = useModal();
  const { needRefresh, applyUpdate } = updateNotification;
  const { lightTap, mediumTap, success } = useHapticFeedback();
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
    categorySelectionRules,
    daySelection,
    usageCounts,
    sortMode,
    loading,
    pendingWrites,
    dataRevision,
    persistedRevision,
    currentDateKey,
    toggleSortMode,
    toggleItem,
    addItem,
    removeItem,
    updateItem,
    addCategory,
    removeCategory,
    moveCategory,
    saveCategoryRule,
    updateItemAlwaysActive,
    updateCategoryExcludeFromShare,
    renameCategory,
  } = useMenuState(isOnline, canEdit);

  const insights = useMenuInsights(complements, daySelection, isOnline);

  const [searchByView, setSearchByView] = useState<{ menu: string; manage: string }>({ menu: '', manage: '' });
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
  const [publicSyncState, setPublicSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const syncTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncedRevisionRef = useRef<number | null>(null);
  const syncBaselineInitializedRef = useRef(false);
  const syncScopeKeyRef = useRef<string | null>(null);

  const search = viewMode === 'manage' ? searchByView.manage : searchByView.menu;

  const visibleCategories = useMemo(() => {
    if (!search.trim()) return categories;

    const normalized = normalize(search.trim());
    return categories.filter(categoria => {
      if (normalize(categoria.name).includes(normalized)) return true;
      return complements.some(
        item => item.categoria === categoria.id && normalize(item.nome).includes(normalized)
      );
    });
  }, [categories, complements, search]);

  const expandedCategory = useMemo(() => {
    if (visibleCategories.length === 0) return null;
    if (manualExpandedCategory === null) return null;
    if (manualExpandedCategory !== undefined) {
      const found = visibleCategories.find(c => c.id === manualExpandedCategory);
      if (found) return found;
    }
    return visibleCategories[0];
  }, [manualExpandedCategory, visibleCategories]);

  const now = new Date();
  const dateShort = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const shareMenu = async () => {
    const shareCategories = categories.filter(cat =>
      !categorySelectionRules.find(r => r.category === cat.name)?.excludeFromShare
    );
    const text = formatMenuText(complements, daySelection, shareCategories);
    if (navigator.share) {
      await navigator.share({ title: 'Menu do Maresia Grill', text });
      showAdminSuccess(showToast, 'Menu compartilhado!');
    } else {
      try {
        await navigator.clipboard.writeText(text);
        showAdminSuccess(showToast, 'Menu copiado!');
      } catch {
        alert(text);
      }
    }
  };

  const shareDailyLink = async () => {
    if (!acceptingOrders) {
      showAdminInfo(showToast, 'Os pedidos do dia estão encerrados.');
      return;
    }

    setShareLinkPending(true);
    try {
      const { url } = await getOrCreateDailyShareLink({
        dateKey: currentDateKey,
        categories,
        complements,
        daySelection,
        categorySelectionRules,
      });

      if (navigator.share) {
        await navigator.share({ title: 'Menu do Maresia Grill', text: 'Faça seu pedido do dia', url });
      } else {
        await navigator.clipboard.writeText(url);
        showAdminSuccess(showToast, 'Link copiado!');
      }
    } catch (error) {
      showAdminError(showToast, 'share_link', error);
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

  const handleSearchChange = (value: string) => {
    setSearchByView((current) => (
      viewMode === 'manage'
        ? { ...current, manage: value }
        : { ...current, menu: value }
    ));
  };

  const clearCurrentSearch = () => {
    setSearchByView((current) => (
      viewMode === 'manage'
        ? { ...current, manage: '' }
        : { ...current, menu: '' }
    ));
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
      .catch((error) => {
        if (!active) return;
        showAdminError(showToast, 'orders_history', error);
      });

    return () => {
      active = false;
    };
  }, [orders, showToast]);

  useEffect(() => {
    const clearTimers = () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    if (loading || !isOnline || !canEdit) {
      clearTimers();
      setPublicSyncState('idle');
      return;
    }

    const syncScopeKey = `${userEmail ?? ''}:${currentDateKey}`;
    if (syncScopeKeyRef.current !== syncScopeKey) {
      syncScopeKeyRef.current = syncScopeKey;
      syncBaselineInitializedRef.current = false;
      lastSyncedRevisionRef.current = null;
      setPublicSyncState('idle');
    }

    if (!syncBaselineInitializedRef.current) {
      syncBaselineInitializedRef.current = true;
      lastSyncedRevisionRef.current = persistedRevision;
      setPublicSyncState('idle');
      return clearTimers;
    }

    const nextPayload = {
      dateKey: currentDateKey,
      categories,
      complements,
      daySelection,
      categorySelectionRules,
    };

    const queueSync = (delayMs: number) => {
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null;

        if (loading || !isOnline || !canEdit) {
          setPublicSyncState('idle');
          return;
        }

        if (pendingWrites > 0) {
          queueSync(AUTO_SYNC_DEBOUNCE_MS);
          return;
        }

        if (syncInFlightRef.current) {
          syncQueuedRef.current = true;
          return;
        }

        if (lastSyncedRevisionRef.current === persistedRevision) {
          setPublicSyncState('idle');
          return;
        }

        syncInFlightRef.current = true;
        setPublicSyncState('syncing');

        syncPublicMenuSnapshotForDate(nextPayload)
          .then(() => {
            lastSyncedRevisionRef.current = persistedRevision;
            setPublicSyncState('idle');
          })
          .catch(() => {
            setPublicSyncState('error');
            if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              queueSync(0);
            }, AUTO_SYNC_RETRY_MS);
          })
          .finally(() => {
            syncInFlightRef.current = false;
            if (syncQueuedRef.current || lastSyncedRevisionRef.current !== persistedRevision) {
              syncQueuedRef.current = false;
              queueSync(AUTO_SYNC_DEBOUNCE_MS);
            }
          });
      }, delayMs);
    };

    queueSync(AUTO_SYNC_DEBOUNCE_MS);

    return clearTimers;
  }, [
    AUTO_SYNC_DEBOUNCE_MS,
    AUTO_SYNC_RETRY_MS,
    canEdit,
    categories,
    categorySelectionRules,
    complements,
    currentDateKey,
    dataRevision,
    daySelection,
    isOnline,
    loading,
    pendingWrites,
    persistedRevision,
    userEmail,
  ]);

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
        categorySelectionRules,
        acceptingOrders: !acceptingOrders,
      });
      showAdminSuccess(
        showToast,
        acceptingOrders ? 'Recebimento de pedidos encerrado.' : 'Recebimento de pedidos reaberto.'
      );
    } catch (error) {
      showAdminError(showToast, 'order_intake', error);
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
        showPublicSyncPendingIndicator={isOnline && canEdit && publicSyncState === 'error'}
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
                mediumTap();
                void takeControl().then((granted) => {
                  if (!granted && !editorLockError) showAdminError(showToast, 'lock_takeover');
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
          onSearchChange={handleSearchChange}
          sortMode={sortMode}
          onToggleSort={toggleSortMode}
          viewMode={viewMode}
          stickyTop={headerHeight}
        />
      ) : null}

      {viewMode === 'orders' ? (
        <OrdersPanel
          orders={orders}
          categories={categories.map(c => c.name)}
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
          categorySelectionRules={categorySelectionRules}
          daySelection={daySelection}
          usageCounts={usageCounts}
          sortMode={sortMode}
          search={search}
          expandedCategory={expandedCategory}
          onToggleCollapse={(categoria) => setManualExpandedCategory(expandedCategory?.id === categoria.id ? null : categoria.id)}
          isOnline={isOnline}
          canEdit={canEdit}
          insights={insights}
          onToggle={toggleItem}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onUpdateItem={updateItem}
          onUpdateItemAlwaysActive={updateItemAlwaysActive}
          onMoveCategory={moveCategory}
          onRemoveCategory={removeCategory}
          onAddCategory={addCategory}
          onSaveCategoryRule={saveCategoryRule}
          onUpdateCategoryExcludeFromShare={updateCategoryExcludeFromShare}
          onRenameCategory={renameCategory}
          onClearSearch={clearCurrentSearch}
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
              success();
              void shareMenu().finally(() => {
                setShowShareSheet(false);
              });
            }}
          >
            Compartilhar texto
          </button>
          <button
            type="button"
            className="min-h-[52px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[18px] text-left text-[15px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              lightTap();
              void shareDailyLink();
            }}
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
  const isPublicMenuRoute = route.kind === 'public-menu';
  const updateNotification = useUpdateNotification({
    autoApply: isPublicMenuRoute,
    reloadOnControllerChange: isPublicMenuRoute,
    showUpdatedToast: !isPublicMenuRoute,
  });

  if (route.kind === 'public-menu') {
    return <PublicMenuPage token={route.token} />;
  }

  if (route.kind === 'not-found') {
    return <NotFoundPage />;
  }

  return <RootApp updateNotification={updateNotification} />;
}

function RootApp({ updateNotification }: { updateNotification: ReturnType<typeof useUpdateNotification> }) {
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

  return (
    <AuthenticatedApp
      onSignOut={() => { void signOut(); }}
      updateNotification={updateNotification}
      userEmail={user.email}
    />
  );
}
