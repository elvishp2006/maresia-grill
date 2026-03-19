import type { Item, OrderPaymentSummary, PaymentMethodType, PaymentProvider, SelectedPublicItem } from '../types';

export const normalizePriceCents = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const normalized = Math.round(value);
  return normalized >= 0 ? normalized : null;
};

export const isPaidItem = (item: Item) => (normalizePriceCents(item.priceCents) ?? 0) > 0;

const normalizeSelectedItems = (selection: string[] | SelectedPublicItem[]) => {
  if (selection.length === 0) return [] as SelectedPublicItem[];

  if (typeof selection[0] === 'string') {
    const counts = new Map<string, number>();
    for (const itemId of selection as string[]) {
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
  }

  return (selection as SelectedPublicItem[])
    .filter(item => typeof item.itemId === 'string' && Number.isFinite(item.quantity) && item.quantity > 0)
    .map(item => ({ itemId: item.itemId, quantity: Math.trunc(item.quantity) }));
};

export const calculateOrderPaymentSummary = (
  items: Item[],
  selectedItemIds: string[] | SelectedPublicItem[],
  paymentStatus: OrderPaymentSummary['paymentStatus'] = 'not_required',
  provider: PaymentProvider | null = null,
  paymentMethod: PaymentMethodType | null = null,
): OrderPaymentSummary => {
  let freeTotalCents = 0;
  let paidTotalCents = 0;
  const selectedItems = normalizeSelectedItems(selectedItemIds);
  const selectedQuantities = new Map(selectedItems.map(item => [item.itemId, item.quantity]));

  for (const item of items) {
    const quantity = selectedQuantities.get(item.id) ?? 0;
    if (quantity <= 0) continue;

    const priceCents = normalizePriceCents(item.priceCents) ?? 0;
    if (priceCents > 0) {
      paidTotalCents += priceCents * quantity;
    } else {
      freeTotalCents += priceCents * quantity;
    }
  }

  return {
    freeTotalCents,
    paidTotalCents,
    currency: 'BRL',
    paymentStatus,
    provider,
    paymentMethod,
    providerPaymentId: null,
    refundedAt: null,
  };
};

export const formatCurrency = (valueCents: number) => (
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((valueCents ?? 0) / 100)
);

export const parsePriceInputToCents = (value: string): number | null => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

export const formatPriceInputFromCents = (value: number | null | undefined): string => {
  const normalized = normalizePriceCents(value);
  if (normalized === null) return '0,00';
  return (normalized / 100).toFixed(2).replace('.', ',');
};

export const normalizePriceInputDigits = (value: string) => (
  formatPriceInputFromCents(parsePriceInputToCents(value) ?? 0)
);
