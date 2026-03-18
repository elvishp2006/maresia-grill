import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { FinalizedPublicOrder, OrderPaymentSummary, PublicMenu, PublicOrderCheckoutSession } from './types';
import EmbeddedStripeCheckout from './components/EmbeddedStripeCheckout';
import BottomSheet from './components/BottomSheet';
import LoadingSpinner from './components/LoadingSpinner';
import {
  cancelPublicOrder,
  deletePublicOrder,
  fetchPublicOrderStatus,
  preparePublicOrderCheckout,
  submitPublicOrder,
  subscribePublicMenu,
} from './lib/storage';
import { useToast } from './contexts/ToastContext';
import { useHapticFeedback } from './hooks/useHapticFeedback';
import { useModal } from './contexts/ModalContext';
import {
  canSelectItem,
  describeCategorySelectionRule,
  getItemSelectionAvailability,
  validateSelectionRules,
} from './lib/categorySelectionRules';
import { calculateOrderPaymentSummary, formatCurrency } from './lib/billing';

const CUSTOMER_NAME_STORAGE_KEY = 'public-menu-customer-name';
const CUSTOMER_EMAIL_STORAGE_KEY = 'public-menu-customer-email';
interface CachedPublicOrder {
  orderId: string;
  customerName: string;
  selectedItemIds: string[];
  paymentSummary: OrderPaymentSummary;
}

interface CancelledPublicOrderState {
  customerName: string;
}

interface PendingPublicPaymentState {
  draftId: string;
  paymentStatus: OrderPaymentSummary['paymentStatus'];
}

interface PendingPublicOrderSummary {
  customerName: string;
  selectedItemIds: string[];
  paymentSummary: OrderPaymentSummary;
}

type PublicMenuView = 'form' | 'submitted' | 'cancelled';
type PublicVisualState = 'form' | 'submitted-pending' | 'submitted-success' | 'cancelled';

interface PublicMenuPageProps {
  token: string;
}

interface PublicHeaderProps {
  eyebrow: string;
  title: string;
  accent?: 'gold' | 'red';
  trailing?: ReactNode;
}

interface PublicStateCardProps {
  icon: ReactNode;
  title: string;
  body: string;
  summary?: ReactNode;
}

const getStoredCustomerName = () => {
  try {
    return localStorage.getItem(CUSTOMER_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const setStoredCustomerName = (name: string) => {
  try {
    localStorage.setItem(CUSTOMER_NAME_STORAGE_KEY, name);
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const getStoredCustomerEmail = () => {
  try {
    return localStorage.getItem(CUSTOMER_EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const setStoredCustomerEmail = (email: string) => {
  try {
    localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, email);
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const isValidCustomerEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getOrderSessionStorageKey = (token: string) => `public-menu-order-session:${token}`;
const getCachedOrderStorageKey = (token: string) => `public-menu-last-order:${token}`;
const getViewStorageKey = (token: string) => `public-menu-view:${token}`;
const getCancelledStateStorageKey = (token: string) => `public-menu-cancelled-state:${token}`;
const getPendingOrderStorageKey = (token: string) => `public-menu-pending-order:${token}`;

const VIEW_HASHES: Record<PublicMenuView, string> = {
  form: '#/pedido',
  submitted: '#/enviado',
  cancelled: '#/cancelado',
};

const readViewFromHash = (): PublicMenuView | null => {
  switch (window.location.hash) {
    case '#/pedido':
      return 'form';
    case '#/enviado':
      return 'submitted';
    case '#/cancelado':
      return 'cancelled';
    default:
      return null;
  }
};

const getStoredView = (token: string): PublicMenuView | null => {
  try {
    const value = localStorage.getItem(getViewStorageKey(token));
    if (value === 'form' || value === 'submitted' || value === 'cancelled') return value;
  } catch {
    // Ignore malformed local data.
  }
  return null;
};

const setStoredView = (token: string, view: PublicMenuView) => {
  try {
    localStorage.setItem(getViewStorageKey(token), view);
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const createOrderId = () => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `public-order-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
);

const getStoredOrderId = (token: string) => {
  try {
    const key = getOrderSessionStorageKey(token);
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const next = createOrderId();
    localStorage.setItem(key, next);
    return next;
  } catch {
    return createOrderId();
  }
};

const getCachedOrder = (token: string): CachedPublicOrder | null => {
  try {
    const raw = localStorage.getItem(getCachedOrderStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedPublicOrder>;
    if (
      typeof parsed.orderId === 'string'
      && typeof parsed.customerName === 'string'
      && Array.isArray(parsed.selectedItemIds)
      && parsed.selectedItemIds.every(item => typeof item === 'string')
    ) {
      const paymentSummary = parsed.paymentSummary
        && typeof parsed.paymentSummary === 'object'
        && typeof parsed.paymentSummary.freeTotalCents === 'number'
        && typeof parsed.paymentSummary.paidTotalCents === 'number'
        && parsed.paymentSummary.currency === 'BRL'
        && typeof parsed.paymentSummary.paymentStatus === 'string'
        ? parsed.paymentSummary
        : {
          freeTotalCents: 0,
          paidTotalCents: 0,
          currency: 'BRL' as const,
          paymentStatus: 'not_required' as const,
          provider: null,
          paymentMethod: null,
          providerPaymentId: null,
          refundedAt: null,
        };
      return {
        orderId: parsed.orderId,
        customerName: parsed.customerName,
        selectedItemIds: parsed.selectedItemIds,
        paymentSummary,
      };
    }
  } catch {
    // Ignore malformed local data.
  }
  return null;
};

const setCachedOrder = (token: string, order: CachedPublicOrder) => {
  try {
    const payload = order.paymentSummary.paidTotalCents > 0
      ? order
      : {
        orderId: order.orderId,
        customerName: order.customerName,
        selectedItemIds: order.selectedItemIds,
      };
    localStorage.setItem(getCachedOrderStorageKey(token), JSON.stringify(payload));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const clearCachedOrder = (token: string) => {
  try {
    localStorage.removeItem(getCachedOrderStorageKey(token));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const getStoredCancelledState = (token: string): CancelledPublicOrderState | null => {
  try {
    const raw = localStorage.getItem(getCancelledStateStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CancelledPublicOrderState>;
    if (typeof parsed.customerName === 'string' && parsed.customerName.trim()) {
      return { customerName: parsed.customerName };
    }
  } catch {
    // Ignore malformed local data.
  }
  return null;
};

const setStoredCancelledState = (token: string, state: CancelledPublicOrderState) => {
  try {
    localStorage.setItem(getCancelledStateStorageKey(token), JSON.stringify(state));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const clearStoredCancelledState = (token: string) => {
  try {
    localStorage.removeItem(getCancelledStateStorageKey(token));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const getStoredPendingOrder = (token: string): PendingPublicOrderSummary | null => {
  try {
    const raw = localStorage.getItem(getPendingOrderStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPublicOrderSummary>;
    if (
      typeof parsed.customerName === 'string'
      && Array.isArray(parsed.selectedItemIds)
      && parsed.selectedItemIds.every(item => typeof item === 'string')
      && parsed.paymentSummary
      && typeof parsed.paymentSummary === 'object'
      && typeof parsed.paymentSummary.freeTotalCents === 'number'
      && typeof parsed.paymentSummary.paidTotalCents === 'number'
      && parsed.paymentSummary.currency === 'BRL'
      && typeof parsed.paymentSummary.paymentStatus === 'string'
    ) {
      return {
        customerName: parsed.customerName,
        selectedItemIds: parsed.selectedItemIds,
        paymentSummary: parsed.paymentSummary,
      };
    }
  } catch {
    // Ignore malformed local data.
  }
  return null;
};

const setStoredPendingOrder = (token: string, pendingOrder: PendingPublicOrderSummary) => {
  try {
    localStorage.setItem(getPendingOrderStorageKey(token), JSON.stringify(pendingOrder));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const clearStoredPendingOrder = (token: string) => {
  try {
    localStorage.removeItem(getPendingOrderStorageKey(token));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const getDraftIdFromUrl = () => new URLSearchParams(window.location.search).get('draftId');

const setDraftIdInUrl = (draftId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('draftId', draftId);
  url.hash = '#/enviado';
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const clearDraftIdFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('draftId');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${window.location.hash}`);
};

const setStoredOrderId = (token: string, nextOrderId: string) => {
  try {
    localStorage.setItem(getOrderSessionStorageKey(token), nextOrderId);
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const toCachedOrder = (order: FinalizedPublicOrder): CachedPublicOrder => ({
  orderId: order.orderId,
  customerName: order.customerName,
  selectedItemIds: order.selectedItemIds,
  paymentSummary: order.paymentSummary,
});

function PublicHeader({ eyebrow, title, accent = 'gold', trailing }: PublicHeaderProps) {
  return (
    <section className="public-topbar">
      <div className="flex items-start justify-between gap-[10px]">
        <div className="flex items-center gap-[12px]">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[15px] border border-[var(--border)] bg-[rgba(215,176,92,0.08)]">
            <img
              src="/brand/menu-mark.svg"
              alt="Logo do Maresia Grill"
              className="h-[24px] w-[24px] shrink-0 object-cover object-top"
            />
          </div>
          <div className="min-w-0">
            <p className={`public-topbar__eyebrow ${accent === 'red' ? 'text-[var(--accent-red)]' : ''}`}>
              {eyebrow}
            </p>
            <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[26px] font-bold leading-[1.03] tracking-[-0.02em] text-[var(--text)]">
              {title}
            </h1>
          </div>
        </div>
        {trailing}
      </div>
    </section>
  );
}

function PublicStateCard({ icon, title, body, summary }: PublicStateCardProps) {
  return (
    <section className="public-panel px-[18px] py-[20px]">
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-[var(--border-strong)] bg-[rgba(215,176,92,0.09)] text-[var(--accent)]">
        {icon}
      </div>
      <h2 className="mt-[18px] font-[Georgia,'Times_New_Roman',serif] text-[30px] font-bold leading-[1.04] tracking-[-0.03em] text-[var(--text)]">
        {title}
      </h2>
      <p className="mt-[12px] text-[15px] leading-[1.7] text-[var(--text-dim)]">
        {body}
      </p>
      {summary ? (
        <div className="public-inline-panel mt-[18px] px-[16px] py-[14px]">
          {summary}
        </div>
      ) : null}
    </section>
  );
}

function PublicOrderSummary({
  customerName,
  paidTotalCents,
  selectedItems,
}: {
  customerName?: string;
  paidTotalCents: number;
  selectedItems: Array<{ id: string; nome: string }>;
}) {
  return (
    <>
      {customerName ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
            Seu nome
          </p>
          <p className="mt-[6px] text-[18px] font-semibold text-[var(--text)]">
            {customerName}
          </p>
        </>
      ) : null}
      <div className={`${customerName ? 'mt-[12px]' : ''} rounded-[16px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] py-[10px]`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
          Total pago
        </p>
        <p className="mt-[4px] text-[15px] font-semibold text-[var(--accent)]">
          {formatCurrency(paidTotalCents)}
        </p>
      </div>
      <div className="mt-[12px] flex items-center justify-between gap-[10px] text-[13px] text-[var(--text-dim)]">
        <span>Itens escolhidos</span>
        <span>{selectedItems.length} selecionados</span>
      </div>
      {selectedItems.length > 0 ? (
        <ul className="mt-[10px] space-y-[8px] text-[14px] leading-[1.6] text-[var(--text)]">
          {selectedItems.map(item => (
            <li key={item.id} className="rounded-[14px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-[12px] py-[10px]">
              {item.nome}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function PublicActionBar({
  footerRef,
  children,
}: {
  footerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div
      ref={footerRef}
      className="public-action-bar px-[16px] pt-[10px] pb-[max(16px,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-[560px]">
        {children}
      </div>
    </div>
  );
}

export default function PublicMenuPage({ token }: PublicMenuPageProps) {
  const { showToast } = useToast();
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();
  const [menu, setMenu] = useState<PublicMenu | null | undefined>(undefined);
  const [customerName, setCustomerName] = useState(() => getStoredCustomerName());
  const [customerEmail, setCustomerEmail] = useState(() => getStoredCustomerEmail());
  const [selection, setSelection] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState(() => getStoredOrderId(token));
  const [successState, setSuccessState] = useState<CachedPublicOrder | null>(null);
  const [cancelledState, setCancelledState] = useState<CancelledPublicOrderState | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<PublicOrderCheckoutSession | null>(null);
  const [pendingOrderSummary, setPendingOrderSummary] = useState<PendingPublicOrderSummary | null>(() => (
    typeof window !== 'undefined' ? getStoredPendingOrder(token) : null
  ));
  const [pendingPayment, setPendingPayment] = useState<PendingPublicPaymentState | null>(() => {
    const draftId = typeof window !== 'undefined' ? getDraftIdFromUrl() : null;
    return draftId ? { draftId, paymentStatus: 'awaiting_payment' } : null;
  });
  const [currentView, setCurrentView] = useState<PublicMenuView>(() => readViewFromHash() ?? getStoredView(token) ?? 'form');
  const [footerHeight, setFooterHeight] = useState(112);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const lastVisualStateRef = useRef<PublicVisualState | null>(null);

  useEffect(() => {
    setMenu(undefined);

    const unsubscribe = subscribePublicMenu(token, (result) => {
      setMenu(result);
    }, () => {
      setMenu(null);
    });

    return () => unsubscribe();
  }, [token]);

  useEffect(() => {
    setStoredCustomerName(customerName);
  }, [customerName]);

  useEffect(() => {
    setStoredCustomerEmail(customerEmail);
  }, [customerEmail]);

  useEffect(() => {
    const nextOrderId = getStoredOrderId(token);
    setOrderId(nextOrderId);
    setCheckoutSession(null);

    const cachedOrder = getCachedOrder(token);
    const storedView = readViewFromHash() ?? getStoredView(token) ?? 'form';
    const storedCancelledState = getStoredCancelledState(token);
    const storedPendingOrder = getStoredPendingOrder(token);
    const urlDraftId = getDraftIdFromUrl();
    setPendingOrderSummary(storedPendingOrder);
    setPendingPayment(urlDraftId ? { draftId: urlDraftId, paymentStatus: 'awaiting_payment' } : null);

    if (cachedOrder) {
      setCustomerName(cachedOrder.customerName);
      setSelection(cachedOrder.selectedItemIds);
      if (storedView === 'submitted') {
        setSuccessState(cachedOrder);
        setCancelledState(null);
        setCurrentView('submitted');
        return;
      }
    }

    if (storedView === 'cancelled' && storedCancelledState) {
      setCancelledState(storedCancelledState);
      setSuccessState(null);
      setSelection([]);
      setCurrentView('cancelled');
      return;
    }

    if (urlDraftId && storedPendingOrder) {
      setCustomerName(storedPendingOrder.customerName);
      setSuccessState(null);
      setCancelledState(null);
      setSelection(storedPendingOrder.selectedItemIds);
      setCurrentView('submitted');
      return;
    }

    setSuccessState(null);
    setCancelledState(null);
    setCurrentView('form');
  }, [token]);

  useEffect(() => {
    const handleHashChange = () => {
      const nextView = readViewFromHash();
      if (!nextView) return;
      setCurrentView(nextView);
      const draftId = getDraftIdFromUrl();
      setPendingPayment(prev => (
        draftId
          ? { draftId, paymentStatus: prev?.draftId === draftId ? prev.paymentStatus : 'awaiting_payment' }
          : prev
      ));
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const nextHash = VIEW_HASHES[currentView];
    if (window.location.hash !== nextHash) {
      const normalizedPath = window.location.pathname.endsWith('/')
        ? window.location.pathname
        : `${window.location.pathname}/`;
      window.history.replaceState(
        window.history.state,
        '',
        `${normalizedPath}${window.location.search}${nextHash}`,
      );
    }
    setStoredView(token, currentView);
  }, [currentView, token]);

  useEffect(() => {
    if (currentView === 'submitted') {
      const cachedOrder = getCachedOrder(token);
      if (cachedOrder) {
        clearStoredCancelledState(token);
        setSuccessState(cachedOrder);
        setCancelledState(null);
        setSelection(cachedOrder.selectedItemIds);
        setCustomerName(cachedOrder.customerName);
        return;
      }
      if (pendingPayment?.draftId || getDraftIdFromUrl()) {
        setCancelledState(null);
        return;
      }
      setCurrentView('form');
      return;
    }

    if (currentView === 'cancelled') {
      if (cancelledState) return;
      const storedCancelledState = getStoredCancelledState(token);
      if (storedCancelledState) {
        setCancelledState(storedCancelledState);
        setSuccessState(null);
        setSelection([]);
        return;
      }
      setCurrentView('form');
      return;
    }

    setSuccessState(null);
    setCancelledState(null);
  }, [currentView, pendingPayment?.draftId, cancelledState, token]);

  useEffect(() => {
    if (!menu) return;

    const validIds = new Set(menu.items.map(item => item.id));

    setSelection(prev => prev.filter(id => validIds.has(id)));
    setSuccessState(prev => {
      if (!prev) return null;
      const nextSelectedItemIds = prev.selectedItemIds.filter(id => validIds.has(id));
      if (nextSelectedItemIds.length === prev.selectedItemIds.length) return prev;

      const nextState = { ...prev, selectedItemIds: nextSelectedItemIds };
      setCachedOrder(token, nextState);
      return nextState;
    });

    const cachedOrder = getCachedOrder(token);
    if (!cachedOrder) return;

    const nextSelectedItemIds = cachedOrder.selectedItemIds.filter(id => validIds.has(id));
    if (nextSelectedItemIds.length === cachedOrder.selectedItemIds.length) return;

    setCachedOrder(token, { ...cachedOrder, selectedItemIds: nextSelectedItemIds });
  }, [menu, token]);

  useEffect(() => {
    const draftId = pendingPayment?.draftId ?? getDraftIdFromUrl();
    if (!draftId || !menu) return;

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollStatus = async () => {
      setSubmitting(true);
      try {
        const result = await fetchPublicOrderStatus({ shareToken: menu.token, draftId });
        if (!active) return;

        if (result.order) {
          const nextOrder = toCachedOrder(result.order);
          setCachedOrder(menu.token, nextOrder);
          clearStoredCancelledState(menu.token);
          clearStoredPendingOrder(menu.token);
          setSuccessState(nextOrder);
          setCancelledState(null);
          setSelection(nextOrder.selectedItemIds);
          setCustomerName(nextOrder.customerName);
          setPendingPayment(null);
          setPendingOrderSummary(null);
          setCheckoutSession(null);
          setCurrentView('submitted');
          clearDraftIdFromUrl();
          return;
        }

        setPendingPayment({ draftId, paymentStatus: result.paymentStatus });
        setCurrentView('submitted');

        if (result.paymentStatus === 'awaiting_payment' || result.paymentStatus === 'paid') {
          timeoutId = window.setTimeout(() => {
            timeoutId = null;
            void pollStatus();
          }, 2500);
          return;
        }

        if (result.paymentStatus === 'failed') {
          showToast('O pagamento não foi concluído. Revise o checkout e tente novamente.', 'error');
        }
      } catch (error) {
        if (!active) return;
        showToast(error instanceof Error ? error.message : 'Não foi possível confirmar o pagamento.', 'error');
      } finally {
        if (active && !timeoutId) setSubmitting(false);
      }
    };

    void pollStatus();

    return () => {
      active = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [menu, pendingPayment?.draftId, showToast]);

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;

    const measure = () => {
      const nextHeight = Math.ceil(footer.getBoundingClientRect().height);
      if (nextHeight > 0) setFooterHeight(nextHeight);
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measure());
      observer.observe(footer);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [successState, submitting, selection.length]);

  const visualState: PublicVisualState = successState
    ? 'submitted-success'
    : cancelledState
      ? 'cancelled'
      : currentView === 'submitted' && pendingPayment
        ? 'submitted-pending'
        : 'form';

  useLayoutEffect(() => {
    if (lastVisualStateRef.current === visualState) return;
    lastVisualStateRef.current = visualState;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [visualState]);

  const itemsByCategory = useMemo(() => {
    if (!menu) return [];
    return menu.categories.map(category => ({
      category,
      items: menu.items.filter(item => item.categoria === category),
    }));
  }, [menu]);
  const canModifyExistingOrder = Boolean(menu?.acceptingOrders);
  const canStartNewOrder = Boolean(menu?.acceptingOrders);
  const isMenuExpired = menu === null;
  const selectedCount = selection.length;
  const currentPaymentSummary = useMemo(() => (
    menu
      ? calculateOrderPaymentSummary(menu.items, selection)
      : null
  ), [menu, selection]);
  const pendingSelectedItemIds = pendingOrderSummary?.selectedItemIds ?? selection;
  const pendingSelectedItems = useMemo(() => {
    if (!menu) return [];
    const itemMap = new Map(menu.items.map(item => [item.id, item] as const));
    return pendingSelectedItemIds
      .map(itemId => itemMap.get(itemId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [menu, pendingSelectedItemIds]);
  const pendingPaymentSummary = pendingOrderSummary?.paymentSummary ?? currentPaymentSummary;
  const selectionViolations = useMemo(() => (
    menu ? validateSelectionRules(menu.items, selection, menu.categorySelectionRules) : []
  ), [menu, selection]);

  const openSubmittedPaymentState = (draftId: string) => {
    setDraftIdInUrl(draftId);
    setPendingPayment({ draftId, paymentStatus: 'awaiting_payment' });
    setCheckoutSession(null);
    setCurrentView('submitted');
  };

  const toggleItem = (id: string) => {
    if (!menu) return;
    lightTap();
    setSelection(prev => {
      if (prev.includes(id)) return prev.filter(itemId => itemId !== id);

      const result = canSelectItem({
        items: menu.items,
        selectedItemIds: prev,
        itemId: id,
        rules: menu.categorySelectionRules,
      });
      if (!result.allowed) {
        showToast(result.violation.message, 'info');
        return prev;
      }

      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (!menu) return;

    const trimmedName = customerName.trim();
    const trimmedEmail = customerEmail.trim().toLowerCase();
    if (!trimmedName) {
      showToast('Informe seu nome.', 'info');
      return;
    }
    if (!trimmedEmail) {
      showToast('Informe seu e-mail.', 'info');
      return;
    }
    if (!isValidCustomerEmail(trimmedEmail)) {
      showToast('Informe um e-mail válido.', 'info');
      return;
    }
    if (selection.length === 0) {
      showToast('Selecione pelo menos um item.', 'info');
      return;
    }
    if (selectionViolations.length > 0) {
      showToast(selectionViolations[0]?.message ?? 'Ajuste os itens selecionados antes de enviar.', 'info');
      return;
    }

    setSubmitting(true);
    try {
      if ((currentPaymentSummary?.paidTotalCents ?? 0) > 0) {
        const url = new URL(window.location.href);
        url.hash = '#/enviado';
        url.searchParams.set('draftId', orderId);
        const checkout = await preparePublicOrderCheckout({
          orderId,
          dateKey: menu.dateKey,
          shareToken: menu.token,
          customerName: trimmedName,
          selectedItemIds: selection,
          successUrl: url.toString(),
          pendingUrl: url.toString(),
          failureUrl: `${window.location.origin}${window.location.pathname}#/pedido`,
        });

        if (checkout.kind === 'free_order_confirmed' && checkout.order) {
          const nextOrder = toCachedOrder(checkout.order);
          setCachedOrder(menu.token, nextOrder);
          clearStoredCancelledState(menu.token);
          clearStoredPendingOrder(menu.token);
          clearDraftIdFromUrl();
          setPendingPayment(null);
          setPendingOrderSummary(null);
          setCheckoutSession(null);
          setSuccessState(nextOrder);
          setCancelledState(null);
          setSelection(nextOrder.selectedItemIds);
          setCurrentView('submitted');
          return;
        }

        if (
          checkout.kind === 'payment_required'
          && checkout.checkoutSession?.clientSecret
          && checkout.checkoutSession.draftId
        ) {
          const nextPendingOrderSummary = {
            customerName: trimmedName,
            selectedItemIds: selection,
            paymentSummary: currentPaymentSummary ?? {
              freeTotalCents: 0,
              paidTotalCents: 0,
              currency: 'BRL',
              paymentStatus: 'awaiting_payment',
              provider: null,
              paymentMethod: null,
              providerPaymentId: null,
              refundedAt: null,
            },
          };
          setStoredPendingOrder(menu.token, nextPendingOrderSummary);
          setPendingOrderSummary(nextPendingOrderSummary);
          setCheckoutSession(checkout.checkoutSession);
          return;
        }

        throw new Error('Não foi possível iniciar o pagamento.');
      }

      const submission = await submitPublicOrder({
        orderId,
        dateKey: menu.dateKey,
        shareToken: menu.token,
        customerName: trimmedName,
        selectedItemIds: selection,
      });
      const persistedSelection = submission?.selectedItemIds ?? selection;
      const nextOrder = {
        orderId,
        customerName: trimmedName,
        selectedItemIds: persistedSelection,
        paymentSummary: submission.paymentSummary ?? currentPaymentSummary ?? {
          freeTotalCents: 0,
          paidTotalCents: 0,
          currency: 'BRL',
          paymentStatus: 'not_required',
          provider: null,
          paymentMethod: null,
          providerPaymentId: null,
          refundedAt: null,
        },
      };
      setCachedOrder(menu.token, nextOrder);
      clearStoredCancelledState(menu.token);
      clearStoredPendingOrder(menu.token);
      clearDraftIdFromUrl();
      setPendingPayment(null);
      setPendingOrderSummary(null);
      setCheckoutSession(null);
      setSuccessState(nextOrder);
      setCancelledState(null);
      setSelection(persistedSelection);
      setCurrentView('submitted');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!menu || !successState) return;

    const isPaidOrder = successState.paymentSummary.paidTotalCents > 0;

    const ok = await confirm(
      'Cancelar pedido',
      isPaidOrder
        ? 'Este pedido tem itens pagos. O cancelamento solicitará o estorno antes de liberar um novo pedido.'
        : 'Deseja cancelar o seu pedido deste cardápio? Você poderá fazer um novo pedido enquanto o recebimento estiver aberto.',
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      if (isPaidOrder) {
        await cancelPublicOrder({
          orderId: successState.orderId,
          dateKey: menu.dateKey,
          shareToken: menu.token,
        });
      } else {
        await deletePublicOrder({
          orderId: successState.orderId,
          dateKey: menu.dateKey,
          shareToken: menu.token,
        });
      }
      clearCachedOrder(menu.token);
      clearStoredPendingOrder(menu.token);
      clearDraftIdFromUrl();
      setPendingPayment(null);
      setPendingOrderSummary(null);
      setCheckoutSession(null);
      const nextOrderId = createOrderId();
      setStoredOrderId(menu.token, nextOrderId);
      setOrderId(nextOrderId);
      setSelection([]);
      setSuccessState(null);
      const nextCancelledState = { customerName: successState.customerName };
      setStoredCancelledState(menu.token, nextCancelledState);
      setCancelledState(nextCancelledState);
      setCurrentView('cancelled');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível cancelar o pedido.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (menu === undefined) return <LoadingSpinner />;

  if (cancelledState) {
    return (
      <main className="public-shell flex flex-col" style={{ paddingBottom: `${footerHeight + 24}px` }}>
        <PublicHeader eyebrow="Cancelado" title="Maresia Grill" accent="red" />
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          )}
          title="Seu pedido foi cancelado"
          body={
            canStartNewOrder
              ? `${cancelledState.customerName}, você ainda pode montar um novo pedido neste cardápio.`
              : `${cancelledState.customerName}, a confirmação do cancelamento foi preservada neste link.`
          }
        />
        {canStartNewOrder ? (
          <PublicActionBar footerRef={footerRef}>
              <button
                type="button"
                onClick={() => {
                  lightTap();
                  clearStoredCancelledState(token);
                  setCancelledState(null);
                  setSuccessState(null);
                  setSelection([]);
                  setCurrentView('form');
                }}
                className="neon-gold-fill min-h-[54px] w-full rounded-[20px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
              >
                Fazer novo pedido
              </button>
          </PublicActionBar>
        ) : null}
      </main>
    );
  }

  if (successState) {
    return (
      <main className="public-shell flex flex-col" style={{ paddingBottom: `${footerHeight + 24}px` }}>
        <PublicHeader eyebrow="Enviado" title="Maresia Grill" />
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
          title="Seu pedido foi enviado"
          body={
            canModifyExistingOrder
              ? 'Se precisar alterar algo, cancele este pedido e faça um novo.'
              : isMenuExpired
                ? 'A confirmação foi preservada, mas este cardápio não está mais disponível.'
                : 'A confirmação foi preservada, mas os pedidos já foram encerrados.'
          }
          summary={(
            <PublicOrderSummary
              customerName={successState.customerName}
              paidTotalCents={successState.paymentSummary.paidTotalCents}
              selectedItems={successState.selectedItemIds.map(itemId => {
                const item = menu?.items.find(candidate => candidate.id === itemId);
                return { id: itemId, nome: item?.nome ?? itemId };
              })}
            />
          )}
        />
        {canModifyExistingOrder ? (
          <PublicActionBar footerRef={footerRef}>
            <button
              type="button"
              onClick={() => {
                mediumTap();
                void handleDeleteOrder();
              }}
              disabled={submitting}
              className="min-h-[54px] w-full rounded-[20px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)] px-[18px] text-[15px] font-semibold text-[var(--accent-red)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {successState.paymentSummary.paidTotalCents > 0 ? 'Cancelar e estornar' : 'Cancelar pedido'}
            </button>
            <p className="mt-[10px] text-[13px] leading-[1.6] text-[var(--text-dim)]">
              Para mudar os itens, cancele este pedido e faça um novo.
            </p>
          </PublicActionBar>
        ) : null}
      </main>
    );
  }

  if (currentView === 'submitted' && pendingPayment && !successState) {
    return (
      <main className="public-shell flex flex-col" style={{ paddingBottom: `${footerHeight + 24}px` }}>
        <PublicHeader eyebrow="Pagamento" title="Confirmando seu pedido" />
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          )}
          title={pendingPayment.paymentStatus === 'failed' ? 'Pagamento não concluído' : 'Aguardando confirmação'}
          body={
            pendingPayment.paymentStatus === 'failed'
              ? 'O Stripe informou que o pagamento não foi concluído. Você pode voltar ao pedido e tentar novamente.'
              : 'Estamos aguardando a confirmação do Stripe para finalizar o pedido. Esta tela atualiza automaticamente.'
          }
          summary={(
            <PublicOrderSummary
              customerName={pendingOrderSummary?.customerName ?? (customerName.trim() || undefined)}
              paidTotalCents={pendingPaymentSummary?.paidTotalCents ?? 0}
              selectedItems={pendingSelectedItems.map(item => ({ id: item.id, nome: item.nome }))}
            />
          )}
        />
        {pendingPayment.paymentStatus === 'failed' ? (
          <PublicActionBar footerRef={footerRef}>
            <button
              type="button"
              onClick={() => {
                lightTap();
                clearDraftIdFromUrl();
                clearStoredPendingOrder(token);
                setPendingPayment(null);
                setPendingOrderSummary(null);
                setCurrentView('form');
              }}
              className="min-h-[54px] w-full rounded-[20px] border border-[var(--border-strong)] bg-[var(--bg)] px-[18px] text-[15px] font-semibold text-[var(--text)] transition-opacity hover:opacity-90"
            >
              Voltar ao pedido
            </button>
          </PublicActionBar>
        ) : null}
      </main>
    );
  }

  if (!menu) {
    return (
      <main className="public-shell">
        <PublicHeader eyebrow="Link expirado" title="Maresia Grill" accent="red" />
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          )}
          title="Este cardápio não está mais disponível"
          body="O link é válido apenas para o cardápio do dia. Solicite um novo compartilhamento."
        />
      </main>
    );
  }

  if (!menu.acceptingOrders) {
    return (
      <main className="public-shell">
        <PublicHeader eyebrow="Encerrado" title="Maresia Grill" accent="red" />
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 7V4m8 3V4" />
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M3 10h18" />
            </svg>
          )}
          title="O recebimento de pedidos foi encerrado"
          body="A cozinha já está montando os pratos deste cardápio. Se precisar, solicite um novo posicionamento do restaurante."
        />
      </main>
    );
  }

  return (
    <main className="public-shell" style={{ paddingBottom: `${footerHeight + 24}px` }}>
      <PublicHeader
        eyebrow="Hoje"
        title="Faça seu pedido"
        trailing={(
          <div className="public-inline-panel px-[12px] py-[8px] text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">Opções</p>
            <p className="mt-[3px] text-[16px] font-semibold text-[var(--accent)]">{menu.items.length}</p>
          </div>
        )}
      />

      <section className="public-panel px-[18px] py-[18px]">
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <h2 className="mt-[8px] font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold leading-[1.04] tracking-[-0.02em] text-[var(--text)]">
              Identificação
            </h2>
          </div>
          <div className="public-inline-panel min-w-[92px] px-[12px] py-[8px] text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Selecionados
            </p>
            <p className="mt-[3px] text-[16px] font-semibold text-[var(--accent)]">
              {selectedCount}
            </p>
          </div>
        </div>
        <p className="mt-[10px] text-[14px] leading-[1.7] text-[var(--text-dim)]">
          Digite seu nome, e-mail e escolha os itens do seu pedido.
        </p>

        <label className="mt-[18px] block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Seu nome
          <input
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Digite seu nome"
            className="neon-gold-focus mt-[8px] w-full rounded-[20px] border border-[var(--border)] bg-[rgba(255,248,232,0.05)] px-[16px] py-[15px] text-[17px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
          />
        </label>

        <label className="mt-[14px] block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Seu e-mail
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            placeholder="voce@empresa.com"
            className="neon-gold-focus mt-[8px] w-full rounded-[20px] border border-[var(--border)] bg-[rgba(255,248,232,0.05)] px-[16px] py-[15px] text-[17px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
          />
        </label>
      </section>

      <section className="mt-[14px] space-y-[12px]">
        {itemsByCategory.map(({ category, items }) => (
          <section
            key={category}
            className="public-panel px-[18px] py-[18px]"
          >
            <div className="flex items-start justify-between gap-[12px]">
              <div>
                <h2 className="mt-[6px] font-[Georgia,'Times_New_Roman',serif] text-[25px] font-bold leading-[1.04] tracking-[-0.02em] text-[var(--text)]">
                  {category}
                </h2>
              </div>
              <div className="public-inline-panel flex min-h-[40px] min-w-[40px] items-center justify-center px-[10px] text-[14px] font-semibold text-[var(--accent)]">
                {items.length}
              </div>
            </div>
            {describeCategorySelectionRule(category, menu.categorySelectionRules) ? (
              <p className="mt-[8px] text-[13px] leading-[1.6] text-[var(--accent)]">
                {describeCategorySelectionRule(category, menu.categorySelectionRules)}
              </p>
            ) : null}
            <ul className="mt-[14px] flex list-none flex-col gap-[10px]">
              {items.map(item => {
                const availability = getItemSelectionAvailability({
                  items: menu.items,
                  selectedItemIds: selection,
                  item,
                  rules: menu.categorySelectionRules,
                });
                const active = availability.active;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      disabled={submitting || availability.disabled}
                      aria-pressed={active}
                      aria-label={`${active ? 'Remover' : 'Adicionar'} ${item.nome} do menu do dia`}
                      className={`public-choice flex min-h-[72px] w-full items-center gap-[14px] px-[14px] py-[13px] text-left disabled:cursor-not-allowed ${
                        availability.disabled ? 'opacity-45 grayscale-[0.2]' : 'disabled:opacity-60'
                      }`}
                    >
                      <span
                        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[14px] border text-[16px] font-bold transition-colors ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] shadow-[0_6px_16px_rgba(215,176,92,0.22)]'
                            : availability.disabled
                              ? 'border-[var(--border)] bg-[rgba(255,255,255,0.01)] text-transparent'
                            : 'border-[var(--border-strong)] bg-[rgba(255,255,255,0.02)] text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[16px] leading-[1.35] ${
                          active
                            ? 'font-semibold text-[var(--text)]'
                            : availability.disabled
                              ? 'font-medium text-[var(--text-dim)]'
                              : 'font-medium text-[var(--text-muted)]'
                        }`}>
                          {item.nome}
                        </span>
                        <span className="mt-[5px] block text-[12px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                          {availability.helperText}
                        </span>
                        {typeof item.priceCents === 'number' && item.priceCents > 0 ? (
                          <span className="mt-[5px] block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                            {formatCurrency(item.priceCents)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </section>

      <PublicActionBar footerRef={footerRef}>
        <div className="public-inline-panel mb-[10px] px-[14px] py-[12px]">
          <div className="mb-[12px]">
            <p className="mt-[4px] text-[14px] text-[var(--text-muted)]">
              {selectedCount === 0 ? 'Selecione os complementos desejados.' : `${selectedCount} item(ns) pronto(s) para envio`}
            </p>
            {currentPaymentSummary ? (
              <div className="mt-[12px] rounded-[16px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] py-[10px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Total a pagar
                </p>
                <p className="mt-[4px] text-[15px] font-semibold text-[var(--accent)]">
                  {formatCurrency(currentPaymentSummary.paidTotalCents)}
                </p>
              </div>
            ) : null}
            {selectionViolations[0] ? (
              <p className="mt-[8px] text-[13px] leading-[1.6] text-[var(--accent-red)]">
                {selectionViolations[0].message}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              mediumTap();
              void handleSubmit();
            }}
            disabled={submitting}
            className="neon-gold-fill min-h-[56px] w-full rounded-[22px] bg-[var(--accent)] px-[18px] text-[16px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Processando...' : (currentPaymentSummary?.paidTotalCents ?? 0) > 0 ? 'Pagar e finalizar pedido' : 'Enviar pedido'}
          </button>
        </div>
      </PublicActionBar>
      <BottomSheet
        open={Boolean(checkoutSession?.clientSecret)}
        title="Finalize seu pedido"
        onClose={() => {
          lightTap();
          setSubmitting(false);
          setCheckoutSession(null);
          setPendingPayment(null);
        }}
      >
        {checkoutSession?.clientSecret ? (
          <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--bg-elevated)] p-[12px] shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
            <EmbeddedStripeCheckout
              clientSecret={checkoutSession.clientSecret}
              email={customerEmail}
              onComplete={() => openSubmittedPaymentState(checkoutSession.draftId)}
            />
          </div>
        ) : null}
      </BottomSheet>
    </main>
  );
}
