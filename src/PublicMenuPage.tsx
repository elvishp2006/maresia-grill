import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PublicMenu } from './types';
import ItemList from './components/ItemList';
import LoadingSpinner from './components/LoadingSpinner';
import { submitPublicOrder, subscribePublicMenu } from './lib/storage';
import { useToast } from './contexts/ToastContext';
import { useHapticFeedback } from './hooks/useHapticFeedback';

const CUSTOMER_NAME_STORAGE_KEY = 'public-menu-customer-name';

interface CachedPublicOrder {
  orderId: string;
  customerName: string;
  selectedItemIds: string[];
}

interface PublicMenuPageProps {
  token: string;
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

const getOrderSessionStorageKey = (token: string) => `public-menu-order-session:${token}`;
const getCachedOrderStorageKey = (token: string) => `public-menu-last-order:${token}`;

const getStoredOrderId = (token: string) => {
  try {
    const key = getOrderSessionStorageKey(token);
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const next = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `public-order-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return `public-order-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
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
      return {
        orderId: parsed.orderId,
        customerName: parsed.customerName,
        selectedItemIds: parsed.selectedItemIds,
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

export default function PublicMenuPage({ token }: PublicMenuPageProps) {
  const { showToast } = useToast();
  const { lightTap, mediumTap } = useHapticFeedback();
  const [menu, setMenu] = useState<PublicMenu | null | undefined>(undefined);
  const [customerName, setCustomerName] = useState(() => getStoredCustomerName());
  const [selection, setSelection] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState(() => getStoredOrderId(token));
  const [successState, setSuccessState] = useState<CachedPublicOrder | null>(null);
  const [footerHeight, setFooterHeight] = useState(112);
  const footerRef = useRef<HTMLDivElement | null>(null);

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
    const nextOrderId = getStoredOrderId(token);
    setOrderId(nextOrderId);

    const cachedOrder = getCachedOrder(token);
    if (!cachedOrder) return;

    setCustomerName(cachedOrder.customerName);
    setSelection(cachedOrder.selectedItemIds);
    setSuccessState(null);
  }, [token]);

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

  const itemsByCategory = useMemo(() => {
    if (!menu) return [];
    return menu.categories.map(category => ({
      category,
      items: menu.items.filter(item => item.categoria === category),
    }));
  }, [menu]);

  const toggleItem = (id: string) => {
    setSelection(prev => (
      prev.includes(id)
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    ));
  };

  const handleSubmit = async () => {
    if (!menu) return;

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      showToast('Informe o nome do cliente.', 'info');
      return;
    }
    if (selection.length === 0) {
      showToast('Selecione pelo menos um item.', 'info');
      return;
    }

    setSubmitting(true);
    try {
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
      };
      setCachedOrder(menu.token, nextOrder);
      setSuccessState(nextOrder);
      setSelection(persistedSelection);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível enviar o pedido.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (menu === undefined) return <LoadingSpinner />;

  if (!menu) {
    return (
      <main className="app-shell">
        <section className="sticky top-0 z-30 -mx-[16px] mb-[18px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[12px] pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-[18px]">
          <div className="flex items-center gap-[10px]">
            <img
              src="/brand/menu-mark.svg"
              alt="Logo do Maresia Grill"
              className="h-[28px] w-[28px] shrink-0 object-cover object-top"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent-red)]">
                Link expirado
              </p>
              <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[22px] font-bold text-[var(--text)]">
                Pedido do dia
              </h1>
            </div>
          </div>
        </section>

        <section className="section-card">
          <h2 className="font-[Georgia,'Times_New_Roman',serif] text-[28px] font-bold text-[var(--text)]">
            Este cardápio não está mais disponível
          </h2>
          <p className="mt-[12px] text-[15px] leading-[1.7] text-[var(--text-dim)]">
            O link é válido apenas para o cardápio do dia. Solicite um novo compartilhamento.
          </p>
        </section>
      </main>
    );
  }

  if (!menu.acceptingOrders) {
    return (
      <main className="app-shell">
        <section className="sticky top-0 z-30 -mx-[16px] mb-[18px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[12px] pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-[18px]">
          <div className="flex items-center gap-[10px]">
            <img
              src="/brand/menu-mark.svg"
              alt="Logo do Maresia Grill"
              className="h-[28px] w-[28px] shrink-0 object-cover object-top"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent-red)]">
                Pedidos encerrados
              </p>
              <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[22px] font-bold text-[var(--text)]">
                Pedido do dia
              </h1>
            </div>
          </div>
        </section>

        <section className="section-card border border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)]">
          <h2 className="font-[Georgia,'Times_New_Roman',serif] text-[28px] font-bold text-[var(--text)]">
            O recebimento de pedidos foi encerrado
          </h2>
          <p className="mt-[12px] text-[15px] leading-[1.7] text-[var(--text-dim)]">
            A cozinha já está montando os pratos deste cardápio. Se precisar, solicite um novo posicionamento do restaurante.
          </p>
        </section>
      </main>
    );
  }

  if (successState) {
    return (
      <main className="app-shell flex flex-col" style={{ paddingBottom: `${footerHeight + 24}px` }}>
        <section className="sticky top-0 z-30 -mx-[16px] mb-[18px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[12px] pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-[18px]">
          <div className="flex items-center gap-[10px]">
            <img
              src="/brand/menu-mark.svg"
              alt="Logo do Maresia Grill"
              className="h-[28px] w-[28px] shrink-0 object-cover object-top"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
                Pedido salvo
              </p>
              <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[22px] font-bold text-[var(--text)]">
                Maresia Grill
              </h1>
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="mt-[16px] font-[Georgia,'Times_New_Roman',serif] text-[30px] font-bold text-[var(--text)]">
            Seu pedido foi enviado
          </h2>
          <p className="mt-[12px] text-[15px] leading-[1.7] text-[var(--text-dim)]">
            Se você enviar novamente por este link, o pedido anterior será atualizado.
          </p>

          <div className="mt-[18px] rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] px-[16px] py-[14px]">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Cliente
            </p>
            <p className="mt-[6px] text-[16px] font-semibold text-[var(--text)]">
              {successState.customerName}
            </p>
            <p className="mt-[10px] text-[13px] leading-[1.6] text-[var(--text-dim)]">
              {successState.selectedItemIds.length} complementos selecionados
            </p>
          </div>
        </section>

        <div
          ref={footerRef}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[max(16px,env(safe-area-inset-bottom))] pt-[10px] backdrop-blur-[18px]"
        >
          <div className="mx-auto w-full max-w-[960px]">
          <button
            type="button"
            onClick={() => {
              lightTap();
              setCustomerName(successState.customerName);
              setSelection(successState.selectedItemIds);
              setSuccessState(null);
            }}
            className="neon-gold-fill min-h-[54px] w-full rounded-[20px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
          >
            Editar pedido
          </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell" style={{ paddingBottom: `${footerHeight + 24}px` }}>
      <section className="sticky top-0 z-30 -mx-[16px] mb-[18px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[12px] pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-[18px]">
        <div className="flex items-start justify-between gap-[10px]">
          <div className="flex items-center gap-[10px]">
            <img
              src="/brand/menu-mark.svg"
              alt="Logo do Maresia Grill"
              className="h-[28px] w-[28px] shrink-0 object-cover object-top"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
                Cardápio do dia
              </p>
              <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[22px] font-bold text-[var(--text)]">
                Faça seu pedido
              </h1>
            </div>
          </div>
          <span className="neon-gold-border neon-gold-text rounded-full bg-[var(--accent-soft)] px-[10px] py-[4px] text-[11px] font-semibold text-[var(--accent)]">
            {menu.items.length} itens
          </span>
        </div>
      </section>

      <section className="section-card">
        <p className="text-[14px] leading-[1.7] text-[var(--text-dim)]">
          Preencha seu nome antes de escolher os complementos.
        </p>

        <label className="mt-[18px] block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Nome do cliente
          <input
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Digite seu nome"
            className="neon-gold-focus mt-[8px] w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
          />
        </label>
      </section>

      <section className="mt-[18px] space-y-[14px]">
        {itemsByCategory.map(({ category, items }) => (
          <section
            key={category}
            className="section-card border border-[var(--border)] bg-[var(--bg-card)]"
          >
            <div className="flex items-start justify-between gap-[10px]">
              <h2 className="font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
                {category}
              </h2>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-[10px] py-[4px] text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                {items.length}
              </span>
            </div>
            <div className="mt-[6px] text-[13px] leading-[1.5] text-[var(--text-dim)]">
              Escolha os complementos desejados.
            </div>
            <div className="mt-[14px]">
              <ItemList
                items={items}
                daySelection={selection}
                search=""
                sortMode="alpha"
                usageCounts={{}}
                viewMode="select"
                onToggle={toggleItem}
                onRemove={() => {}}
                onRename={() => {}}
                isOnline={!submitting}
              />
            </div>
          </section>
        ))}
      </section>

      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[max(16px,env(safe-area-inset-bottom))] pt-[10px] backdrop-blur-[18px]"
      >
        <div className="mx-auto w-full max-w-[960px]">
          <button
            type="button"
            onClick={() => {
              mediumTap();
              void handleSubmit();
            }}
            disabled={submitting}
            className="neon-gold-fill min-h-[54px] w-full rounded-[20px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar pedido'}
          </button>
        </div>
      </div>
    </main>
  );
}
