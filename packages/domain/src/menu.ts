export type CategoryId = string;
export type ItemId = string;
export type MenuVersionId = string;
export type OrderId = string;
export type DateKey = string;

export type PublicOrderPaymentStatus =
  | 'not_required'
  | 'awaiting_payment'
  | 'paid'
  | 'refund_pending'
  | 'refunded'
  | 'failed';

export type PaymentProvider = 'mercado_pago' | 'stripe';
export type PaymentMethodType = 'pix' | 'card';

export interface SelectionPolicy {
  minSelections?: number | null;
  maxSelections?: number | null;
  sharedLimitGroupId?: string | null;
  allowRepeatedItems: boolean;
}

export interface CatalogCategory {
  id: CategoryId;
  name: string;
  sortOrder: number;
  selectionPolicy: SelectionPolicy;
}

export interface CatalogItem {
  id: ItemId;
  categoryId: CategoryId;
  name: string;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
}

export interface DailyMenu {
  dateKey: DateKey;
  status: 'draft' | 'published' | 'closed';
  shareToken: string | null;
  activeVersionId: MenuVersionId | null;
  itemIds: ItemId[];
  updatedAt: number;
}

export interface PublishedMenuCategory {
  id: CategoryId;
  name: string;
  sortOrder: number;
  selectionPolicy: SelectionPolicy;
}

export interface PublishedMenuItem {
  id: ItemId;
  categoryId: CategoryId;
  name: string;
  priceCents: number;
  sortOrder: number;
}

export interface PublishedMenuVersion {
  id: MenuVersionId;
  dateKey: DateKey;
  shareToken: string;
  createdAt: number;
  categories: PublishedMenuCategory[];
  items: PublishedMenuItem[];
}

export interface SelectionEntry {
  itemId: ItemId;
  quantity: number;
}

export interface OrderLine {
  itemId: ItemId;
  quantity: number;
  unitPriceCents: number;
  name: string;
  categoryId: CategoryId;
  categoryName: string;
}

export interface OrderPaymentSummary {
  freeTotalCents: number;
  paidTotalCents: number;
  currency: 'BRL';
  paymentStatus: PublicOrderPaymentStatus;
  provider: PaymentProvider | null;
  paymentMethod: PaymentMethodType | null;
  providerPaymentId: string | null;
  refundedAt: number | null;
}

export interface Order {
  id: OrderId;
  dateKey: DateKey;
  shareToken: string;
  menuVersionId: MenuVersionId;
  customerName: string;
  lines: OrderLine[];
  paymentSummary: OrderPaymentSummary;
  submittedAt: number;
  sourceDraftId?: string | null;
  observation?: string;
}

export interface MenuEditorState {
  catalog: {
    categories: CatalogCategory[];
    items: CatalogItem[];
  };
  dailyMenu: DailyMenu;
}

export interface SelectionViolation {
  type: 'category' | 'group' | 'min';
  category: string;
  maxSelections?: number;
  minSelections?: number;
  selectedCount: number;
  categories: string[];
  groupId?: string;
  message: string;
}

export const DEFAULT_CATEGORY_NAMES = ['Saladas', 'Acompanhamentos', 'Carnes', 'Churrasco'];

export const normalizePriceCents = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
);

export const createEmptyPaymentSummary = (
  paymentStatus: PublicOrderPaymentStatus = 'not_required',
  provider: PaymentProvider | null = null,
  paymentMethod: PaymentMethodType | null = null,
): OrderPaymentSummary => ({
  freeTotalCents: 0,
  paidTotalCents: 0,
  currency: 'BRL',
  paymentStatus,
  provider,
  paymentMethod,
  providerPaymentId: null,
  refundedAt: null,
});

export const normalizeSelectionEntries = (
  selectedItems?: SelectionEntry[] | null,
  fallbackSelectedItemIds?: string[] | null,
): SelectionEntry[] => {
  const counts = new Map<string, number>();

  for (const item of selectedItems ?? []) {
    if (typeof item?.itemId !== 'string' || !Number.isFinite(item.quantity) || item.quantity <= 0) continue;
    counts.set(item.itemId, (counts.get(item.itemId) ?? 0) + Math.trunc(item.quantity));
  }

  if (counts.size === 0) {
    for (const itemId of fallbackSelectedItemIds ?? []) {
      if (typeof itemId !== 'string' || !itemId.trim()) continue;
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
};

export const expandSelectionEntriesToIds = (selection: SelectionEntry[]) => (
  selection.flatMap(({ itemId, quantity }) => Array.from({ length: quantity }, () => itemId))
);

export const hasRepeatedSelectionEntries = (selection: SelectionEntry[]) => (
  selection.some(item => item.quantity > 1)
);

const buildCategoryCounts = (
  items: Array<{ id: string; categoryId: string }>,
  selection: SelectionEntry[],
) => {
  const counts = new Map<string, number>();
  const quantities = new Map(selection.map(item => [item.itemId, item.quantity]));

  for (const item of items) {
    const quantity = quantities.get(item.id) ?? 0;
    if (quantity <= 0) continue;
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + quantity);
  }

  return counts;
};

export const validateSelection = (
  categories: Array<{ id: string; name: string; selectionPolicy: SelectionPolicy }>,
  items: Array<{ id: string; categoryId: string }>,
  selection: SelectionEntry[],
): SelectionViolation[] => {
  const counts = buildCategoryCounts(items, selection);
  const violations: SelectionViolation[] = [];
  const groupCounts = new Map<string, number>();
  const groupCategories = new Map<string, string[]>();

  for (const category of categories) {
    const categoryCount = counts.get(category.id) ?? 0;
    const groupId = category.selectionPolicy.sharedLimitGroupId ?? undefined;
    if (groupId) {
      groupCounts.set(groupId, (groupCounts.get(groupId) ?? 0) + categoryCount);
      groupCategories.set(groupId, [...(groupCategories.get(groupId) ?? []), category.name]);
    }
  }

  for (const category of categories) {
    const maxSelections = category.selectionPolicy.maxSelections ?? null;
    if (!maxSelections) continue;

    const categoryCount = counts.get(category.id) ?? 0;
    const groupId = category.selectionPolicy.sharedLimitGroupId ?? undefined;

    if (!groupId && categoryCount > maxSelections) {
      violations.push({
        type: 'category',
        category: category.name,
        maxSelections,
        selectedCount: categoryCount,
        categories: [category.name],
        message: `A categoria ${category.name} excedeu o limite permitido.`,
      });
    }
  }

  for (const category of categories) {
    const maxSelections = category.selectionPolicy.maxSelections ?? null;
    const groupId = category.selectionPolicy.sharedLimitGroupId ?? undefined;
    if (!maxSelections || !groupId) continue;

    const selectedCount = groupCounts.get(groupId) ?? 0;
    if (selectedCount > maxSelections) {
      const categoriesInGroup = (groupCategories.get(groupId) ?? []).sort((left, right) => (
        left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
      ));
      violations.push({
        type: 'group',
        category: category.name,
        maxSelections,
        selectedCount,
        categories: categoriesInGroup,
        groupId,
        message: `Escolha ate ${maxSelections} somando com ${categoriesInGroup.filter(name => name !== category.name).join(', ')}.`,
      });
      break;
    }
  }

  const checkedMinGroups = new Set<string>();
  for (const category of categories) {
    const minSelections = category.selectionPolicy.minSelections ?? null;
    if (!minSelections) continue;

    const categoryCount = counts.get(category.id) ?? 0;
    const groupId = category.selectionPolicy.sharedLimitGroupId ?? undefined;

    if (!groupId) {
      if (categoryCount < minSelections) {
        violations.push({
          type: 'min',
          category: category.name,
          minSelections,
          selectedCount: categoryCount,
          categories: [category.name],
          message: `A categoria ${category.name} requer pelo menos ${minSelections} item(s).`,
        });
      }
    } else if (!checkedMinGroups.has(groupId)) {
      checkedMinGroups.add(groupId);
      const selectedCount = groupCounts.get(groupId) ?? 0;
      if (selectedCount < minSelections) {
        const categoriesInGroup = (groupCategories.get(groupId) ?? []).sort((left, right) => (
          left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })
        ));
        violations.push({
          type: 'min',
          category: category.name,
          minSelections,
          selectedCount,
          categories: categoriesInGroup,
          groupId,
          message: `Escolha pelo menos ${minSelections} somando com ${categoriesInGroup.filter(name => name !== category.name).join(', ')}.`,
        });
      }
    }
  }

  return violations;
};

export const buildPublishedMenuVersion = ({
  versionId,
  dateKey,
  shareToken,
  categories,
  items,
  selectedItemIds,
  createdAt,
}: {
  versionId: string;
  dateKey: string;
  shareToken: string;
  categories: CatalogCategory[];
  items: CatalogItem[];
  selectedItemIds: string[];
  createdAt: number;
}): PublishedMenuVersion => {
  const selectedItems = items
    .filter(item => item.isActive && selectedItemIds.includes(item.id))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }));
  const categoryIds = Array.from(new Set(selectedItems.map(item => item.categoryId)));
  const selectedCategories = categories
    .filter(category => categoryIds.includes(category.id))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }));

  return {
    id: versionId,
    dateKey,
    shareToken,
    createdAt,
    categories: selectedCategories.map(category => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      selectionPolicy: { ...category.selectionPolicy },
    })),
    items: selectedItems.map(item => ({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      priceCents: normalizePriceCents(item.priceCents),
      sortOrder: item.sortOrder,
    })),
  };
};

export const resolveOrderLines = (
  version: PublishedMenuVersion,
  selection: SelectionEntry[],
): OrderLine[] => {
  const categoryById = new Map(version.categories.map(category => [category.id, category]));
  const itemById = new Map(version.items.map(item => [item.id, item]));

  return selection.flatMap(({ itemId, quantity }) => {
    const item = itemById.get(itemId);
    if (!item || quantity <= 0) return [];
    const category = categoryById.get(item.categoryId);

    return [{
      itemId,
      quantity,
      unitPriceCents: normalizePriceCents(item.priceCents),
      name: item.name,
      categoryId: item.categoryId,
      categoryName: category?.name ?? 'Sem categoria',
    }];
  });
};

export const calculateOrderPaymentSummaryFromLines = (
  lines: OrderLine[],
  paymentStatus: PublicOrderPaymentStatus = 'not_required',
  provider: PaymentProvider | null = null,
  paymentMethod: PaymentMethodType | null = null,
): OrderPaymentSummary => {
  const summary = createEmptyPaymentSummary(paymentStatus, provider, paymentMethod);

  for (const line of lines) {
    const total = normalizePriceCents(line.unitPriceCents) * Math.max(0, Math.trunc(line.quantity));
    if (line.unitPriceCents > 0) {
      summary.paidTotalCents += total;
    } else {
      summary.freeTotalCents += total;
    }
  }

  if (summary.paidTotalCents > 0 && !summary.provider) {
    summary.provider = 'stripe';
  }

  return summary;
};

export const buildOrder = ({
  id,
  dateKey,
  shareToken,
  menuVersionId,
  customerName,
  lines,
  paymentSummary,
  submittedAt,
  sourceDraftId = null,
  observation,
}: {
  id: OrderId;
  dateKey: DateKey;
  shareToken: string;
  menuVersionId: MenuVersionId;
  customerName: string;
  lines: OrderLine[];
  paymentSummary: OrderPaymentSummary;
  submittedAt: number;
  sourceDraftId?: string | null;
  observation?: string;
}): Order => ({
  id,
  dateKey,
  shareToken,
  menuVersionId,
  customerName: customerName.trim(),
  lines,
  paymentSummary,
  submittedAt,
  sourceDraftId,
  ...(observation?.trim() ? { observation: observation.trim() } : {}),
});

export const createCategoryId = (name: string) => (
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);

export const createVersionId = (dateKey: string) => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `${dateKey}__${crypto.randomUUID()}`
    : `${dateKey}__${Math.random().toString(36).slice(2, 12)}`
);

export const parseDateKeyFromVersionId = (versionId: string) => (
  versionId.includes('__') ? versionId.split('__')[0] ?? '' : ''
);
