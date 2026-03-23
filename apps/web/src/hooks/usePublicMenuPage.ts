import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FinalizedPublicOrder, OrderLine, OrderPaymentSummary, PublicMenu, PublicOrderCheckoutSession, SelectedPublicItem } from '../types';
import {
  cancelPublicOrder,
  fetchPublicOrderStatus,
  preparePublicOrderCheckout,
  submitPublicOrder,
  subscribePublicMenu,
} from '../lib/storage';
import { useToast } from './useToast';
import { useHapticFeedback } from './useHapticFeedback';
import { useModal } from './useModal';
import { validateSelectionRules } from '../lib/categorySelectionRules';
import { calculateOrderPaymentSummary } from '../lib/billing';

const CUSTOMER_NAME_STORAGE_KEY = 'public-menu-customer-name';
const CUSTOMER_EMAIL_STORAGE_KEY = 'public-menu-customer-email';

interface PublicDraftState {
  customerName: string;
  customerEmail: string;
  selectedItems: SelectedPublicItem[];
  observation: string;
}

export interface CachedPublicOrder {
  orderId: string;
  customerName: string;
  lines: OrderLine[];
  paymentSummary: OrderPaymentSummary;
  observation?: string;
}

export interface CancelledPublicOrderState {
  customerName: string;
}

export interface PendingPublicPaymentState {
  draftId: string;
  paymentStatus: OrderPaymentSummary['paymentStatus'];
}

export interface PendingPublicOrderSummary {
  customerName: string;
  selectedItems: SelectedPublicItem[];
  paymentSummary: OrderPaymentSummary;
}

export type PublicMenuView = 'form' | 'submitted' | 'cancelled';
type PublicVisualState = 'form' | 'submitted-pending' | 'submitted-success' | 'cancelled';

const getStoredCustomerName = () => {
  try { return localStorage.getItem(CUSTOMER_NAME_STORAGE_KEY) ?? ''; } catch { return ''; }
};

const setStoredCustomerName = (name: string) => {
  try { localStorage.setItem(CUSTOMER_NAME_STORAGE_KEY, name); } catch { /* unsupported */ }
};

const getStoredCustomerEmail = () => {
  try { return localStorage.getItem(CUSTOMER_EMAIL_STORAGE_KEY) ?? ''; } catch { return ''; }
};

const setStoredCustomerEmail = (email: string) => {
  try { localStorage.setItem(CUSTOMER_EMAIL_STORAGE_KEY, email); } catch { /* unsupported */ }
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

export const countSelectedUnits = (selectedItems: SelectedPublicItem[]) => (
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
    case '#/pedido': return 'form';
    case '#/enviado': return 'submitted';
    case '#/cancelado': return 'cancelled';
    default: return null;
  }
};

const getStoredView = (token: string): PublicMenuView | null => {
  try {
    const value = localStorage.getItem(getViewStorageKey(token));
    if (value === 'form' || value === 'submitted' || value === 'cancelled') return value;
  } catch { /* ignore */ }
  return null;
};

const setStoredView = (token: string, view: PublicMenuView) => {
  try { localStorage.setItem(getViewStorageKey(token), view); } catch { /* unsupported */ }
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

const setStoredOrderId = (token: string, nextOrderId: string) => {
  try { localStorage.setItem(getOrderSessionStorageKey(token), nextOrderId); } catch { /* unsupported */ }
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
  } catch { /* ignore malformed data */ }
  return null;
};

const setCachedOrder = (token: string, order: CachedPublicOrder) => {
  try { localStorage.setItem(getCachedOrderStorageKey(token), JSON.stringify(order)); } catch { /* unsupported */ }
};

export const clearCachedOrder = (token: string) => {
  try { localStorage.removeItem(getCachedOrderStorageKey(token)); } catch { /* unsupported */ }
};

const getStoredCancelledState = (token: string): CancelledPublicOrderState | null => {
  try {
    const raw = localStorage.getItem(getCancelledStateStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CancelledPublicOrderState>;
    if (typeof parsed.customerName === 'string' && parsed.customerName.trim()) {
      return { customerName: parsed.customerName };
    }
  } catch { /* ignore */ }
  return null;
};

const setStoredCancelledState = (token: string, state: CancelledPublicOrderState) => {
  try { localStorage.setItem(getCancelledStateStorageKey(token), JSON.stringify(state)); } catch { /* unsupported */ }
};

export const clearStoredCancelledState = (token: string) => {
  try { localStorage.removeItem(getCancelledStateStorageKey(token)); } catch { /* unsupported */ }
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
      return { customerName: parsed.customerName, selectedItems, paymentSummary: parsed.paymentSummary };
    }
  } catch { /* ignore */ }
  return null;
};

const setStoredPendingOrder = (token: string, pendingOrder: PendingPublicOrderSummary) => {
  try {
    localStorage.setItem(getPendingOrderStorageKey(token), JSON.stringify({
      ...pendingOrder,
      selectedItems: pendingOrder.selectedItems,
    }));
  } catch { /* unsupported */ }
};

const clearStoredPendingOrder = (token: string) => {
  try { localStorage.removeItem(getPendingOrderStorageKey(token)); } catch { /* unsupported */ }
};

const getStoredDraftState = (token: string): PublicDraftState | null => {
  try {
    const raw = localStorage.getItem(getDraftStateStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicDraftState>;
    const selectedItems = normalizeSelectedItems(parsed.selectedItems);
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
  try { localStorage.setItem(getDraftStateStorageKey(token), JSON.stringify(draftState)); } catch { /* unsupported */ }
};

const clearStoredDraftState = (token: string) => {
  try { localStorage.removeItem(getDraftStateStorageKey(token)); } catch { /* unsupported */ }
};

const getDraftIdFromUrl = () => new URLSearchParams(window.location.search).get('draftId');

const setDraftIdInUrl = (draftId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('draftId', draftId);
  url.hash = '#/enviado';
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

export const clearDraftIdFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('draftId');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${window.location.hash}`);
};

export const buildStripeReturnUrl = (draftId: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('draftId', draftId);
  url.hash = '/enviado';
  return url.toString();
};

const toCachedOrder = (order: FinalizedPublicOrder): CachedPublicOrder => ({
  orderId: order.orderId,
  customerName: order.customerName,
  lines: order.lines,
  paymentSummary: order.paymentSummary,
  observation: order.observation,
});

export function usePublicMenuPage(token: string) {
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
  const [currentView, setCurrentView] = useState<PublicMenuView>(
    () => readViewFromHash() ?? getStoredView(token) ?? 'form',
  );
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

  useEffect(() => { setStoredCustomerName(customerName); }, [customerName]);

  useEffect(() => { setStoredCustomerEmail(customerEmail); }, [customerEmail]);

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
    setStoredDraftState(token, { customerName, customerEmail, observation, selectedItems: selection });
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
    menu ? calculateOrderPaymentSummary(menu.items, selection) : null
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
    menu ? validateSelectionRules(menu.items, selection, menu.categorySelectionRules).filter(v => v.type !== 'min') : []
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
      await cancelPublicOrder({ orderId: successState.orderId, dateKey: menu.dateKey, shareToken: menu.token });
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

  const handleStartNewOrderFromCancelled = () => {
    lightTap();
    clearStoredCancelledState(token);
    setCancelledState(null);
    setSuccessState(null);
    setSelection([]);
    setCurrentView('form');
  };

  const handleRetryFromFailedPayment = () => {
    lightTap();
    clearDraftIdFromUrl();
    clearStoredPendingOrder(token);
    setPendingPayment(null);
    setPendingOrderSummary(null);
    setCurrentView('form');
  };

  const handleCheckoutClose = () => {
    lightTap();
    setSubmitting(false);
    setCheckoutSession(null);
    setPendingPayment(null);
  };

  return {
    menu,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    observation,
    setObservation,
    selection,
    submitting,
    successState,
    cancelledState,
    checkoutSession,
    pendingOrderSummary,
    pendingPayment,
    currentView,
    selectedCount,
    itemsByCategory,
    canModifyExistingOrder,
    canStartNewOrder,
    isMenuExpired,
    currentPaymentSummary,
    pendingSelectedItems,
    pendingPaymentSummary,
    selectionViolations,
    repeatedCategories,
    customerNameInputRef,
    lightTap,
    mediumTap,
    openSubmittedPaymentState,
    canIncreaseItemQuantity,
    incrementItem,
    decrementItem,
    toggleItem,
    handleSubmit,
    handleDeleteOrder,
    handleStartNewOrderFromCancelled,
    handleRetryFromFailedPayment,
    handleCheckoutClose,
  };
}
