export type PaymentStatus =
  | 'not_required'
  | 'awaiting_payment'
  | 'paid'
  | 'refund_pending'
  | 'refunded'
  | 'failed';

export type PaymentProvider = 'stripe';
export type PaymentMethod = 'pix' | 'card' | null;

export interface Item {
  id: string;
  nome: string;
  categoria: string;
  priceCents?: number | null;
}

export interface CategorySelectionRule {
  category: string;
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
}

export interface OrderPaymentSummary {
  freeTotalCents: number;
  paidTotalCents: number;
  currency: 'BRL';
  paymentStatus: PaymentStatus;
  provider: PaymentProvider | null;
  paymentMethod: PaymentMethod;
  providerPaymentId: string | null;
  refundedAt: number | null;
}

export const normalizePriceCents = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
);

export const createBasePaymentSummary = (
  items: Item[],
  selectedItemIds: string[],
  paymentStatus: PaymentStatus,
): OrderPaymentSummary => {
  let freeTotalCents = 0;
  let paidTotalCents = 0;

  for (const item of items) {
    if (!selectedItemIds.includes(item.id)) continue;
    const priceCents = normalizePriceCents(item.priceCents);
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
    provider: paidTotalCents > 0 ? 'stripe' : null,
    paymentMethod: null,
    providerPaymentId: null,
    refundedAt: null,
  };
};

export const validateSelection = (
  items: Item[],
  selectedItemIds: string[],
  rules: CategorySelectionRule[],
) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!selectedItemIds.includes(item.id)) continue;
    counts.set(item.categoria, (counts.get(item.categoria) ?? 0) + 1);
  }

  const groupedCounts = new Map<string, number>();
  for (const rule of rules) {
    if (typeof rule.maxSelections !== 'number') continue;

    const categoryCount = counts.get(rule.category) ?? 0;
    if (!rule.sharedLimitGroupId && categoryCount > rule.maxSelections) {
      throw new Error(`A categoria ${rule.category} excedeu o limite permitido.`);
    }

    if (rule.sharedLimitGroupId) {
      groupedCounts.set(
        rule.sharedLimitGroupId,
        (groupedCounts.get(rule.sharedLimitGroupId) ?? 0) + categoryCount,
      );
    }
  }

  for (const rule of rules) {
    if (typeof rule.maxSelections !== 'number' || !rule.sharedLimitGroupId) continue;
    if ((groupedCounts.get(rule.sharedLimitGroupId) ?? 0) > rule.maxSelections) {
      throw new Error(`O grupo compartilhado ${rule.sharedLimitGroupId} excedeu o limite permitido.`);
    }
  }
};

export const buildReturnUrl = (
  draftId: string,
  shareToken: string,
  preferredUrl?: string,
  fallbackBase?: string,
) => {
  const fallbackUrl = fallbackBase ? `${fallbackBase.replace(/\/$/, '')}/s/${shareToken}#/enviado` : '';
  const rawUrl = preferredUrl?.trim() || fallbackUrl;
  if (!rawUrl) throw new Error('PUBLIC_MENU_BASE_URL não configurado.');

  const url = new URL(rawUrl);
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
