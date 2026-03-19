import type {
  CatalogCategory,
  CatalogItem,
  DailyMenu,
  MenuEditorState,
  Order,
  OrderLine,
  OrderPaymentSummary,
  PaymentMethodType,
  PaymentProvider,
  PublicOrderPaymentStatus,
  PublishedMenuCategory,
  PublishedMenuItem,
  SelectionEntry,
  SelectionPolicy,
} from '../domain/menu';
import { DEFAULT_CATEGORY_NAMES } from '../domain/menu';

export type {
  CatalogCategory,
  CatalogItem,
  DailyMenu,
  MenuEditorState,
  OrderLine,
  OrderPaymentSummary,
  PaymentMethodType,
  PaymentProvider,
  PublicOrderPaymentStatus,
  SelectionEntry as SelectedPublicItem,
  SelectionPolicy,
};

export type Categoria = string;

export interface Item {
  id: string;
  nome: string;
  categoria: Categoria;
  priceCents?: number | null;
  quantity?: number | null;
}

export interface CategorySelectionRule {
  category: Categoria;
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
  allowRepeatedItems?: boolean | null;
}

export interface FinalizedPublicOrder {
  orderId: string;
  customerName: string;
  lines: OrderLine[];
  paymentSummary: OrderPaymentSummary;
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
  selectedItems: SelectionEntry[];
  paymentSummary: OrderPaymentSummary;
  checkoutSession?: PublicOrderCheckoutSession | null;
  createdAt: number;
  updatedAt: number;
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
  selectedItems?: SelectionEntry[];
  paymentSummary: OrderPaymentSummary;
  lines?: OrderLine[];
  submittedItems?: Item[];
  submittedAt: number;
}

export type PersistedOrder = Order;

export interface PublicMenuVersion {
  id: string;
  dateKey: string;
  shareToken?: string;
  token?: string;
  createdAt: number;
  itemIds?: string[];
  categories: Array<PublishedMenuCategory | string>;
  items: Array<PublishedMenuItem | Item>;
  categorySelectionRules?: CategorySelectionRule[];
}

export const DEFAULT_CATEGORIES: Categoria[] = [...DEFAULT_CATEGORY_NAMES];

export const categoryRuleFromCategory = (category: CatalogCategory): CategorySelectionRule => ({
  category: category.name,
  maxSelections: category.selectionPolicy.maxSelections ?? null,
  sharedLimitGroupId: category.selectionPolicy.sharedLimitGroupId ?? null,
  allowRepeatedItems: category.selectionPolicy.allowRepeatedItems ? true : undefined,
});

export const categoryRulesFromCategories = (categories: CatalogCategory[]): CategorySelectionRule[] => (
  categories
    .map(categoryRuleFromCategory)
    .filter((rule) => rule.maxSelections || rule.sharedLimitGroupId || rule.allowRepeatedItems)
);

export const itemViewFromCatalog = (
  item: Pick<CatalogItem, 'id' | 'name' | 'priceCents'>,
  categoryName: string,
  quantity?: number | null,
): Item => ({
  id: item.id,
  nome: item.name,
  categoria: categoryName,
  priceCents: item.priceCents,
  ...(typeof quantity === 'number' ? { quantity } : {}),
});
