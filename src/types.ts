export type Categoria = string;
export type PublicOrderPaymentStatus =
  | 'not_required'
  | 'awaiting_payment'
  | 'paid'
  | 'refund_pending'
  | 'refunded'
  | 'failed';
export type PaymentProvider = 'mercado_pago' | 'stripe';
export type PaymentMethodType = 'pix' | 'card';

export interface Item {
  id: string;
  nome: string;
  categoria: Categoria;
  priceCents?: number | null;
}

export interface CategorySelectionRule {
  category: Categoria;
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
}

export interface OrderPaymentSummary {
  freeTotalCents: number;
  paidTotalCents: number;
  currency: 'BRL';
  paymentStatus: PublicOrderPaymentStatus;
  provider?: PaymentProvider | null;
  paymentMethod?: PaymentMethodType | null;
  providerPaymentId?: string | null;
  refundedAt?: number | null;
}

export interface PublicOrderCheckoutSession {
  draftId: string;
  checkoutUrl?: string | null;
  clientSecret?: string | null;
  sessionId?: string | null;
  expiresAt?: number | null;
  provider: PaymentProvider;
  availableMethods: PaymentMethodType[];
}

export interface PublicOrderDraft {
  id: string;
  dateKey: string;
  shareToken: string;
  orderId: string;
  customerName: string;
  menuVersionId: string;
  selectedItemIds: string[];
  paymentSummary: OrderPaymentSummary;
  checkoutSession?: PublicOrderCheckoutSession | null;
  createdAt: number;
  updatedAt: number;
}

export interface FinalizedPublicOrder {
  orderId: string;
  customerName: string;
  selectedItemIds: string[];
  paymentSummary: OrderPaymentSummary;
}

export interface EditorLock {
  sessionId: string;
  userEmail: string;
  deviceLabel: string;
  status: 'active';
  acquiredAt: number;
  lastHeartbeatAt: number;
  expiresAt: number;
}

export interface PublicMenu {
  token: string;
  dateKey: string;
  expiresAt: number;
  acceptingOrders: boolean;
  currentVersionId: string;
  categories: Categoria[];
  items: Item[];
  categorySelectionRules: CategorySelectionRule[];
}

export interface OrderEntry {
  id: string;
  dateKey: string;
  shareToken: string;
  orderId: string;
  customerName: string;
  menuVersionId?: string;
  selectedItemIds: string[];
  paymentSummary: OrderPaymentSummary;
  selectedPaidItemIds?: string[];
  submittedItems?: Item[];
  submittedAt: number;
}

export interface PublicMenuVersion {
  id: string;
  token: string;
  dateKey: string;
  categories: Categoria[];
  itemIds: string[];
  items: Item[];
  categorySelectionRules: CategorySelectionRule[];
  createdAt: number;
}

// Used as fallback when Firestore has no saved categories list
export const DEFAULT_CATEGORIES: Categoria[] = ['Saladas', 'Acompanhamentos', 'Carnes', 'Churrasco'];
