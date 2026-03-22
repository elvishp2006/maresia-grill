import {
  calculateOrderPaymentSummaryFromLines,
  normalizePriceCents,
  normalizeSelectionEntries,
  resolveOrderLines,
  validateSelection as validateDomainSelection,
} from '../../../packages/domain/src/menu.js';
import type {
  OrderPaymentSummary,
  PaymentMethodType,
  PaymentProvider,
  PublicOrderPaymentStatus,
  PublishedMenuVersion,
  SelectionEntry,
} from '../../../packages/domain/src/menu.js';

export type PaymentStatus = PublicOrderPaymentStatus;
export type PaymentProviderName = Extract<PaymentProvider, 'stripe'>;
export type PaymentMethod = PaymentMethodType | null;
export type SelectedPublicItem = SelectionEntry;
export type PublicMenuVersionDocument = PublishedMenuVersion;

export interface FinalizedOrderReference {
  sourceDraftId?: string | null;
  paymentSummary?: Partial<Pick<OrderPaymentSummary, 'providerPaymentId' | 'paidTotalCents'>> | null;
}

export const normalizeCustomerName = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('Nome do cliente inválido.');
  const normalized = value.trim();
  if (!normalized) throw new Error('Informe o nome para finalizar o pedido.');
  return normalized;
};

export const createBasePaymentSummary = (
  versionOrItems: PublishedMenuVersion | Array<{ id: string; nome: string; categoria: string; priceCents?: number | null }>,
  selectedItems: SelectedPublicItem[] | string[],
  paymentStatus: PaymentStatus,
): OrderPaymentSummary => {
  const version = Array.isArray(versionOrItems)
    ? {
        id: 'inline',
        dateKey: 'inline',
        shareToken: 'inline',
        createdAt: Date.now(),
        categories: Array.from(new Set(versionOrItems.map(item => item.categoria))).map((categoryName, index) => ({
          id: categoryName,
          name: categoryName,
          sortOrder: index,
          selectionPolicy: { allowRepeatedItems: false, maxSelections: null, sharedLimitGroupId: null },
        })),
        items: versionOrItems.map((item, index) => ({
          id: item.id,
          categoryId: item.categoria,
          name: item.nome,
          priceCents: normalizePriceCents(item.priceCents),
          sortOrder: index,
        })),
      } satisfies PublishedMenuVersion
    : versionOrItems;
  const normalizedSelection = Array.isArray(selectedItems) && typeof selectedItems[0] === 'string'
    ? normalizeSelectionEntries(undefined, selectedItems as string[])
    : selectedItems as SelectedPublicItem[];
  const lines = resolveOrderLines(version, normalizedSelection);
  return calculateOrderPaymentSummaryFromLines(lines, paymentStatus);
};

export const validateSelectionForVersion = (
  version: PublishedMenuVersion,
  selectedItems: SelectedPublicItem[] | string[],
) => {
  const normalizedSelection = Array.isArray(selectedItems) && typeof selectedItems[0] === 'string'
    ? normalizeSelectionEntries(undefined, selectedItems as string[])
    : selectedItems as SelectedPublicItem[];
  const violations = validateDomainSelection(version.categories, version.items, normalizedSelection);
  if (violations.length > 0) {
    throw new Error(violations[0]?.message ?? 'Selecao invalida.');
  }
};

export const validateSelection = (
  items: Array<{ id: string; categoria: string; nome?: string; priceCents?: number | null }>,
  selectedItems: SelectedPublicItem[] | string[],
  rules: Array<{ category: string; minSelections?: number | null; maxSelections?: number | null; sharedLimitGroupId?: string | null; allowRepeatedItems?: boolean | null }>,
// eslint-disable-next-line sonarjs/cognitive-complexity -- TODO: refactor
) => {
  const normalizedSelection = Array.isArray(selectedItems) && typeof selectedItems[0] === 'string'
    ? normalizeSelectionEntries(undefined, selectedItems as string[])
    : selectedItems as SelectedPublicItem[];
  const counts = new Map<string, number>();
  const itemCategoryById = new Map(items.map(item => [item.id, item.categoria]));

  normalizedSelection.forEach(({ itemId, quantity }) => {
    const category = itemCategoryById.get(itemId);
    if (!category) return;
    counts.set(category, (counts.get(category) ?? 0) + quantity);
  });

  // Pre-pass: accumulate group counts for all rules regardless of max/min presence,
  // so both max-group and min-group validation loops see correct totals.
  const groupedCounts = new Map<string, number>();
  for (const rule of rules) {
    if (!rule.sharedLimitGroupId) continue;
    const categoryCount = counts.get(rule.category) ?? 0;
    groupedCounts.set(rule.sharedLimitGroupId, (groupedCounts.get(rule.sharedLimitGroupId) ?? 0) + categoryCount);
  }

  for (const rule of rules) {
    if (typeof rule.maxSelections !== 'number') continue;
    const categoryCount = counts.get(rule.category) ?? 0;
    if (!rule.sharedLimitGroupId && categoryCount > rule.maxSelections) {
      throw new Error(`A categoria ${rule.category} excedeu o limite permitido.`);
    }
  }

  for (const rule of rules) {
    if (typeof rule.maxSelections !== 'number' || !rule.sharedLimitGroupId) continue;
    if ((groupedCounts.get(rule.sharedLimitGroupId) ?? 0) > rule.maxSelections) {
      throw new Error(`O grupo compartilhado ${rule.sharedLimitGroupId} excedeu o limite permitido.`);
    }
  }

  const checkedMinGroups = new Set<string>();
  for (const rule of rules) {
    const minSelections = typeof rule.minSelections === 'number' ? rule.minSelections : null;
    if (!minSelections) continue;
    const categoryCount = counts.get(rule.category) ?? 0;
    if (!rule.sharedLimitGroupId) {
      if (categoryCount < minSelections) {
        throw new Error(`A categoria ${rule.category} requer pelo menos ${minSelections} item(s).`);
      }
    } else if (!checkedMinGroups.has(rule.sharedLimitGroupId)) {
      checkedMinGroups.add(rule.sharedLimitGroupId);
      if ((groupedCounts.get(rule.sharedLimitGroupId) ?? 0) < minSelections) {
        throw new Error(`O grupo compartilhado ${rule.sharedLimitGroupId} requer pelo menos ${minSelections} item(s).`);
      }
    }
  }
};

export const buildReturnUrl = (
  draftId: string,
  rawUrl?: string,
  allowedOrigin?: string,
) => {
  const normalizedUrl = rawUrl?.trim();
  if (!normalizedUrl) throw new Error('URL de retorno inválida.');

  const url = new URL(normalizedUrl);
  if (allowedOrigin) {
    const normalizedOrigin = allowedOrigin.trim().replace(/\/$/, '');
    if (normalizedOrigin && url.origin !== normalizedOrigin) {
      throw new Error('URL de retorno fora da origem permitida.');
    }
  }

  url.searchParams.set('draftId', draftId);
  if (!url.hash) url.hash = '#/enviado';
  return url.toString();
};

export const mapPaymentMethods = (types: string[] | undefined): Array<'pix' | 'card'> => {
  const methods = new Set<'pix' | 'card'>();
  for (const type of types ?? []) {
    if (type === 'pix') methods.add('pix');
    if (type === 'card') methods.add('card');
  }
  if (methods.size === 0) methods.add('card');
  return Array.from(methods);
};

export const isWinningOrderDraft = (
  order: FinalizedOrderReference | null | undefined,
  draftId: string,
  providerPaymentId?: string | null,
) => {
  if (!order) return false;
  if (order.sourceDraftId === draftId) return true;
  if (providerPaymentId && order.paymentSummary?.providerPaymentId === providerPaymentId) return true;
  return false;
};

export const canReplaceExistingOrderWithPaidDraft = (
  order: FinalizedOrderReference | null | undefined,
) => {
  if (!order) return false;
  return (order.paymentSummary?.paidTotalCents ?? 0) === 0;
};

export const isDuplicatePaidDraft = (
  order: FinalizedOrderReference | null | undefined,
  draftId: string,
  providerPaymentId: string | null,
) => {
  if (!order) return false;
  if (order.sourceDraftId === draftId) return false;
  if (providerPaymentId && order.paymentSummary?.providerPaymentId === providerPaymentId) return false;
  return true;
};

export {
  calculateOrderPaymentSummaryFromLines,
  normalizePriceCents,
  normalizeSelectionEntries,
  resolveOrderLines,
};
