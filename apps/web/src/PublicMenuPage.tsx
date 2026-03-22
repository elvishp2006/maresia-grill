import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FinalizedPublicOrder, OrderLine, OrderPaymentSummary, PublicMenu, PublicOrderCheckoutSession, SelectedPublicItem } from './types';
import EmbeddedStripeCheckout from './components/EmbeddedStripeCheckout';
import BottomSheet from './components/BottomSheet';
import LoadingSpinner from './components/LoadingSpinner';
import {
  cancelPublicOrder,
  fetchPublicOrderStatus,
  preparePublicOrderCheckout,
  submitPublicOrder,
  subscribePublicMenu,
} from './lib/storage';
import { useToast } from './contexts/ToastContext';
import { useHapticFeedback } from './hooks/useHapticFeedback';
import { useModal } from './contexts/ModalContext';
import {
  describeCategorySelectionRule,
  validateSelectionRules,
} from './lib/categorySelectionRules';
import { calculateOrderPaymentSummary, formatCurrency } from './lib/billing';
import { groupOrderItemsByCategory } from './lib/utils';

const CUSTOMER_NAME_STORAGE_KEY = 'public-menu-customer-name';
const CUSTOMER_EMAIL_STORAGE_KEY = 'public-menu-customer-email';
interface PublicDraftState {
  customerName: string;
  customerEmail: string;
  selectedItems: SelectedPublicItem[];
  observation: string;
}

interface CachedPublicOrder {
  orderId: string;
  customerName: string;
  lines: OrderLine[];
  paymentSummary: OrderPaymentSummary;
  observation?: string;
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
  selectedItems: SelectedPublicItem[];
  paymentSummary: OrderPaymentSummary;
}

type PublicMenuView = 'form' | 'submitted' | 'cancelled';
type PublicVisualState = 'form' | 'submitted-pending' | 'submitted-success' | 'cancelled';

interface PublicMenuPageProps {
  token: string;
}

interface PublicStateCardProps {
  icon?: ReactNode;
  title: string;
  body: string;
  summary?: ReactNode;
  accent?: 'gold' | 'red' | 'green';
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

const normalizeSelectedItems = (
  selectedItems?: SelectedPublicItem[] | null,
  fallbackSelectedItemIds?: string[] | null,
) => {
  const counts = new Map<string, number>();

  for (const item of selectedItems ?? []) {
    if (typeof item?.itemId !== 'string' || !Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + Math.trunc(item.quantity));
  }

  if (counts.size === 0) {
    for (const itemId of fallbackSelectedItemIds ?? []) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
};

const getSelectedQuantity = (selectedItems: SelectedPublicItem[], itemId: string) => (
  selectedItems.find(item => item.itemId === itemId)?.quantity ?? 0
);

const setSelectedQuantity = (selectedItems: SelectedPublicItem[], itemId: string, quantity: number) => {
  const normalizedQuantity = Math.max(0, Math.trunc(quantity));
  const remaining = selectedItems.filter(item => item.itemId !== itemId);
  return normalizedQuantity > 0
    ? [...remaining, { itemId, quantity: normalizedQuantity }]
    : remaining;
};

const countSelectedUnits = (selectedItems: SelectedPublicItem[]) => (
  selectedItems.reduce((sum, item) => sum + item.quantity, 0)
);

const selectionFromLines = (lines: OrderLine[]) => (
  lines.map(line => ({ itemId: line.itemId, quantity: line.quantity }))
);

const getOrderSessionStorageKey = (token: string) => `public-menu-order-session:${token}`;
const getCachedOrderStorageKey = (token: string) => `public-menu-last-order:${token}`;
const getViewStorageKey = (token: string) => `public-menu-view:${token}`;
const getCancelledStateStorageKey = (token: string) => `public-menu-cancelled-state:${token}`;
const getPendingOrderStorageKey = (token: string) => `public-menu-pending-order:${token}`;
const getDraftStateStorageKey = (token: string) => `public-menu-draft-state:${token}`;

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
      && Array.isArray(parsed.lines)
    ) {
      const lines = parsed.lines.filter((line): line is OrderLine => (
        Boolean(line)
        && typeof (line as OrderLine).itemId === 'string'
        && typeof (line as OrderLine).quantity === 'number'
        && typeof (line as OrderLine).unitPriceCents === 'number'
        && typeof (line as OrderLine).name === 'string'
        && typeof (line as OrderLine).categoryId === 'string'
        && typeof (line as OrderLine).categoryName === 'string'
      ));
      if (lines.length === 0) return null;
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
        lines,
        paymentSummary,
        ...(typeof parsed.observation === 'string' && parsed.observation ? { observation: parsed.observation } : {}),
      };
    }
  } catch {
    // Ignore malformed local data.
  }
  return null;
};

const setCachedOrder = (token: string, order: CachedPublicOrder) => {
  try {
    localStorage.setItem(getCachedOrderStorageKey(token), JSON.stringify(order));
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
      && parsed.paymentSummary
      && typeof parsed.paymentSummary === 'object'
      && typeof parsed.paymentSummary.freeTotalCents === 'number'
      && typeof parsed.paymentSummary.paidTotalCents === 'number'
      && parsed.paymentSummary.currency === 'BRL'
      && typeof parsed.paymentSummary.paymentStatus === 'string'
    ) {
      const selectedItems = normalizeSelectedItems(
        (parsed as Partial<{ selectedItems: SelectedPublicItem[] }>).selectedItems,
      );
      if (selectedItems.length === 0) return null;
      return {
        customerName: parsed.customerName,
        selectedItems,
        paymentSummary: parsed.paymentSummary,
      };
    }
  } catch {
    // Ignore malformed local data.
  }
  return null;
};

const getStoredDraftState = (token: string): PublicDraftState | null => {
  try {
    const raw = localStorage.getItem(getDraftStateStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicDraftState>;
    const selectedItems = normalizeSelectedItems(
      parsed.selectedItems,
    );
    return {
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName : '',
      customerEmail: typeof parsed.customerEmail === 'string' ? parsed.customerEmail : '',
      selectedItems,
      observation: typeof parsed.observation === 'string' ? parsed.observation : '',
    };
  } catch {
    return null;
  }
};

const setStoredDraftState = (token: string, draftState: PublicDraftState) => {
  try {
    localStorage.setItem(getDraftStateStorageKey(token), JSON.stringify(draftState));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const clearStoredDraftState = (token: string) => {
  try {
    localStorage.removeItem(getDraftStateStorageKey(token));
  } catch {
    // Ignore local storage failures on unsupported browsers.
  }
};

const setStoredPendingOrder = (token: string, pendingOrder: PendingPublicOrderSummary) => {
  try {
    const payload = {
      ...pendingOrder,
      selectedItems: pendingOrder.selectedItems,
    };
    localStorage.setItem(getPendingOrderStorageKey(token), JSON.stringify(payload));
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

const buildStripeReturnUrl = (draftId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('draftId', draftId);
  url.hash = '/enviado';
  return url.toString();
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
  lines: order.lines,
  paymentSummary: order.paymentSummary,
  observation: order.observation,
});

function PublicHeader() {
  return (
    <section className="public-topbar">
      <div className="public-content">
        <div className="public-brand-lockup">
          <img
            src="/brand/menu-mark.svg"
            alt="Logo do Maresia Grill"
            className="public-brand-lockup__logo"
          />
        </div>
      </div>
    </section>
  );
}

function PublicStateCard({ icon, title, body, summary, accent = 'gold' }: PublicStateCardProps) {
  const iconTone = accent === 'red'
    ? 'border-[rgba(208,109,86,0.32)] bg-[rgba(208,109,86,0.08)] text-[var(--accent-red)] shadow-[0_0_18px_rgba(208,109,86,0.18)]'
    : accent === 'green'
      ? 'border-[rgba(79,160,109,0.36)] bg-[rgba(79,160,109,0.12)] text-[var(--green)] shadow-[0_0_20px_rgba(79,160,109,0.24)]'
      : 'border-[var(--border-strong)] bg-[rgba(215,176,92,0.09)] text-[var(--accent)] shadow-[0_0_18px_rgba(215,176,92,0.18)]';

  return (
    <section className={`public-panel px-[18px] py-[20px] ${icon ? 'text-center' : ''}`}>
      {icon ? (
        <div className={`mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border ${iconTone}`}>
          {icon}
        </div>
      ) : null}
      <h2 className={`${icon ? 'mt-[18px]' : ''} text-[24px] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--text)] md:text-[28px]`}>
        {title}
      </h2>
      <p className="mt-[12px] text-[14px] leading-[1.65] text-[var(--text-dim)]">
        {body}
      </p>
      {summary ? (
        <div className="public-inline-panel mt-[18px] px-[16px] py-[14px] text-left">
          {summary}
        </div>
      ) : null}
    </section>
  );
}

function PublicOrderSummary({
  paidTotalCents,
  categories,
  selectedItems,
}: {
  paidTotalCents: number;
  categories: string[];
  selectedItems: Array<{ id: string; nome: string; categoria: string; quantity?: number }>;
}) {
  const groupedItems = groupOrderItemsByCategory(
    selectedItems.map(item => ({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      quantity: item.quantity,
    })),
    categories,
  );

  return (
    <>
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] py-[10px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
          Total pago
        </p>
        <p className="mt-[4px] text-[14px] font-semibold text-[var(--accent)]">
          {formatCurrency(paidTotalCents)}
        </p>
      </div>
      <div className="mt-[12px] flex items-center justify-between gap-[10px] text-[12px] text-[var(--text-dim)]">
        <span>Itens escolhidos</span>
        <span>{countSelectedUnits(selectedItems.map(item => ({ itemId: item.id, quantity: item.quantity ?? 1 })))} selecionados</span>
      </div>
      {groupedItems.length > 0 ? (
        <div className="mt-[10px] space-y-[10px]">
          {groupedItems.map(group => (
            <div
              key={group.category}
              className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-[12px] py-[10px]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {group.category}
              </p>
              <ul className="mt-[8px] space-y-[6px] text-[13px] leading-[1.55] text-[var(--text)]">
                {group.names.map(name => (
                  <li key={`${group.category}-${name}`}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function PublicActionBar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="public-action-bar px-0 pt-[10px] pb-[max(16px,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-[880px] px-[4px] sm:px-[6px]">
        {children}
      </div>
    </div>
  );
}

export default function PublicMenuPage({ token }: PublicMenuPageProps) {
  const { showToast } = useToast();
  const { lightTap, mediumTap } = useHapticFeedback();
  const { confirm } = useModal();
  const customerNameInputRef = useRef<HTMLInputElement | null>(null);
  const [menu, setMenu] = useState<PublicMenu | null | undefined>(undefined);
  const [customerName, setCustomerName] = useState(() => getStoredCustomerName());
  const [customerEmail, setCustomerEmail] = useState(() => getStoredCustomerEmail());
  const [observation, setObservation] = useState('');
  const [selection, setSelection] = useState<SelectedPublicItem[]>([]);
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
  const [draftHydratedToken, setDraftHydratedToken] = useState<string | null>(null);
  const lastVisualStateRef = useRef<PublicVisualState | null>(null);
  const selectedCount = countSelectedUnits(selection);

  useEffect(() => {
    const cacheKey = `public-menu-cache:${token}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try { setMenu(JSON.parse(cached) as PublicMenu); } catch { /* ignore corrupt cache */ }
    } else {
      setMenu(undefined);
    }

    const unsubscribe = subscribePublicMenu(token, (result) => {
      setMenu(result);
      if (result !== null) {
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
      } else {
        sessionStorage.removeItem(cacheKey);
      }
    }, () => {
      setMenu(null);
      sessionStorage.removeItem(cacheKey);
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
    setDraftHydratedToken(null);
    const nextOrderId = getStoredOrderId(token);
    setOrderId(nextOrderId);
    setCheckoutSession(null);

    const cachedOrder = getCachedOrder(token);
    const storedView = readViewFromHash() ?? getStoredView(token) ?? 'form';
    const storedCancelledState = getStoredCancelledState(token);
    const storedPendingOrder = getStoredPendingOrder(token);
    const storedDraftState = getStoredDraftState(token);
    const urlDraftId = getDraftIdFromUrl();
    setPendingOrderSummary(storedPendingOrder);
    setPendingPayment(urlDraftId ? { draftId: urlDraftId, paymentStatus: 'awaiting_payment' } : null);

    if (cachedOrder) {
      setCustomerName(cachedOrder.customerName);
      setSelection(selectionFromLines(cachedOrder.lines));
      if (storedView === 'submitted') {
        setSuccessState(cachedOrder);
        setCancelledState(null);
        setCurrentView('submitted');
        setDraftHydratedToken(token);
        return;
      }
      setSuccessState(null);
      setCancelledState(null);
      setCurrentView('form');
      setDraftHydratedToken(token);
      return;
    }

    if (storedView === 'cancelled' && storedCancelledState) {
      setCancelledState(storedCancelledState);
      setSuccessState(null);
      setSelection([]);
      setCurrentView('cancelled');
      setDraftHydratedToken(token);
      return;
    }

    if (urlDraftId && storedPendingOrder) {
      setCustomerName(storedPendingOrder.customerName);
      setSuccessState(null);
      setCancelledState(null);
      setSelection(storedPendingOrder.selectedItems);
      setCurrentView('submitted');
      setDraftHydratedToken(token);
      return;
    }

    if (storedDraftState) {
      setCustomerName(storedDraftState.customerName);
      setCustomerEmail(storedDraftState.customerEmail);
      setObservation(storedDraftState.observation);
      setSelection(storedDraftState.selectedItems);
    } else {
      setCustomerName(getStoredCustomerName());
      setCustomerEmail(getStoredCustomerEmail());
      setSelection([]);
    }

    setSuccessState(null);
    setCancelledState(null);
    setCurrentView('form');
    setDraftHydratedToken(token);
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
        setSelection(selectionFromLines(cachedOrder.lines));
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

    setSelection(prev => prev.filter(item => validIds.has(item.itemId)));
  }, [menu, token]);

  useEffect(() => {
    if (
      draftHydratedToken !== token
      || currentView !== 'form'
      || successState
      || cancelledState
      || pendingPayment
    ) return;

    setStoredDraftState(token, {
      customerName,
      customerEmail,
      observation,
      selectedItems: selection,
    });
  }, [cancelledState, currentView, customerEmail, customerName, draftHydratedToken, observation, pendingPayment, selection, successState, token]);

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
          setSelection(selectionFromLines(nextOrder.lines));
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
  const currentPaymentSummary = useMemo(() => (
    menu
      ? calculateOrderPaymentSummary(menu.items, selection)
      : null
  ), [menu, selection]);
  const pendingSelectedItemIds = pendingOrderSummary?.selectedItems ?? selection;
  const pendingSelectedItems = useMemo(() => {
    if (!menu) return [];
    const itemMap = new Map(menu.items.map(item => [item.id, item] as const));
    return pendingSelectedItemIds
      .map(({ itemId, quantity }) => {
        const item = itemMap.get(itemId);
        return item ? { ...item, quantity } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [menu, pendingSelectedItemIds]);
  const pendingPaymentSummary = pendingOrderSummary?.paymentSummary ?? currentPaymentSummary;
  const selectionViolations = useMemo(() => (
    menu ? validateSelectionRules(menu.items, selection, menu.categorySelectionRules) : []
  ), [menu, selection]);
  const repeatedCategories = useMemo(() => new Set(
    menu?.categorySelectionRules
      .filter(rule => rule.allowRepeatedItems)
      .map(rule => rule.category) ?? []
  ), [menu]);

  const openSubmittedPaymentState = (draftId: string) => {
    setDraftIdInUrl(draftId);
    setPendingPayment({ draftId, paymentStatus: 'awaiting_payment' });
    setCheckoutSession(null);
    setCurrentView('submitted');
  };

  const canIncreaseItemQuantity = (itemId: string, currentSelection: SelectedPublicItem[]) => {
    if (!menu) return;
    const currentQuantity = getSelectedQuantity(currentSelection, itemId);
    const nextSelection = setSelectedQuantity(currentSelection, itemId, currentQuantity + 1);
    const violations = validateSelectionRules(menu.items, nextSelection, menu.categorySelectionRules);
    return violations.find(v => v.type !== 'min') ?? null;
  };

  const incrementItem = (itemId: string) => {
    if (!menu) return;
    lightTap();
    setSelection(prev => {
      const violation = canIncreaseItemQuantity(itemId, prev);
      if (violation) {
        showToast(violation.message, 'info');
        return prev;
      }
      return setSelectedQuantity(prev, itemId, getSelectedQuantity(prev, itemId) + 1);
    });
  };

  const decrementItem = (itemId: string) => {
    lightTap();
    setSelection(prev => setSelectedQuantity(prev, itemId, getSelectedQuantity(prev, itemId) - 1));
  };

  const toggleItem = (id: string) => {
    if (!menu) return;
    lightTap();
    setSelection(prev => {
      const currentQuantity = getSelectedQuantity(prev, id);
      if (currentQuantity > 0) return setSelectedQuantity(prev, id, 0);

      const violation = canIncreaseItemQuantity(id, prev);
      if (violation) {
        showToast(violation.message, 'info');
        return prev;
      }

      return setSelectedQuantity(prev, id, 1);
    });
  };

  const handleSubmit = async () => {
    if (!menu) return;

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      showToast('Informe seu nome.', 'info');
      customerNameInputRef.current?.focus();
      return;
    }
    if (selectedCount === 0) {
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
          selectedItems: selection,
          observation,
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
          setSelection(selectionFromLines(nextOrder.lines));
          clearStoredDraftState(menu.token);
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
            selectedItems: selection,
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
        selectedItems: selection,
        observation,
      });
      const nextOrder = toCachedOrder(submission);
      setCachedOrder(menu.token, nextOrder);
      clearStoredCancelledState(menu.token);
      clearStoredPendingOrder(menu.token);
      clearStoredDraftState(menu.token);
      clearDraftIdFromUrl();
      setPendingPayment(null);
      setPendingOrderSummary(null);
      setCheckoutSession(null);
      setSuccessState(nextOrder);
      setCancelledState(null);
      setSelection(selectionFromLines(nextOrder.lines));
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

    const resetExistingOrderState = () => {
      clearCachedOrder(menu.token);
      clearStoredPendingOrder(menu.token);
      clearStoredCancelledState(menu.token);
      clearStoredDraftState(menu.token);
      clearDraftIdFromUrl();
      setPendingPayment(null);
      setPendingOrderSummary(null);
      setCheckoutSession(null);
      const nextOrderId = createOrderId();
      setStoredOrderId(menu.token, nextOrderId);
      setOrderId(nextOrderId);
      setSelection([]);
      setSuccessState(null);
      setCancelledState(null);
      setCurrentView('form');
    };

    setSubmitting(true);
    try {
      await cancelPublicOrder({
        orderId: successState.orderId,
        dateKey: menu.dateKey,
        shareToken: menu.token,
      });
      clearCachedOrder(menu.token);
      clearStoredPendingOrder(menu.token);
      clearStoredDraftState(menu.token);
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
      if (error instanceof Error && error.message === 'Pedido não encontrado.') {
        resetExistingOrderState();
        return;
      }
      showToast(error instanceof Error ? error.message : 'Não foi possível cancelar o pedido.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (menu === undefined) return <LoadingSpinner />;

  if (cancelledState) {
    return (
      <main className="public-shell flex flex-col">
        <PublicHeader />
        <div className="public-content">
          <PublicStateCard
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            )}
            accent="red"
            title="Seu pedido foi cancelado"
            body={
              canStartNewOrder
                ? `${cancelledState.customerName}, você ainda pode montar um novo pedido neste cardápio.`
                : `${cancelledState.customerName}, a confirmação do cancelamento foi preservada neste link.`
            }
          />
        </div>
        {canStartNewOrder ? (
          <div className="public-content mt-[16px]">
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
              className="neon-gold-fill min-h-[54px] w-full rounded-[20px] bg-[var(--accent)] px-[18px] text-[14px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
            >
              Fazer novo pedido
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  if (successState) {
    return (
      <main className="public-shell flex flex-col">
        <PublicHeader />
        <div className="public-content">
          <PublicStateCard
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            accent="green"
            title="Seu pedido foi enviado"
            body={
              canModifyExistingOrder
                ? 'Se precisar alterar algo, cancele este pedido e faça um novo.'
                : isMenuExpired
                  ? 'A confirmação foi preservada, mas este cardápio não está mais disponível.'
                  : 'A confirmação foi preservada, mas os pedidos já foram encerrados.'
            }
            summary={(
              <>
                {successState.observation ? (
                  <div className="mb-[10px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[14px] py-[12px]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">Observação</p>
                    <p className="mt-[6px] text-[13px] leading-[1.5] text-[var(--text)]">{successState.observation}</p>
                  </div>
                ) : null}
                <PublicOrderSummary
                  paidTotalCents={successState.paymentSummary.paidTotalCents}
                  categories={menu?.categories ?? []}
                  selectedItems={successState.lines.map(line => ({
                    id: line.itemId,
                    nome: line.name,
                    categoria: line.categoryName,
                    quantity: line.quantity,
                  }))}
                />
              </>
            )}
          />
        </div>
        {canModifyExistingOrder ? (
          <div className="public-content mt-[16px]">
            <button
              type="button"
              onClick={() => {
                mediumTap();
                void handleDeleteOrder();
              }}
              disabled={submitting}
              className="min-h-[54px] w-full rounded-[20px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)] px-[18px] text-[14px] font-semibold text-[var(--accent-red)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {successState.paymentSummary.paidTotalCents > 0 ? 'Cancelar e estornar' : 'Cancelar pedido'}
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  if (currentView === 'submitted' && pendingPayment && !successState) {
    return (
      <main className="public-shell flex flex-col">
        <PublicHeader />
        <div className="public-content">
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
                paidTotalCents={pendingPaymentSummary?.paidTotalCents ?? 0}
                categories={menu?.categories ?? []}
                selectedItems={pendingSelectedItems.map(item => ({
                  id: item.id,
                  nome: item.nome,
                  categoria: item.categoria,
                  quantity: item.quantity,
                }))}
              />
            )}
          />
        </div>
        {pendingPayment.paymentStatus === 'failed' ? (
          <PublicActionBar>
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
              className="min-h-[54px] w-full rounded-[20px] border border-[var(--border-strong)] bg-[var(--bg)] px-[18px] text-[14px] font-semibold text-[var(--text)] transition-opacity hover:opacity-90"
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
        <PublicHeader />
        <div className="public-content">
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
        </div>
      </main>
    );
  }

  if (!menu.acceptingOrders) {
    return (
      <main className="public-shell">
        <PublicHeader />
        <div className="public-content">
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
        </div>
      </main>
    );
  }

  return (
    <main className="public-shell flex flex-col">
      <PublicHeader />

      <div className="public-content">
        <section className="public-panel px-[18px] py-[18px] md:px-[22px] md:py-[20px]">
          <h2 className="text-[21px] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--text)] md:text-[24px]">
            Identificação
          </h2>

          <label className="mt-[16px] block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Seu nome
            <input
              ref={customerNameInputRef}
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Digite seu nome"
              className="neon-gold-focus mt-[8px] w-full rounded-[20px] border border-[var(--border)] bg-[rgba(255,248,232,0.05)] px-[16px] py-[15px] text-[16px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
            />
          </label>

          <label className="mt-[16px] block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Observação
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Ex: sem cebola, alérgico a amendoim"
              maxLength={500}
              rows={3}
              className="neon-gold-focus mt-[8px] w-full resize-none rounded-[20px] border border-[var(--border)] bg-[rgba(255,248,232,0.05)] px-[16px] py-[15px] text-[16px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
            />
          </label>
        </section>

        <section className="mt-[16px] grid gap-[14px] pb-[calc(128px+env(safe-area-inset-bottom))] lg:grid-cols-2 lg:items-start lg:pb-[calc(146px+env(safe-area-inset-bottom))]">
        {itemsByCategory.map(({ category, items }) => (
          <section
            key={category}
            className="public-panel px-[18px] py-[18px] md:px-[22px] md:py-[20px]"
          >
            <div className="flex items-center justify-between gap-[12px]">
              <div>
                <h2 className="text-[20px] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--text)] md:text-[22px]">
                  {category}
                </h2>
              </div>
              <div className="public-pill neon-gold-text text-[14px] font-semibold text-[var(--accent)]">
                {items.length}
              </div>
            </div>
            {describeCategorySelectionRule(category, menu.categorySelectionRules) ? (
              <p className="neon-gold-text mt-[10px] text-[13px] leading-[1.55] text-[var(--accent)]">
                {describeCategorySelectionRule(category, menu.categorySelectionRules)}
              </p>
            ) : null}
            <ul className="mt-[14px] flex list-none flex-col gap-[10px]">
              {items.map(item => {
                const quantity = getSelectedQuantity(selection, item.id);
                const active = quantity > 0;
                const allowsRepeating = repeatedCategories.has(category);
                const blockingViolation = canIncreaseItemQuantity(item.id, selection);
                const blockingMessage = !active && blockingViolation ? blockingViolation.message : null;
                const canIncrement = !submitting && !blockingViolation;
                return (
                  <li key={item.id}>
                    {allowsRepeating ? (
                      <div
                        className={`public-choice grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-[12px] px-[14px] py-[13px] ${
                          blockingViolation && quantity === 0 ? 'opacity-80' : ''
                        }`}
                      >
                        <span className="min-w-0">
                          <span className={`block text-[14px] leading-[1.25] ${
                            active ? 'font-semibold text-[var(--text)]' : 'font-medium text-[var(--text-muted)]'
                          }`}>
                            {item.nome}
                          </span>
                          {typeof item.priceCents === 'number' && item.priceCents > 0 ? (
                            <span className="neon-gold-text mt-[5px] block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                              {formatCurrency(item.priceCents)}
                            </span>
                          ) : null}
                          {blockingMessage ? (
                            <span className="mt-[5px] block text-[11px] leading-[1.45] text-[var(--text-dim)]">
                              {blockingMessage}
                            </span>
                          ) : null}
                        </span>
                        <div className="flex min-w-[116px] shrink-0 items-center justify-end gap-[8px] self-center">
                          <button
                            type="button"
                            onClick={() => decrementItem(item.id)}
                            disabled={submitting || quantity === 0}
                            aria-label={`Diminuir ${item.nome}`}
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[17px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="flex min-w-[26px] items-center justify-center text-[14px] font-semibold text-[var(--text)]">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => incrementItem(item.id)}
                            disabled={!canIncrement}
                            aria-label={`Aumentar ${item.nome}`}
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--bg-elevated)] text-[17px] text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        disabled={submitting || Boolean(blockingViolation && !active)}
                        aria-pressed={active}
                        aria-label={`${active ? 'Remover' : 'Adicionar'} ${item.nome} do menu do dia`}
                        className={`public-choice flex min-h-[68px] w-full items-center gap-[12px] px-[14px] py-[12px] text-left disabled:cursor-not-allowed ${
                          blockingViolation && !active ? 'opacity-45 grayscale-[0.2]' : 'disabled:opacity-60'
                        }`}
                      >
                        <span
                          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[12px] border text-[14px] font-bold transition-colors ${
                            active
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] shadow-[0_6px_16px_rgba(215,176,92,0.22)]'
                              : blockingViolation
                                ? 'border-[var(--border)] bg-[rgba(255,255,255,0.01)] text-transparent'
                                : 'border-[var(--border-strong)] bg-[rgba(255,255,255,0.02)] text-transparent'
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[14px] leading-[1.25] ${
                            active
                              ? 'font-semibold text-[var(--text)]'
                              : blockingViolation
                                ? 'font-medium text-[var(--text-dim)]'
                                : 'font-medium text-[var(--text-muted)]'
                          }`}>
                            {item.nome}
                          </span>
                          {typeof item.priceCents === 'number' && item.priceCents > 0 ? (
                            <span className="neon-gold-text mt-[5px] block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                              {formatCurrency(item.priceCents)}
                            </span>
                          ) : null}
                          {blockingMessage ? (
                            <span className="mt-[5px] block text-[11px] leading-[1.45] text-[var(--text-dim)]">
                              {blockingMessage}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        </section>
      </div>

      <PublicActionBar>
        <div className="px-[12px] py-[10px] md:px-[16px] md:py-[14px]">
          <div className="mb-[10px] flex items-end justify-between gap-[12px]">
            <div className="min-w-0">
              {selectionViolations[0] ? (
                <p className="text-[13px] leading-[1.6] text-[var(--accent-red)]">
                  {selectionViolations[0].message}
                </p>
              ) : null}
            </div>
            {currentPaymentSummary ? (
              <div className="min-w-[124px] text-right md:min-w-[190px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Total a pagar
                </p>
                <p className="neon-gold-text mt-[4px] text-[16px] font-semibold text-[var(--accent)]">
                  {formatCurrency(currentPaymentSummary.paidTotalCents)}
                </p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              mediumTap();
              void handleSubmit();
            }}
            disabled={submitting}
            className="neon-gold-fill min-h-[52px] w-full rounded-[20px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="max-h-[min(78vh,720px)] overflow-hidden pt-[2px]">
            <EmbeddedStripeCheckout
              clientSecret={checkoutSession.clientSecret}
              initialEmail={customerEmail}
              onEmailChange={setCustomerEmail}
              returnUrl={buildStripeReturnUrl(checkoutSession.draftId)}
              onComplete={() => openSubmittedPaymentState(checkoutSession.draftId)}
            />
          </div>
        ) : null}
      </BottomSheet>
    </main>
  );
}
