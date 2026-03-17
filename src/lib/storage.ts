import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { CategorySelectionRule, EditorLock, Item, OrderEntry, PublicMenu, PublicMenuVersion } from '../types';
import { normalizeCategorySelectionRules, validateSelectionRules } from './categorySelectionRules';

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

const categoriesRef = () => doc(getDb(), 'config', 'categories');
const complementsRef = () => doc(getDb(), 'config', 'complements');
const categorySelectionRulesRef = () => doc(getDb(), 'config', 'categorySelectionRules');
const selectionRef = (dateKey: string) => doc(getDb(), 'selections', dateKey);
const editorLockRef = () => doc(getDb(), 'config', 'editorLock');
const shareLinkRef = (dateKey: string) => doc(getDb(), 'shareLinks', dateKey);
const publicMenuRef = (token: string) => doc(getDb(), 'publicMenus', token);
const publicMenuVersionRef = (versionId: string) => doc(getDb(), 'publicMenuVersions', versionId);
const ordersCollectionRef = (dateKey: string) => collection(getDb(), 'orders', dateKey, 'entries');

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

interface StoredShareLink {
  token: string;
  dateKey: string;
  createdAt: number;
  expiresAt: number;
  acceptingOrders: boolean;
}

export interface CreateDailyShareLinkInput {
  dateKey: string;
  categories: string[];
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
  selectedItemIds: string[];
}

export interface SubmitPublicOrderResult {
  selectedItemIds: string[];
}

export interface DeletePublicOrderInput {
  orderId: string;
  dateKey: string;
  shareToken: string;
}

export interface SetOrderIntakeStatusInput extends CreateDailyShareLinkInput {
  acceptingOrders: boolean;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isValidItem = (value: unknown): value is Item => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.nome === 'string'
    && typeof candidate.categoria === 'string';
};

const isValidEditorLock = (value: unknown): value is EditorLock => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return candidate.status === 'active'
    && typeof candidate.sessionId === 'string'
    && typeof candidate.userEmail === 'string'
    && typeof candidate.deviceLabel === 'string'
    && typeof candidate.acquiredAt === 'number'
    && typeof candidate.lastHeartbeatAt === 'number'
    && typeof candidate.expiresAt === 'number';
};

const normalizeStringArray = (value: unknown): string[] =>
  isStringArray(value) ? value : [];

const normalizeItems = (value: unknown): Item[] =>
  Array.isArray(value) ? value.filter(isValidItem) : [];

const normalizeEditorLock = (value: unknown): EditorLock | null =>
  isValidEditorLock(value) ? value : null;

const normalizeTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return null;
};

const isValidStoredShareLink = (value: unknown): value is StoredShareLink => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.token === 'string'
    && typeof candidate.dateKey === 'string'
    && normalizeTimestamp(candidate.createdAt) !== null
    && normalizeTimestamp(candidate.expiresAt) !== null
    && (candidate.acceptingOrders === undefined || typeof candidate.acceptingOrders === 'boolean');
};

const isValidCategorySelectionRule = (value: unknown): value is CategorySelectionRule => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.category === 'string'
    && (candidate.maxSelections === undefined || typeof candidate.maxSelections === 'number')
    && (candidate.sharedLimitGroupId === undefined || candidate.sharedLimitGroupId === null || typeof candidate.sharedLimitGroupId === 'string');
};

const isValidPublicMenu = (value: unknown): value is PublicMenu & { createdAt: number } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.token === 'string'
    && typeof candidate.dateKey === 'string'
    && (candidate.acceptingOrders === undefined || typeof candidate.acceptingOrders === 'boolean')
    && typeof candidate.currentVersionId === 'string'
    && Array.isArray(candidate.categories)
    && candidate.categories.every(item => typeof item === 'string')
    && Array.isArray(candidate.items)
    && candidate.items.every(isValidItem)
    && Array.isArray(candidate.categorySelectionRules)
    && candidate.categorySelectionRules.every(isValidCategorySelectionRule)
    && normalizeTimestamp(candidate.createdAt) !== null
    && normalizeTimestamp(candidate.expiresAt) !== null;
};

const isValidPublicMenuVersion = (value: unknown): value is PublicMenuVersion => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.token === 'string'
    && typeof candidate.dateKey === 'string'
    && Array.isArray(candidate.categories)
    && candidate.categories.every(item => typeof item === 'string')
    && Array.isArray(candidate.itemIds)
    && candidate.itemIds.every(item => typeof item === 'string')
    && Array.isArray(candidate.items)
    && candidate.items.every(isValidItem)
    && Array.isArray(candidate.categorySelectionRules)
    && candidate.categorySelectionRules.every(isValidCategorySelectionRule)
    && normalizeTimestamp(candidate.createdAt) !== null;
};

const isValidOrderEntry = (value: unknown, id: string): value is OrderEntry => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof id === 'string'
    && typeof candidate.dateKey === 'string'
    && typeof candidate.shareToken === 'string'
    && typeof candidate.orderId === 'string'
    && typeof candidate.customerName === 'string'
    && (candidate.menuVersionId === undefined || typeof candidate.menuVersionId === 'string')
    && isStringArray(candidate.selectedItemIds)
    && (candidate.submittedItems === undefined || (
      Array.isArray(candidate.submittedItems)
      && candidate.submittedItems.every(isValidItem)
    ))
    && normalizeTimestamp(candidate.submittedAt) !== null;
};

const normalizeStoredShareLink = (value: unknown): StoredShareLink | null => {
  if (!isValidStoredShareLink(value)) return null;
  return {
    token: value.token,
    dateKey: value.dateKey,
    createdAt: normalizeTimestamp(value.createdAt)!,
    expiresAt: normalizeTimestamp(value.expiresAt)!,
    acceptingOrders: value.acceptingOrders ?? true,
  };
};

const normalizePublicMenu = (value: unknown): PublicMenu | null => {
  if (!isValidPublicMenu(value)) return null;
  return {
    token: value.token,
    dateKey: value.dateKey,
    acceptingOrders: value.acceptingOrders ?? true,
    currentVersionId: value.currentVersionId,
    categories: value.categories,
    items: value.items,
    categorySelectionRules: normalizeCategorySelectionRules(value.categorySelectionRules),
    expiresAt: normalizeTimestamp(value.expiresAt)!,
  };
};

const normalizePublicMenuVersion = (id: string, value: unknown): PublicMenuVersion | null => {
  if (!isValidPublicMenuVersion(value)) return null;
  return {
    id,
    token: value.token,
    dateKey: value.dateKey,
    categories: value.categories,
    itemIds: value.itemIds,
    items: value.items,
    categorySelectionRules: normalizeCategorySelectionRules(value.categorySelectionRules),
    createdAt: normalizeTimestamp(value.createdAt)!,
  };
};

const normalizeOrderEntry = (id: string, value: unknown): OrderEntry | null => {
  if (!isValidOrderEntry(value, id)) return null;
  return {
    id,
    dateKey: value.dateKey,
    shareToken: value.shareToken,
    orderId: value.orderId,
    customerName: value.customerName,
    menuVersionId: typeof value.menuVersionId === 'string' ? value.menuVersionId : undefined,
    selectedItemIds: value.selectedItemIds,
    submittedItems: Array.isArray(value.submittedItems) ? value.submittedItems : undefined,
    submittedAt: normalizeTimestamp(value.submittedAt)!,
  };
};

const buildEditorLock = ({ sessionId, userEmail, deviceLabel }: AcquireEditorLockInput, now: number): EditorLock => ({
  sessionId,
  userEmail,
  deviceLabel,
  status: 'active',
  acquiredAt: now,
  lastHeartbeatAt: now,
  expiresAt: now + LOCK_TIMEOUT_MS,
});

export const isLockExpired = (lock: EditorLock | null, now = Date.now()) =>
  !lock || lock.expiresAt <= now;

export const isMenuExpired = (menu: PublicMenu | null, now = Date.now()) =>
  !menu || menu.expiresAt <= now;

const buildExpiryDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 24, 0, 0, 0);
};

const buildSelectedItemsSnapshot = (
  categories: string[],
  complements: Item[],
  daySelection: string[],
  categorySelectionRules: CategorySelectionRule[],
): Pick<PublicMenu, 'categories' | 'items' | 'categorySelectionRules'> => {
  const selected = complements.filter(item => daySelection.includes(item.id));
  const categorySet = new Set(selected.map(item => item.categoria));

  return {
    categories: categories.filter(category => categorySet.has(category)),
    items: selected.map(item => ({ ...item })),
    categorySelectionRules: normalizeCategorySelectionRules(categorySelectionRules)
      .filter(rule => categorySet.has(rule.category)),
  };
};

const buildPublicUrl = (token: string) => {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/s/${token}`;
};

const buildPublicMenuDocument = ({
  token,
  currentVersionId,
  dateKey,
  categories,
  complements,
  daySelection,
  categorySelectionRules,
  acceptingOrders,
  now,
}: CreateDailyShareLinkInput & { token: string; currentVersionId: string; now: number; acceptingOrders: boolean }) => {
  const expiresAt = buildExpiryDate(dateKey);
  const snapshot = buildSelectedItemsSnapshot(categories, complements, daySelection, categorySelectionRules);

  return {
    token,
    dateKey,
    acceptingOrders,
    currentVersionId,
    categories: snapshot.categories,
    items: snapshot.items,
    categorySelectionRules: snapshot.categorySelectionRules,
    createdAt: new Date(now),
    expiresAt,
  };
};

const buildPublicMenuVersionDocument = ({
  token,
  versionId,
  dateKey,
  categories,
  complements,
  daySelection,
  categorySelectionRules,
  now,
}: CreateDailyShareLinkInput & { token: string; versionId: string; now: number }) => {
  const snapshot = buildSelectedItemsSnapshot(categories, complements, daySelection, categorySelectionRules);

  return {
    id: versionId,
    token,
    dateKey,
    categories: snapshot.categories,
    itemIds: snapshot.items.map(item => item.id),
    items: snapshot.items,
    categorySelectionRules: snapshot.categorySelectionRules,
    createdAt: new Date(now),
  };
};

const createVersionId = (dateKey: string) => (
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${dateKey}-${Math.random().toString(36).slice(2, 12)}`
);

const buildShareLinkDocument = ({
  token,
  dateKey,
  acceptingOrders,
  now,
}: { token: string; dateKey: string; acceptingOrders: boolean; now: number }) => ({
  token,
  dateKey,
  acceptingOrders,
  createdAt: new Date(now),
  expiresAt: buildExpiryDate(dateKey),
});

export const loadCategories = async (): Promise<string[]> => {
  const snap = await getDoc(categoriesRef());
  return snap.exists() ? normalizeStringArray(snap.data().items) : [];
};

export const saveCategories = (items: string[]): Promise<void> => {
  return setDoc(categoriesRef(), { items });
};

export const subscribeCategories = (
  onValue: (items: string[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(categoriesRef(), (snap) => {
  onValue(snap.exists() ? normalizeStringArray(snap.data().items) : []);
}, error => onError?.(error));

export const loadComplements = async (): Promise<Item[]> => {
  const snap = await getDoc(complementsRef());
  return snap.exists() ? normalizeItems(snap.data().items) : [];
};

export const saveComplements = (items: Item[]): Promise<void> => {
  return setDoc(complementsRef(), { items });
};

export const loadCategorySelectionRules = async (): Promise<CategorySelectionRule[]> => {
  const snap = await getDoc(categorySelectionRulesRef());
  return snap.exists() ? normalizeCategorySelectionRules(snap.data().rules) : [];
};

export const saveCategorySelectionRules = (rules: CategorySelectionRule[]): Promise<void> => {
  return setDoc(categorySelectionRulesRef(), { rules: normalizeCategorySelectionRules(rules) });
};

export const subscribeCategorySelectionRules = (
  onValue: (rules: CategorySelectionRule[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(categorySelectionRulesRef(), (snap) => {
  onValue(snap.exists() ? normalizeCategorySelectionRules(snap.data().rules) : []);
}, error => onError?.(error));

export const subscribeComplements = (
  onValue: (items: Item[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(complementsRef(), (snap) => {
  onValue(snap.exists() ? normalizeItems(snap.data().items) : []);
}, error => onError?.(error));

export const loadDaySelection = async (dateKey = getDateKey()): Promise<string[]> => {
  const snap = await getDoc(selectionRef(dateKey));
  return snap.exists() ? normalizeStringArray(snap.data().ids) : [];
};

export const saveDaySelection = (dateKey: string, ids: string[]): Promise<void> => {
  return setDoc(selectionRef(dateKey), { ids });
};

export const subscribeDaySelection = (
  dateKey: string,
  onValue: (ids: string[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(selectionRef(dateKey), (snap) => {
  onValue(snap.exists() ? normalizeStringArray(snap.data().ids) : []);
}, error => onError?.(error));

export const loadRecentSelections = async (days: number): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  const snaps = await loadSelectionHistory(days);
  for (const snap of snaps) {
    for (const id of snap.ids)
      counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
};

export const loadSelectionHistory = async (days: number): Promise<SelectionHistoryEntry[]> => {
  const today = new Date();
  const refs = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateKey = getDateKey(d);
    return { dateKey, ref: doc(getDb(), 'selections', dateKey) };
  });

  const snaps = await Promise.all(refs.map(({ ref }) => getDoc(ref)));

  return snaps.flatMap((snap, index) => {
    if (!snap.exists()) return [];
    return [{
      dateKey: refs[index].dateKey,
      ids: normalizeStringArray(snap.data().ids),
    }];
  });
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

    const nextLock = current?.sessionId === input.sessionId
      ? {
          ...current,
          userEmail: input.userEmail,
          deviceLabel: input.deviceLabel,
          status: 'active' as const,
          lastHeartbeatAt: now,
          expiresAt: now + LOCK_TIMEOUT_MS,
        }
      : buildEditorLock(input, now);

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

export const getOrCreateDailyShareLink = async ({
  dateKey,
  categories,
  complements,
  daySelection,
  categorySelectionRules,
}: CreateDailyShareLinkInput): Promise<ShareLinkResult> => {
  const now = Date.now();

  return runTransaction(getDb(), async (transaction) => {
    const linkRef = shareLinkRef(dateKey);
    const linkSnap = await transaction.get(linkRef);
    const existingLink = linkSnap.exists() ? normalizeStoredShareLink(linkSnap.data()) : null;

    if (existingLink && existingLink.expiresAt > now) {
      const versionId = createVersionId(dateKey);
      const publicMenuVersion = buildPublicMenuVersionDocument({
        token: existingLink.token,
        versionId,
        dateKey,
        categories,
        complements,
        daySelection,
        categorySelectionRules,
        now,
      });
      const publicMenu = buildPublicMenuDocument({
        token: existingLink.token,
        currentVersionId: versionId,
        dateKey,
        categories,
        complements,
        daySelection,
        categorySelectionRules,
        acceptingOrders: existingLink.acceptingOrders,
        now,
      });
      transaction.set(publicMenuVersionRef(versionId), publicMenuVersion);
      transaction.set(publicMenuRef(existingLink.token), publicMenu);
      return {
        token: existingLink.token,
        url: buildPublicUrl(existingLink.token),
      };
    }

    const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${dateKey}-${Math.random().toString(36).slice(2, 12)}`;
    const versionId = createVersionId(dateKey);
    const publicMenuVersion = buildPublicMenuVersionDocument({
      token,
      versionId,
      dateKey,
      categories,
      complements,
      daySelection,
      categorySelectionRules,
      now,
    });
    const publicMenu = buildPublicMenuDocument({
      token,
      currentVersionId: versionId,
      dateKey,
      categories,
      complements,
      daySelection,
      categorySelectionRules,
      acceptingOrders: true,
      now,
    });

    transaction.set(linkRef, buildShareLinkDocument({
      token,
      dateKey,
      acceptingOrders: true,
      now,
    }));
    transaction.set(publicMenuVersionRef(versionId), publicMenuVersion);
    transaction.set(publicMenuRef(token), publicMenu);

    return {
      token,
      url: buildPublicUrl(token),
    };
  });
};

export const loadPublicMenu = async (token: string): Promise<PublicMenu | null> => {
  const snap = await getDoc(publicMenuRef(token));
  if (!snap.exists()) return null;
  const menu = normalizePublicMenu(snap.data());
  if (!menu || isMenuExpired(menu)) return null;
  return menu;
};

export const subscribePublicMenu = (
  token: string,
  onValue: (menu: PublicMenu | null) => void,
  onError?: (error: Error) => void,
) => onSnapshot(publicMenuRef(token), (snap) => {
  if (!snap.exists()) {
    onValue(null);
    return;
  }

  const menu = normalizePublicMenu(snap.data());
  onValue(menu && !isMenuExpired(menu) ? menu : null);
}, error => onError?.(error));

export const syncPublicMenuSnapshotForDate = async ({
  dateKey,
  categories,
  complements,
  daySelection,
  categorySelectionRules,
}: CreateDailyShareLinkInput): Promise<void> => {
  const linkSnap = await getDoc(shareLinkRef(dateKey));
  if (!linkSnap.exists()) return;

  const existingLink = normalizeStoredShareLink(linkSnap.data());
  if (!existingLink || existingLink.expiresAt <= Date.now()) return;

  const now = Date.now();
  const versionId = createVersionId(dateKey);
  const publicMenuVersion = buildPublicMenuVersionDocument({
    token: existingLink.token,
    versionId,
    dateKey,
    categories,
    complements,
    daySelection,
    categorySelectionRules,
    now,
  });
  const publicMenu = buildPublicMenuDocument({
    token: existingLink.token,
    currentVersionId: versionId,
    dateKey,
    categories,
    complements,
    daySelection,
    categorySelectionRules,
    acceptingOrders: existingLink.acceptingOrders,
    now,
  });

  await setDoc(publicMenuVersionRef(versionId), publicMenuVersion);
  await setDoc(publicMenuRef(existingLink.token), publicMenu);
};

export const subscribeOrderIntakeStatus = (
  dateKey: string,
  onValue: (acceptingOrders: boolean) => void,
  onError?: (error: Error) => void,
) => onSnapshot(shareLinkRef(dateKey), (snap) => {
  if (!snap.exists()) {
    onValue(true);
    return;
  }

  const link = normalizeStoredShareLink(snap.data());
  onValue(link?.acceptingOrders ?? true);
}, error => onError?.(error));

export const setOrderIntakeStatus = async ({
  dateKey,
  categories,
  complements,
  daySelection,
  categorySelectionRules,
  acceptingOrders,
}: SetOrderIntakeStatusInput): Promise<void> => {
  const now = Date.now();

  await runTransaction(getDb(), async (transaction) => {
    const linkRef = shareLinkRef(dateKey);
    const linkSnap = await transaction.get(linkRef);
    const existingLink = linkSnap.exists() ? normalizeStoredShareLink(linkSnap.data()) : null;
    const validExistingLink = existingLink && existingLink.expiresAt > now ? existingLink : null;
    const token = validExistingLink?.token ?? (
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${dateKey}-${Math.random().toString(36).slice(2, 12)}`
    );

    transaction.set(linkRef, buildShareLinkDocument({
      token,
      dateKey,
      acceptingOrders,
      now,
    }));
    const versionId = createVersionId(dateKey);
    transaction.set(publicMenuVersionRef(versionId), buildPublicMenuVersionDocument({
      token,
      versionId,
      dateKey,
      categories,
      complements,
      daySelection,
      categorySelectionRules,
      now,
    }));
    transaction.set(publicMenuRef(token), buildPublicMenuDocument({
      token,
      currentVersionId: versionId,
      dateKey,
      categories,
      complements,
      daySelection,
      categorySelectionRules,
      acceptingOrders,
      now,
    }));
  });
};

export const submitPublicOrder = async ({
  orderId,
  dateKey,
  shareToken,
  customerName,
  selectedItemIds,
}: SubmitPublicOrderInput): Promise<SubmitPublicOrderResult> => {
  const publicMenu = await loadPublicMenu(shareToken);
  if (!publicMenu || publicMenu.dateKey !== dateKey) {
    throw new Error('Cardapio publico indisponivel para este pedido.');
  }
  if (!publicMenu.acceptingOrders) {
    throw new Error('Os pedidos deste cardapio foram encerrados.');
  }

  const submittedItemIds = publicMenu.items
    .filter(item => selectedItemIds.includes(item.id))
    .map(item => item.id);

  if (submittedItemIds.length === 0) {
    throw new Error('Nenhum item valido encontrado para este pedido.');
  }

  const selectionViolations = validateSelectionRules(
    publicMenu.items,
    submittedItemIds,
    publicMenu.categorySelectionRules,
  );
  if (selectionViolations.length > 0) {
    throw new Error(selectionViolations[0]?.message ?? 'Selecao invalida para este pedido.');
  }

  await setDoc(doc(getDb(), 'orders', dateKey, 'entries', orderId), {
    orderId,
    dateKey,
    shareToken,
    customerName: customerName.trim(),
    menuVersionId: publicMenu.currentVersionId,
    selectedItemIds: submittedItemIds,
    submittedAt: new Date(),
  });

  return { selectedItemIds: submittedItemIds };
};

export const deletePublicOrder = async ({
  orderId,
  dateKey,
  shareToken,
}: DeletePublicOrderInput): Promise<void> => {
  const publicMenu = await loadPublicMenu(shareToken);
  if (!publicMenu || publicMenu.dateKey !== dateKey) {
    throw new Error('Cardapio publico indisponivel para este pedido.');
  }
  if (!publicMenu.acceptingOrders) {
    throw new Error('Os pedidos deste cardapio foram encerrados.');
  }

  await deleteDoc(doc(getDb(), 'orders', dateKey, 'entries', orderId));
};

export const loadPublicMenuVersions = async (versionIds: string[]): Promise<Record<string, PublicMenuVersion>> => {
  const uniqueIds = Array.from(new Set(versionIds.filter(Boolean)));
  const snaps = await Promise.all(uniqueIds.map(versionId => getDoc(publicMenuVersionRef(versionId))));

  return snaps.reduce<Record<string, PublicMenuVersion>>((acc, snap, index) => {
    if (!snap.exists()) return acc;
    const versionId = uniqueIds[index];
    if (!versionId) return acc;
    const normalized = normalizePublicMenuVersion(versionId, snap.data());
    if (normalized) acc[versionId] = normalized;
    return acc;
  }, {});
};

export const subscribeOrders = (
  dateKey: string,
  onValue: (orders: OrderEntry[]) => void,
  onError?: (error: Error) => void,
) => onSnapshot(
  query(ordersCollectionRef(dateKey), orderBy('submittedAt', 'desc')),
  (snap) => {
    const orders = snap.docs
      .map(docSnap => normalizeOrderEntry(docSnap.id, docSnap.data()))
      .filter((entry): entry is OrderEntry => entry !== null);
    onValue(orders);
  },
  error => onError?.(error),
);
