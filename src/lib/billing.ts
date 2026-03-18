import type { Item, OrderPaymentSummary, PaymentMethodType, PaymentProvider } from '../types';

export const normalizePriceCents = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const normalized = Math.round(value);
  return normalized >= 0 ? normalized : null;
};

export const isPaidItem = (item: Item) => (normalizePriceCents(item.priceCents) ?? 0) > 0;

export const calculateOrderPaymentSummary = (
  items: Item[],
  selectedItemIds: string[],
  paymentStatus: OrderPaymentSummary['paymentStatus'] = 'not_required',
  provider: PaymentProvider | null = null,
  paymentMethod: PaymentMethodType | null = null,
): OrderPaymentSummary => {
  let freeTotalCents = 0;
  let paidTotalCents = 0;

  for (const item of items) {
    if (!selectedItemIds.includes(item.id)) continue;

    const priceCents = normalizePriceCents(item.priceCents) ?? 0;
    if (priceCents > 0) {
      paidTotalCents += priceCents;
    } else {
      freeTotalCents += priceCents;
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
