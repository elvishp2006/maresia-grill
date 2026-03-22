import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  buildPublishedMenuVersion,
  createCategoryId,
  createVersionId,
  DEFAULT_CATEGORY_NAMES,
  expandSelectionEntriesToIds,
  normalizePriceCents,
  parseDateKeyFromVersionId,
} from '@maresia-grill/domain/menu';
import { db } from './firebase';
import type {
  CategorySelectionRule,
  EditorLock,
  FinalizedPublicOrder,
  Item,
  OrderEntry,
  OrderPaymentSummary,
  PublicMenu,
  PublicMenuVersion,
  PublicOrderCheckoutSession,
  SelectedPublicItem,
} from '../types';
import { categoryRulesFromCategories, itemViewFromCatalog } from '../types';
import type { CategoryEntry } from '../types';

export const LOCK_TIMEOUT_MS = 60_000;

export const getDateKey = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const getDb = () => {
  if (!db) {
    throw new Error('Firestore indisponivel. Verifique a configuracao do Firebase.');
  }
  return db;
};

const catalogRootRef = () => doc(getDb(), 'catalog', 'root');
const categoriesCollectionRef = () => collection(catalogRootRef(), 'categories');
const itemsCollectionRef = () => collection(catalogRootRef(), 'items');
const dailyMenuRef = (dateKey: string) => doc(getDb(), 'dailyMenus', dateKey);
const dailyMenuVersionRef = (dateKey: string, versionId: string) => doc(getDb(), 'dailyMenus', dateKey, 'versions', versionId);
const dailyMenuOrdersRef = (dateKey: string) => collection(dailyMenuRef(dateKey), 'orders');
const dailyMenuTokenRef = (shareToken: string) => doc(getDb(), 'dailyMenuTokens', shareToken);
const editorLockRef = () => doc(getDb(), 'config', 'editorLock');

export interface SelectionHistoryEntry {
  dateKey: string;
  ids: string[];
}

export interface AcquireEditorLockInput {
  sessionId: string;
  userEmail: string;
  deviceLabel: string;
}

export interface AcquireEditorLockOptions {
  force?: boolean;
}

export interface CreateDailyShareLinkInput {
  dateKey: string;
  categories: CategoryEntry[];
  complements: Item[];
  daySelection: string[];
  categorySelectionRules: CategorySelectionRule[];
}

export interface ShareLinkResult {
  token: string;
  url: string;
}

export interface SubmitPublicOrderInput {
  orderId: string;
  dateKey: string;
  shareToken: string;
  customerName: string;
  selectedItems: SelectedPublicItem[];
  observation?: string;
}

export interface SubmitPublicOrderResult {
  orderId: string;
  customerName: string;
  lines: FinalizedPublicOrder['lines'];
  paymentSummary: OrderPaymentSummary;
}

export interface PreparePublicOrderCheckoutInput {
  orderId: string;
  dateKey: string;
  shareToken: string;
  customerName: string;
  selectedItems: SelectedPublicItem[];
  observation?: string;
  successUrl?: string;
  pendingUrl?: string;
  failureUrl?: string;
}

export interface PreparePublicOrderCheckoutResult {
  kind: 'free_order_confirmed' | 'payment_required';
  order?: FinalizedPublicOrder;
  checkoutSession?: PublicOrderCheckoutSession | null;
  checkoutUrl?: string;
  draftId?: string;
}

export interface FetchPublicOrderStatusInput {
  shareToken: string;
  draftId: string;
}

export interface FetchPublicOrderStatusResult {
  draftId: string;
  paymentStatus: OrderPaymentSummary['paymentStatus'];
  order?: FinalizedPublicOrder;
}

export interface DeletePublicOrderInput {
  orderId: string;
  dateKey: string;
  shareToken: string;
}

export interface CancelPublicOrderResult {
  refunded: boolean;
  paymentSummary: OrderPaymentSummary | null;
}

export interface SetOrderIntakeStatusInput extends CreateDailyShareLinkInput {
  acceptingOrders: boolean;
}

type CatalogCategoryRecord = {
  id: string;
  name: string;
  sortOrder: number;
  selectionPolicy?: {
    minSelections?: number | null;
    maxSelections?: number | null;
    sharedLimitGroupId?: string | null;
    allowRepeatedItems?: boolean;
  };
  excludeFromShare?: boolean;
};

type CatalogItemRecord = {
  id: string;
  categoryId: string;
  name: string;
  priceCents?: number | null;
  isActive?: boolean;
  alwaysActive?: boolean;
  sortOrder: number;
};

type DailyMenuRecord = {
  dateKey: string;
  status: 'draft' | 'published' | 'closed';
  shareToken?: string | null;
  activeVersionId?: string | null;
  itemIds?: string[];
  updatedAt?: number | Date | { toMillis: () => number };
};

type DailyMenuTokenRecord = {
  shareToken: string;
  dateKey: string;
  activeVersionId: string;
  createdAt?: number | Date | { toMillis: () => number };
  updatedAt?: number | Date | { toMillis: () => number };
};

const normalizeTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return null;
};

const buildExpiryDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 24, 0, 0, 0).getTime();
};

const buildPublicUrl = (token: string) => {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/s/${token}`;
};

const normalizeSortOrder = (value: unknown, fallback = 0) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.trunc(value);
};

const normalizeCategoryRecord = (id: string, value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as CatalogCategoryRecord;
  if (typeof candidate.name !== 'string') return null;
  return {
    id,
    name: candidate.name,
    sortOrder: normalizeSortOrder(candidate.sortOrder),
    selectionPolicy: {
      minSelections: typeof candidate.selectionPolicy?.minSelections === 'number'
        ? Math.trunc(candidate.selectionPolicy.minSelections)
        : null,
      maxSelections: typeof candidate.selectionPolicy?.maxSelections === 'number'
        ? Math.trunc(candidate.selectionPolicy.maxSelections)
        : null,
      sharedLimitGroupId: typeof candidate.selectionPolicy?.sharedLimitGroupId === 'string'
        ? candidate.selectionPolicy.sharedLimitGroupId
        : null,
      allowRepeatedItems: candidate.selectionPolicy?.allowRepeatedItems === true,
    },
    ...(candidate.excludeFromShare === true ? { excludeFromShare: true } : {}),
  };
};

const normalizeItemRecord = (id: string, value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as CatalogItemRecord;
  if (typeof candidate.name !== 'string' || typeof candidate.categoryId !== 'string') return null;
  return {
    id,
    categoryId: candidate.categoryId,
    name: candidate.name,
    priceCents: normalizePriceCents(candidate.priceCents),
    isActive: candidate.isActive !== false,
    alwaysActive: candidate.alwaysActive === true,
    sortOrder: normalizeSortOrder(candidate.sortOrder),
  };
};

const normalizeDailyMenuRecord = (dateKey: string, value: unknown) => {
  if (!value || typeof value !== 'object') {
    return {
      dateKey,
      status: 'draft' as const,
      shareToken: null,
      activeVersionId: null,
      itemIds: [],
      updatedAt: Date.now(),
    };
  }

  const candidate = value as DailyMenuRecord;
  return {
    dateKey,
    status: candidate.status === 'published' || candidate.status === 'closed' ? candidate.status : 'draft',
    shareToken: typeof candidate.shareToken === 'string' ? candidate.shareToken : null,
    activeVersionId: typeof candidate.activeVersionId === 'string' ? candidate.activeVersionId : null,
    itemIds: Array.isArray(candidate.itemIds) ? candidate.itemIds.filter((item): item is string => typeof item === 'string') : [],
    updatedAt: normalizeTimestamp(candidate.updatedAt) ?? Date.now(),
  };
};

const normalizeDailyMenuTokenRecord = (shareToken: string, value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as DailyMenuTokenRecord;
  if (
    typeof candidate.shareToken !== 'string'
    || typeof candidate.dateKey !== 'string'
    || typeof candidate.activeVersionId !== 'string'
  ) return null;

  return {
    shareToken,
    dateKey: candidate.dateKey,
    activeVersionId: candidate.activeVersionId,
    createdAt: normalizeTimestamp(candidate.createdAt) ?? Date.now(),
    updatedAt: normalizeTimestamp(candidate.updatedAt) ?? Date.now(),
  };
};

const sortCategories = <T extends { name: string; sortOrder: number }>(categories: T[]) => (
  [...categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }))
);

const sortItems = <T extends { name: string; sortOrder: number }>(items: T[]) => (
  [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' }))
);

const loadCatalogSnapshot = async () => {
  const [categorySnap, itemSnap] = await Promise.all([
    getDocs(query(categoriesCollectionRef(), orderBy('sortOrder', 'asc'))),
    getDocs(query(itemsCollectionRef(), orderBy('sortOrder', 'asc'))),
  ]);

  const categories = sortCategories(categorySnap.docs
    .map(docSnap => normalizeCategoryRecord(docSnap.id, docSnap.data()))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null));
  const items = sortItems(itemSnap.docs
    .map(docSnap => normalizeItemRecord(docSnap.id, docSnap.data()))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  return { categories, items };
};

const loadPersistedPublishedSnapshot = async (dateKey: string) => {
  const [dailyMenu, catalog] = await Promise.all([
    loadDailyMenuRecord(dateKey),
    loadCatalogSnapshot(),
  ]);

  return {
    dailyMenu,
    categories: catalog.categories,
    items: catalog.items,
    categorySelectionRules: categoryRulesFromCategories(catalog.categories),
  };
};

const reserveDailyMenuToken = async (dateKey: string, existingToken?: string | null) => {
  if (existingToken) {
    const existingTokenSnap = await getDoc(dailyMenuTokenRef(existingToken));
    if (!existingTokenSnap.exists()) return existingToken;
    const normalized = normalizeDailyMenuTokenRecord(existingToken, existingTokenSnap.data());
    if (!normalized || normalized.dateKey === dateKey) return existingToken;
    throw new Error('Conflito de token público do cardápio.');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nextToken = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${dateKey}-${Math.random().toString(36).slice(2, 12)}`;
    const tokenSnap = await getDoc(dailyMenuTokenRef(nextToken));
    if (!tokenSnap.exists()) return nextToken;
  }

  throw new Error('Não foi possível reservar um token público único.');
};

const loadDailyMenuRecord = async (dateKey: string) => {
  const snap = await getDoc(dailyMenuRef(dateKey));
  return snap.exists() ? normalizeDailyMenuRecord(dateKey, snap.data()) : normalizeDailyMenuRecord(dateKey, null);
};

const ensureDefaultCategories = async () => {
  const snap = await getDocs(categoriesCollectionRef());
  if (!snap.empty) return;

  const batch = writeBatch(getDb());
  DEFAULT_CATEGORY_NAMES.forEach((name, index) => {
    // Use deterministic slug-based IDs for system defaults so concurrent
    // or repeated seed calls are idempotent (last write wins, same doc).
    const id = createCategoryId(name);
    batch.set(doc(categoriesCollectionRef(), id), {
      name,
      sortOrder: index,
      selectionPolicy: {
        minSelections: null,
        maxSelections: null,
        sharedLimitGroupId: null,
        allowRepeatedItems: false,
      },
    });
  });
  await batch.commit();
};

const saveCategoriesInternal = async (entries: CategoryEntry[]): Promise<void> => {
  const existing = await getDocs(categoriesCollectionRef());
  const existingEntries = existing.docs
    .map(docSnap => normalizeCategoryRecord(docSnap.id, docSnap.data()))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const existingById = new Map(existingEntries.map(entry => [entry.id, entry]));
  const batch = writeBatch(getDb());
  const nextIds = new Set<string>();

  entries.forEach((entry, index) => {
    const normalizedName = entry.name.trim();
    if (!normalizedName) return;
    const id = entry.id;
    const existingEntry = existingById.get(id);
    nextIds.add(id);
    batch.set(doc(categoriesCollectionRef(), id), {
      name: normalizedName,
      sortOrder: index,
      selectionPolicy: existingEntry?.selectionPolicy ?? {
        minSelections: null,
        maxSelections: null,
        sharedLimitGroupId: null,
        allowRepeatedItems: false,
      },
      ...(existingEntry?.excludeFromShare ? { excludeFromShare: true } : {}),
    });
  });

  existing.docs.forEach((docSnap) => {
    if (!nextIds.has(docSnap.id)) batch.delete(docSnap.ref);
  });

  await batch.commit();
};

const saveComplementsInternal = async (items: Item[]): Promise<void> => {
  const existing = await getDocs(itemsCollectionRef());
  const existingAlwaysActive = new Map(
    existing.docs.map(d => [d.id, (d.data() as CatalogItemRecord).alwaysActive === true]),
  );
  const batch = writeBatch(getDb());
  const nextIds = new Set<string>();

  items.forEach((item, index) => {
    const categoryId = item.categoria; // UUID stored directly
    nextIds.add(item.id);
    batch.set(doc(itemsCollectionRef(), item.id), {
      categoryId,
      name: item.nome.trim(),
      priceCents: normalizePriceCents(item.priceCents),
      isActive: true,
      alwaysActive: existingAlwaysActive.get(item.id) ?? false,
      sortOrder: index,
    });
  });

  existing.docs.forEach((docSnap) => {
    if (!nextIds.has(docSnap.id)) batch.delete(docSnap.ref);
  });

  await batch.commit();
};

const saveDailyMenuSelection = async (dateKey: string, ids: string[]) => {
  const current = await loadDailyMenuRecord(dateKey);
  await setDoc(dailyMenuRef(dateKey), {
    dateKey,
    status: current.status,
    shareToken: current.shareToken,
    activeVersionId: current.activeVersionId,
    itemIds: ids,
    updatedAt: Date.now(),
  });
};

const normalizePublishedMenuVersion = (id: string, value: unknown): PublicMenuVersion | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.categories) || !Array.isArray(candidate.items)) return null;
  return {
    id,
    dateKey: typeof candidate.dateKey === 'string' ? candidate.dateKey : '',
    shareToken: typeof candidate.shareToken === 'string' ? candidate.shareToken : '',
    createdAt: normalizeTimestamp(candidate.createdAt) ?? Date.now(),
    categories: candidate.categories as PublicMenuVersion['categories'],
    items: candidate.items as PublicMenuVersion['items'],
  };
};

const buildPublicMenuFromVersion = (
  token: string,
  dateKey: string,
  acceptingOrders: boolean,
  version: PublicMenuVersion,
): PublicMenu => {
  const versionCategories = version.categories as Array<{
    id: string;
    name: string;
    sortOrder: number;
    selectionPolicy: {
      minSelections?: number | null;
      maxSelections?: number | null;
      sharedLimitGroupId?: string | null;
      allowRepeatedItems?: boolean;
    };
  }>;
  const versionItems = version.items as Array<{
    id: string;
    name: string;
    sortOrder: number;
    priceCents: number;
    categoryId: string;
  }>;
  const categoryById = new Map(versionCategories.map(category => [category.id, category]));
  return {
    token,
    dateKey,
    expiresAt: buildExpiryDate(dateKey),
    acceptingOrders,
    currentVersionId: version.id,
    categories: sortCategories(versionCategories).map(category => category.name),
    items: sortItems(versionItems).map(item => itemViewFromCatalog(item, categoryById.get(item.categoryId)?.name ?? 'Sem categoria')),
    categorySelectionRules: versionCategories.flatMap(category => {
      const hasRule = category.selectionPolicy.minSelections || category.selectionPolicy.maxSelections || category.selectionPolicy.sharedLimitGroupId || category.selectionPolicy.allowRepeatedItems;
      return hasRule
        ? [{
            category: category.name,
            minSelections: category.selectionPolicy.minSelections ?? null,
            maxSelections: category.selectionPolicy.maxSelections ?? null,
            sharedLimitGroupId: category.selectionPolicy.sharedLimitGroupId ?? null,
            allowRepeatedItems: category.selectionPolicy.allowRepeatedItems ? true : undefined,
          }]
        : [];
    }),
  };
};

const loadActivePublicMenuVersion = async (token: string): Promise<{ menu: ReturnType<typeof normalizeDailyMenuRecord>; version: PublicMenuVersion } | null> => {
  const tokenSnap = await getDoc(dailyMenuTokenRef(token));
  if (!tokenSnap.exists()) return null;
  const tokenRecord = normalizeDailyMenuTokenRecord(token, tokenSnap.data());
  if (!tokenRecord) return null;

  const menuSnap = await getDoc(dailyMenuRef(tokenRecord.dateKey));
  if (!menuSnap.exists()) return null;
  const menu = normalizeDailyMenuRecord(tokenRecord.dateKey, menuSnap.data());
  if (!menu.activeVersionId || menu.activeVersionId !== tokenRecord.activeVersionId) return null;

  const versionSnap = await getDoc(dailyMenuVersionRef(menu.dateKey, menu.activeVersionId));
  if (!versionSnap.exists()) return null;
  const version = normalizePublishedMenuVersion(versionSnap.id, versionSnap.data());
  if (!version) return null;
  return { menu, version };
};

const normalizeOrderEntry = (id: string, value: unknown): OrderEntry | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.dateKey !== 'string'
    || typeof candidate.shareToken !== 'string'
    || typeof candidate.menuVersionId !== 'string'
    || typeof candidate.customerName !== 'string'
  ) return null;

  const lines = Array.isArray(candidate.lines)
    ? candidate.lines.filter((line): line is {
      itemId: string;
      quantity: number;
      unitPriceCents: number;
      name: string;
      categoryId: string;
      categoryName: string;
    } => (
      Boolean(line)
      && typeof (line as Record<string, unknown>).itemId === 'string'
      && typeof (line as Record<string, unknown>).quantity === 'number'
      && typeof (line as Record<string, unknown>).name === 'string'
      && typeof (line as Record<string, unknown>).categoryName === 'string'
      && typeof (line as Record<string, unknown>).categoryId === 'string'
      && typeof (line as Record<string, unknown>).unitPriceCents === 'number'
    ))
    : [];

  const paymentSummary = candidate.paymentSummary as OrderPaymentSummary | undefined;
  return {
    id,
    dateKey: candidate.dateKey,
    shareToken: candidate.shareToken,
    orderId: id,
    customerName: candidate.customerName,
    menuVersionId: candidate.menuVersionId,
    selectedItems: lines.map(line => ({ itemId: line.itemId, quantity: line.quantity })),
    paymentSummary: paymentSummary ?? {
      freeTotalCents: 0,
      paidTotalCents: 0,
      currency: 'BRL',
      paymentStatus: 'not_required',
      provider: null,
      paymentMethod: null,
      providerPaymentId: null,
      refundedAt: null,
    },
    lines,
    submittedItems: lines.map(line => ({
      id: line.itemId,
      nome: line.name,
      categoria: line.categoryName,
      priceCents: line.unitPriceCents,
      quantity: line.quantity,
    })),
    submittedAt: normalizeTimestamp(candidate.submittedAt) ?? Date.now(),
    ...(typeof candidate.observation === 'string' && candidate.observation ? { observation: candidate.observation } : {}),
  };
};

export const isLockExpired = (lock: EditorLock | null, now = Date.now()) =>
  !lock || lock.expiresAt <= now;

export const isMenuExpired = (menu: PublicMenu | null, now = Date.now()) =>
  !menu || menu.expiresAt <= now;

export const loadCategories = async (): Promise<CategoryEntry[]> => {
  const { categories } = await loadCatalogSnapshot();
  return categories.map(category => ({ id: category.id, name: category.name }));
};

export const saveCategories = (entries: CategoryEntry[]): Promise<void> => {
  return saveCategoriesInternal(entries);
};

export const subscribeCategories = (
  onValue: (items: CategoryEntry[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(query(categoriesCollectionRef(), orderBy('sortOrder', 'asc')), (snap) => {
  const categories = sortCategories(snap.docs
    .map(docSnap => normalizeCategoryRecord(docSnap.id, docSnap.data()))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null));
  if (categories.length === 0) {
    ensureDefaultCategories().catch(error => onError?.(error instanceof Error ? error : new Error(String(error))));
  }
  onValue(categories.map(category => ({ id: category.id, name: category.name })));
}, error => onError?.(error));

export const loadComplements = async (): Promise<Item[]> => {
  const { items } = await loadCatalogSnapshot();
  return items.map(item => ({
    id: item.id,
    nome: item.name,
    categoria: item.categoryId,
    priceCents: item.priceCents,
  }));
};

export const saveComplements = (items: Item[]): Promise<void> => {
  return saveComplementsInternal(items);
};

export const loadCategorySelectionRules = async (): Promise<CategorySelectionRule[]> => {
  const { categories } = await loadCatalogSnapshot();
  return categoryRulesFromCategories(categories);
};

export class StorageActionError extends Error {
  code: string;

  constructor(message: string, code = 'unknown') {
    super(message);
    this.name = 'StorageActionError';
    this.code = code;
  }
}

const normalizeStorageError = (error: unknown, fallbackMessage: string) => {
  const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'unknown';
  if (error instanceof StorageActionError) return error;
  if (error instanceof Error) return new StorageActionError(error.message || fallbackMessage, code);
  return new StorageActionError(fallbackMessage, code);
};

export const saveCategorySelectionRules = async (
  rules: CategorySelectionRule[],
  categories?: CategoryEntry[],
): Promise<void> => {
  const existing = await getDocs(query(categoriesCollectionRef(), orderBy('sortOrder', 'asc')));
  const existingEntries = sortCategories(existing.docs
    .map(docSnap => normalizeCategoryRecord(docSnap.id, docSnap.data()))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  const resolvedEntries: CategoryEntry[] = categories
    ? categories.filter(c => c.name.trim().length > 0)
    : existingEntries.map(entry => ({ id: entry.id, name: entry.name }));

  if (resolvedEntries.length === 0) {
    throw new StorageActionError('Nenhuma categoria carregada para salvar os limites.', 'not-found');
  }

  const existingById = new Map(existingEntries.map(entry => [entry.id, entry]));
  const existingByName = new Map(existingEntries.map(entry => [entry.name, entry]));
  const rulesByName = new Map(rules.map(rule => [rule.category, rule]));
  const batch = writeBatch(getDb());

  resolvedEntries.forEach((categoryEntry, index) => {
    const categoryName = categoryEntry.name;
    const rule = rulesByName.get(categoryName);
    const categoryId = categoryEntry.id;
    // Fallback to name lookup for data migrated from slug-based IDs (pre-UUID).
    const existingCategory = existingById.get(categoryId) ?? existingByName.get(categoryName);
    batch.set(doc(categoriesCollectionRef(), categoryId), {
      name: categoryName,
      sortOrder: normalizeSortOrder(existingCategory?.sortOrder, index),
      selectionPolicy: {
        minSelections: rule?.minSelections ?? null,
        maxSelections: rule?.maxSelections ?? null,
        sharedLimitGroupId: rule?.sharedLimitGroupId ?? null,
        allowRepeatedItems: rule?.allowRepeatedItems === true,
      },
      ...(existingCategory?.excludeFromShare ? { excludeFromShare: true } : {}),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'unknown';
    console.error('saveCategorySelectionRules failed', {
      code,
      rules,
      resolvedEntries,
      error,
    });
    if (code === 'permission-denied') {
      const suffix = import.meta.env.DEV ? ` (Firestore: ${code})` : '';
      throw new StorageActionError(`Não foi possível salvar os limites da categoria. Recarregue a tela e tente novamente.${suffix}`, code);
    }
    if (code === 'failed-precondition') {
      const suffix = import.meta.env.DEV ? ` (Firestore: ${code})` : '';
      throw new StorageActionError(`Os limites da categoria ficaram desatualizados. Recarregue a tela e tente novamente.${suffix}`, code);
    }
    throw normalizeStorageError(error, 'Não foi possível salvar os limites da categoria.');
  }
};

export const subscribeCategorySelectionRules = (
  onValue: (rules: CategorySelectionRule[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(query(categoriesCollectionRef(), orderBy('sortOrder', 'asc')), (snap) => {
  const categories = sortCategories(snap.docs
    .map(docSnap => normalizeCategoryRecord(docSnap.id, docSnap.data()))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null));
  onValue(categoryRulesFromCategories(categories));
}, error => onError?.(error));

export const subscribeComplements = (
  onValue: (items: Item[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(query(itemsCollectionRef(), orderBy('sortOrder', 'asc')), (snap) => {
  const items = sortItems(snap.docs
    .map(docSnap => normalizeItemRecord(docSnap.id, docSnap.data()))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null))
    .map(item => ({
      id: item.id,
      nome: item.name,
      categoria: item.categoryId,
      priceCents: item.priceCents,
    }));
  onValue(items);
}, error => onError?.(error));

export const loadDaySelection = async (dateKey = getDateKey()): Promise<string[]> => {
  const dailyMenu = await loadDailyMenuRecord(dateKey);
  return dailyMenu.itemIds;
};

export const saveDaySelection = (dateKey: string, ids: string[]): Promise<void> => {
  return saveDailyMenuSelection(dateKey, ids);
};

export const saveItemAlwaysActive = (itemId: string, alwaysActive: boolean): Promise<void> =>
  updateDoc(doc(itemsCollectionRef(), itemId), { alwaysActive });

export const saveCategoryExcludeFromShare = (categoryName: string, excludeFromShare: boolean): Promise<void> =>
  updateDoc(doc(categoriesCollectionRef(), createCategoryId(categoryName)), { excludeFromShare });

export const initDaySelectionIfEmpty = async (dateKey: string, defaultIds: string[]): Promise<void> => {
  const snap = await getDoc(dailyMenuRef(dateKey));
  if (!snap.exists()) {
    await setDoc(dailyMenuRef(dateKey), {
      dateKey,
      status: 'draft',
      shareToken: null,
      activeVersionId: null,
      itemIds: defaultIds,
      updatedAt: Date.now(),
    });
  }
};

export const subscribeDaySelection = (
  dateKey: string,
  onValue: (ids: string[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(dailyMenuRef(dateKey), (snap) => {
  onValue(snap.exists() ? normalizeDailyMenuRecord(dateKey, snap.data()).itemIds : []);
}, error => onError?.(error));

export const loadRecentSelections = async (days: number): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  const snaps = await loadSelectionHistory(days);
  for (const snap of snaps) {
    for (const id of snap.ids) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

export const loadSelectionHistory = async (days: number): Promise<SelectionHistoryEntry[]> => {
  const today = new Date();
  const dateKeys = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    return getDateKey(date);
  });

  const orderSnaps = await Promise.all(dateKeys.map(dateKey => getDocs(dailyMenuOrdersRef(dateKey))));
  return orderSnaps.flatMap((snap, index) => {
    if (snap.empty) return [];
    const ids = snap.docs.flatMap(docSnap => {
      const order = normalizeOrderEntry(docSnap.id, docSnap.data());
      return order ? expandSelectionEntriesToIds(order.selectedItems ?? []) : [];
    });
    return ids.length > 0 ? [{ dateKey: dateKeys[index]!, ids }] : [];
  });
};

export const loadMenuAvailabilityHistory = async (days: number): Promise<SelectionHistoryEntry[]> => {
  const today = new Date();
  const dateKeys = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    return getDateKey(date);
  });

  const menuSnaps = await Promise.all(dateKeys.map(dateKey => getDoc(dailyMenuRef(dateKey))));
  return menuSnaps.flatMap((snap, index) => {
    if (!snap.exists()) return [];
    const dailyMenu = normalizeDailyMenuRecord(dateKeys[index]!, snap.data());
    return dailyMenu.itemIds.length > 0 ? [{ dateKey: dateKeys[index]!, ids: dailyMenu.itemIds }] : [];
  });
};

const normalizeEditorLock = (value: unknown): EditorLock | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.status !== 'active'
    || typeof candidate.sessionId !== 'string'
    || typeof candidate.userEmail !== 'string'
    || typeof candidate.deviceLabel !== 'string'
  ) return null;
  return {
    sessionId: candidate.sessionId,
    userEmail: candidate.userEmail,
    deviceLabel: candidate.deviceLabel,
    status: 'active',
    acquiredAt: normalizeTimestamp(candidate.acquiredAt) ?? Date.now(),
    lastHeartbeatAt: normalizeTimestamp(candidate.lastHeartbeatAt) ?? Date.now(),
    expiresAt: normalizeTimestamp(candidate.expiresAt) ?? Date.now() + LOCK_TIMEOUT_MS,
  };
};

export const loadEditorLock = async (): Promise<EditorLock | null> => {
  const snap = await getDoc(editorLockRef());
  return snap.exists() ? normalizeEditorLock(snap.data()) : null;
};

export const subscribeEditorLock = (
  onValue: (lock: EditorLock | null) => void,
  onError?: (error: Error) => void,
) => onSnapshot(editorLockRef(), (snap) => {
  onValue(snap.exists() ? normalizeEditorLock(snap.data()) : null);
}, error => onError?.(error));

export const acquireEditorLock = async (
  input: AcquireEditorLockInput,
  options: AcquireEditorLockOptions = {},
): Promise<EditorLock | null> => {
  return runTransaction(getDb(), async (transaction) => {
    const ref = editorLockRef();
    const snap = await transaction.get(ref);
    const current = snap.exists() ? normalizeEditorLock(snap.data()) : null;
    const now = Date.now();

    if (!options.force && current && !isLockExpired(current, now) && current.sessionId !== input.sessionId) {
      return null;
    }

    const nextLock: EditorLock = {
      sessionId: input.sessionId,
      userEmail: input.userEmail,
      deviceLabel: input.deviceLabel,
      status: 'active',
      acquiredAt: current?.sessionId === input.sessionId ? current.acquiredAt : now,
      lastHeartbeatAt: now,
      expiresAt: now + LOCK_TIMEOUT_MS,
    };

    transaction.set(ref, nextLock);
    return nextLock;
  });
};

export const renewEditorLock = async (sessionId: string): Promise<EditorLock | null> => {
  return runTransaction(getDb(), async (transaction) => {
    const ref = editorLockRef();
    const snap = await transaction.get(ref);
    if (!snap.exists()) return null;

    const current = normalizeEditorLock(snap.data());
    const now = Date.now();
    if (!current || current.sessionId !== sessionId || isLockExpired(current, now)) {
      return null;
    }

    const nextLock: EditorLock = {
      ...current,
      lastHeartbeatAt: now,
      expiresAt: now + LOCK_TIMEOUT_MS,
    };
    transaction.set(ref, nextLock);
    return nextLock;
  });
};

export const releaseEditorLock = async (sessionId: string): Promise<void> => {
  await runTransaction(getDb(), async (transaction) => {
    const ref = editorLockRef();
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const current = normalizeEditorLock(snap.data());
    if (!current || current.sessionId !== sessionId) return;
    transaction.delete(ref);
  });
};

const writePublishedMenuVersion = async (
  input: CreateDailyShareLinkInput,
  acceptingOrders: boolean,
  currentMenuOverride?: ReturnType<typeof normalizeDailyMenuRecord> | null,
) => {
  const persisted = await loadPersistedPublishedSnapshot(input.dateKey);
  const currentMenu = currentMenuOverride ?? persisted.dailyMenu;
  const token = await reserveDailyMenuToken(input.dateKey, currentMenu.shareToken);
  const versionId = createVersionId(input.dateKey);
  const version = buildPublishedMenuVersion({
    versionId,
    dateKey: input.dateKey,
    shareToken: token,
    categories: persisted.categories,
    items: persisted.items,
    selectedItemIds: persisted.dailyMenu.itemIds,
    createdAt: Date.now(),
  });

  await setDoc(dailyMenuVersionRef(input.dateKey, versionId), version);
  await setDoc(dailyMenuRef(input.dateKey), {
    dateKey: input.dateKey,
    status: acceptingOrders ? 'published' : 'closed',
    shareToken: token,
    activeVersionId: versionId,
    itemIds: persisted.dailyMenu.itemIds,
    updatedAt: Date.now(),
  });
  await setDoc(dailyMenuTokenRef(token), {
    shareToken: token,
    dateKey: input.dateKey,
    activeVersionId: versionId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { token, versionId };
};

const publishMenuVersion = async (input: CreateDailyShareLinkInput, acceptingOrders: boolean) => {
  await saveCategoriesInternal(input.categories);
  await saveComplementsInternal(input.complements);
  await saveCategorySelectionRules(input.categorySelectionRules, input.categories);
  await saveDaySelection(input.dateKey, input.daySelection);
  return writePublishedMenuVersion(input, acceptingOrders);
};

export const getOrCreateDailyShareLink = async (input: CreateDailyShareLinkInput): Promise<ShareLinkResult> => {
  const { token } = await publishMenuVersion(input, true);
  return {
    token,
    url: buildPublicUrl(token),
  };
};

export const loadPublicMenu = async (token: string): Promise<PublicMenu | null> => {
  const resolved = await loadActivePublicMenuVersion(token);
  if (!resolved) return null;
  const publicMenu = buildPublicMenuFromVersion(
    token,
    resolved.menu.dateKey,
    resolved.menu.status !== 'closed',
    resolved.version,
  );
  return isMenuExpired(publicMenu) ? null : publicMenu;
};

export const subscribePublicMenu = (
  token: string,
  onValue: (menu: PublicMenu | null) => void,
  onError?: (error: Error) => void,
) => {
  let menuUnsubscribe: (() => void) | null = null;
  let versionUnsubscribe: (() => void) | null = null;

  const unsubscribeToken = onSnapshot(
    dailyMenuTokenRef(token),
    (tokenSnap) => {
      if (menuUnsubscribe) {
        menuUnsubscribe();
        menuUnsubscribe = null;
      }
      if (versionUnsubscribe) {
        versionUnsubscribe();
        versionUnsubscribe = null;
      }

      if (!tokenSnap.exists()) {
        onValue(null);
        return;
      }

      const tokenRecord = normalizeDailyMenuTokenRecord(token, tokenSnap.data());
      if (!tokenRecord) {
        onValue(null);
        return;
      }
      menuUnsubscribe = onSnapshot(dailyMenuRef(tokenRecord.dateKey), (menuSnap) => {
        if (!menuSnap.exists()) {
          onValue(null);
          return;
        }
        const menu = normalizeDailyMenuRecord(tokenRecord.dateKey, menuSnap.data());
        if (!menu.activeVersionId || menu.activeVersionId !== tokenRecord.activeVersionId) {
          onValue(null);
          return;
        }

        if (versionUnsubscribe) {
          versionUnsubscribe();
          versionUnsubscribe = null;
        }

        versionUnsubscribe = onSnapshot(dailyMenuVersionRef(menu.dateKey, menu.activeVersionId), (versionSnap) => {
          if (!versionSnap.exists()) {
            onValue(null);
            return;
          }
          const version = normalizePublishedMenuVersion(versionSnap.id, versionSnap.data());
          if (!version) {
            onValue(null);
            return;
          }
          const publicMenu = buildPublicMenuFromVersion(token, menu.dateKey, menu.status !== 'closed', version);
          onValue(isMenuExpired(publicMenu) ? null : publicMenu);
        }, error => onError?.(error));
      }, error => onError?.(error));
    },
    error => onError?.(error),
  );

  return () => {
    unsubscribeToken();
    menuUnsubscribe?.();
    versionUnsubscribe?.();
  };
};

export const syncPublicMenuSnapshotForDate = async (input: CreateDailyShareLinkInput): Promise<void> => {
  const currentMenu = await loadDailyMenuRecord(input.dateKey);
  if (!currentMenu.shareToken) return;
  await writePublishedMenuVersion(input, currentMenu.status !== 'closed', currentMenu);
};

export const subscribeOrderIntakeStatus = (
  dateKey: string,
  onValue: (acceptingOrders: boolean) => void,
  onError?: (error: Error) => void,
) => onSnapshot(dailyMenuRef(dateKey), (snap) => {
  onValue(!snap.exists() || normalizeDailyMenuRecord(dateKey, snap.data()).status !== 'closed');
}, error => onError?.(error));

export const setOrderIntakeStatus = async (input: SetOrderIntakeStatusInput): Promise<void> => {
  await publishMenuVersion(input, input.acceptingOrders);
};

const publicOrdersApiBase = () => {
  const base = import.meta.env.VITE_PUBLIC_ORDER_API_URL;
  return typeof base === 'string' && base.trim()
    ? base.replace(/\/$/, '')
    : '';
};

const postPublicOrdersApi = async <TResponse>(path: string, payload: unknown): Promise<TResponse> => {
  const base = publicOrdersApiBase();
  if (!base) {
    throw new Error('Configuração do checkout indisponível.');
  }

  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Não foi possível concluir a operação.';
    try {
      const data = await response.json() as { message?: string };
      if (typeof data.message === 'string' && data.message.trim()) message = data.message;
    } catch {
      // Ignore malformed API response.
    }
    throw new Error(message);
  }

  return response.json() as Promise<TResponse>;
};

export const preparePublicOrderCheckout = async (
  input: PreparePublicOrderCheckoutInput,
): Promise<PreparePublicOrderCheckoutResult> => (
  postPublicOrdersApi<PreparePublicOrderCheckoutResult>('/preparePublicOrderCheckout', input)
);

export const fetchPublicOrderStatus = async (
  input: FetchPublicOrderStatusInput,
): Promise<FetchPublicOrderStatusResult> => (
  postPublicOrdersApi<FetchPublicOrderStatusResult>('/publicOrderStatus', input)
);

export const submitPublicOrder = async ({
  ...input
}: SubmitPublicOrderInput): Promise<SubmitPublicOrderResult> => {
  const checkout = await preparePublicOrderCheckout({
    ...input,
  });
  if (checkout.kind !== 'free_order_confirmed' || !checkout.order) {
    throw new Error('Este pedido exige checkout antes da finalização.');
  }
  return checkout.order;
};

export const deletePublicOrder = async ({
  ...input
}: DeletePublicOrderInput): Promise<void> => {
  await cancelPublicOrder(input);
};

export const cancelPublicOrder = async ({
  orderId,
  dateKey,
  shareToken,
}: DeletePublicOrderInput): Promise<CancelPublicOrderResult> => (
  postPublicOrdersApi<CancelPublicOrderResult>('/cancelPublicOrder', {
    orderId,
    dateKey,
    shareToken,
  })
);

export const loadPublicMenuVersions = async (versionIds: string[]): Promise<Record<string, PublicMenuVersion>> => {
  const uniqueIds = Array.from(new Set(versionIds.filter(Boolean)));
  const snaps = await Promise.all(uniqueIds.map((versionId) => {
    const dateKey = parseDateKeyFromVersionId(versionId);
    return dateKey ? getDoc(dailyMenuVersionRef(dateKey, versionId)) : Promise.resolve(null);
  }));

  return snaps.reduce<Record<string, PublicMenuVersion>>((acc, snap, index) => {
    if (!snap || !snap.exists()) return acc;
    const versionId = uniqueIds[index];
    if (!versionId) return acc;
    const normalized = normalizePublishedMenuVersion(versionId, snap.data());
    if (normalized) acc[versionId] = normalized;
    return acc;
  }, {});
};

export const subscribeOrders = (
  dateKey: string,
  onValue: (orders: OrderEntry[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(
  query(dailyMenuOrdersRef(dateKey), orderBy('submittedAt', 'desc')),
  (snap) => {
    const orders = snap.docs
      .map(docSnap => normalizeOrderEntry(docSnap.id, docSnap.data()))
      .filter((entry): entry is OrderEntry => entry !== null);
    onValue(orders);
  },
  error => onError?.(error),
);
