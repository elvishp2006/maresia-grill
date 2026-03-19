import {
  calculateOrderPaymentSummaryFromLines,
  normalizePriceCents as normalizePriceCentsValue,
  resolveOrderLines,
} from '../../domain/menu';
import type { Item, OrderPaymentSummary, PaymentMethodType, PaymentProvider, SelectedPublicItem } from '../types';

export const normalizePriceCents = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return normalizePriceCentsValue(value);
};

export const isPaidItem = (item: Item) => (
  normalizePriceCents(item.priceCents) ?? 0
) > 0;

export const calculateOrderPaymentSummary = (
  items: Array<{ id: string; categoria?: string; categoryId?: string; nome?: string; name?: string; priceCents?: number | null }>,
  selectedItems: string[] | SelectedPublicItem[],
  paymentStatus: OrderPaymentSummary['paymentStatus'] = 'not_required',
  provider: PaymentProvider | null = null,
  paymentMethod: PaymentMethodType | null = null,
): OrderPaymentSummary => {
  const version = {
    id: 'inline',
    dateKey: 'inline',
    shareToken: 'inline',
    createdAt: Date.now(),
    categories: Array.from(new Set(items.map(item => item.categoryId ?? item.categoria ?? 'sem-categoria'))).map((categoryId, index) => ({
      id: categoryId,
      name: items.find(item => (item.categoryId ?? item.categoria) === categoryId)?.categoria ?? categoryId,
      sortOrder: index,
      selectionPolicy: { allowRepeatedItems: false, maxSelections: null, sharedLimitGroupId: null },
    })),
    items: items.map((item, index) => ({
      id: item.id,
      categoryId: item.categoryId ?? item.categoria ?? 'sem-categoria',
      name: item.name ?? item.nome ?? '',
      priceCents: normalizePriceCents(item.priceCents) ?? 0,
      sortOrder: index,
    })),
  };
  const normalizedSelection = Array.isArray(selectedItems) && typeof selectedItems[0] === 'string'
    ? Array.from(new Map((selectedItems as string[]).map(itemId => [itemId, ((selectedItems as string[]).filter(id => id === itemId).length)])).entries())
        .map(([itemId, quantity]) => ({ itemId, quantity }))
    : selectedItems as SelectedPublicItem[];

  const lines = resolveOrderLines(version, normalizedSelection);
  return calculateOrderPaymentSummaryFromLines(lines, paymentStatus, provider, paymentMethod);
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
