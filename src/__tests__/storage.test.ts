import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ db: {} }));

const buildOrderLine = (
  itemId: string,
  name: string,
  categoryName: string,
  quantity = 1,
  unitPriceCents = 0,
) => ({
  itemId,
  quantity,
  unitPriceCents,
  name,
  categoryId: categoryName.toLowerCase(),
  categoryName,
});

type StoredValue = Record<string, unknown>;
type Ref = { path: string; kind: 'doc' | 'collection'; clauses?: Clause[] };
type Clause =
  | { type: 'where'; field: string; op: string; value: unknown }
  | { type: 'limit'; count: number }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' };

const store = new Map<string, StoredValue>();
const mockFetch = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn();

const buildRefPath = (base: unknown, segments: string[]) => {
  const prefix = base && typeof base === 'object' && 'path' in (base as Record<string, unknown>)
    ? String((base as { path: string }).path)
    : '';
  return [prefix, ...segments].filter(Boolean).join('/');
};

const doc = (base: unknown, ...segments: string[]): Ref => ({
  path: buildRefPath(base, segments),
  kind: 'doc',
});

const collection = (base: unknown, ...segments: string[]): Ref => ({
  path: buildRefPath(base, segments),
  kind: 'collection',
});

const where = (field: string, op: string, value: unknown): Clause => ({ type: 'where', field, op, value });
const limit = (count: number): Clause => ({ type: 'limit', count });
const orderBy = (field: string, direction: 'asc' | 'desc'): Clause => ({ type: 'orderBy', field, direction });
const query = (ref: Ref, ...clauses: Clause[]): Ref => ({ ...ref, clauses });

const getCollectionDocs = (ref: Ref) => {
  const prefix = `${ref.path}/`;
  const docs = Array.from(store.entries())
    .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
    .map(([path, data]) => ({
      id: path.slice(prefix.length),
      path,
      data,
      ref: { path, kind: 'doc' as const },
    }));

  let result = docs;
  for (const clause of ref.clauses ?? []) {
    if (clause.type === 'where' && clause.op === '==') {
      result = result.filter((entry) => entry.data[clause.field] === clause.value);
    }
    if (clause.type === 'orderBy') {
      result = [...result].sort((left, right) => {
        const leftValue = left.data[clause.field];
        const rightValue = right.data[clause.field];
        if (leftValue === rightValue) return 0;
        const comparison = leftValue! > rightValue! ? 1 : -1;
        return clause.direction === 'desc' ? -comparison : comparison;
      });
    }
    if (clause.type === 'limit') {
      result = result.slice(0, clause.count);
    }
  }

  return result;
};

const getDoc = vi.fn(async (ref: Ref) => ({
  exists: () => store.has(ref.path),
  id: ref.path.split('/').at(-1) ?? '',
  data: () => store.get(ref.path),
}));

const getDocs = vi.fn(async (ref: Ref) => {
  const docs = getCollectionDocs(ref).map((entry) => ({
    id: entry.id,
    ref: entry.ref,
    exists: () => true,
    data: () => entry.data,
  }));
  return {
    empty: docs.length === 0,
    docs,
  };
});

const setDoc = vi.fn(async (ref: Ref, data: StoredValue) => {
  store.set(ref.path, data);
});

const deleteDoc = vi.fn(async (ref: Ref) => {
  store.delete(ref.path);
});

const onSnapshot = vi.fn((ref: Ref, onValue: (snap: unknown) => void) => {
  if (ref.kind === 'doc') {
    onValue({
      exists: () => store.has(ref.path),
      id: ref.path.split('/').at(-1) ?? '',
      data: () => store.get(ref.path),
    });
  } else {
    const docs = getCollectionDocs(ref).map((entry) => ({
      id: entry.id,
      ref: entry.ref,
      exists: () => true,
      data: () => entry.data,
    }));
    onValue({ empty: docs.length === 0, docs });
  }
  return vi.fn();
});

const writeBatch = vi.fn(() => {
  const operations: Array<() => void> = [];
  return {
    set: (ref: Ref, data: StoredValue) => {
      mockBatchSet(ref, data);
      operations.push(() => {
        store.set(ref.path, data);
      });
    },
    delete: (ref: Ref) => {
      mockBatchDelete(ref);
      operations.push(() => {
        store.delete(ref.path);
      });
    },
    commit: async () => {
      operations.forEach((operation) => operation());
      mockBatchCommit();
    },
  };
});

const runTransaction = vi.fn(async (_db: unknown, callback: (transaction: {
  get: typeof getDoc;
  set: typeof setDoc;
  delete: typeof deleteDoc;
}) => unknown) => callback({
  get: getDoc,
  set: setDoc,
  delete: deleteDoc,
}));

vi.mock('firebase/firestore', () => ({
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  doc,
  collection,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  runTransaction,
  writeBatch,
}));

const seed = (path: string, data: StoredValue) => {
  store.set(path, data);
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  store.clear();
  vi.stubEnv('VITE_PUBLIC_ORDER_API_URL', 'http://127.0.0.1:5001/maresia-grill-local/us-central1');
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
});

describe('storage', () => {
  describe('public orders api', () => {
    it('prepares public order checkout through the functions endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          kind: 'payment_required',
          draftId: 'draft-1',
          checkoutSession: {
            draftId: 'draft-1',
            clientSecret: 'cs_test_123',
            sessionId: 'csess_123',
            provider: 'stripe',
            availableMethods: ['card'],
          },
        }),
      });

      const { preparePublicOrderCheckout } = await import('../lib/storage');
      const result = await preparePublicOrderCheckout({
        orderId: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        customerName: 'Teste',
        selectedItems: [{ itemId: '1', quantity: 1 }],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:5001/maresia-grill-local/us-central1/preparePublicOrderCheckout',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual(expect.objectContaining({ kind: 'payment_required', draftId: 'draft-1' }));
    });

    it('surfaces backend messages from the public orders api', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Falha remota.' }),
      });

      const { preparePublicOrderCheckout } = await import('../lib/storage');
      await expect(preparePublicOrderCheckout({
        orderId: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        customerName: 'Teste',
        selectedItems: [{ itemId: '1', quantity: 1 }],
      })).rejects.toThrow('Falha remota.');
    });
  });

  describe('catalog', () => {
    it('loads categories from catalog/root/categories', async () => {
      seed('catalog/root/categories/saladas', {
        name: 'Saladas',
        sortOrder: 0,
        selectionPolicy: { maxSelections: 1, sharedLimitGroupId: null, allowRepeatedItems: false },
      });
      seed('catalog/root/categories/carnes', {
        name: 'Carnes',
        sortOrder: 1,
        selectionPolicy: { maxSelections: null, sharedLimitGroupId: null, allowRepeatedItems: false },
      });

      const { loadCategories } = await import('../lib/storage');
      await expect(loadCategories()).resolves.toEqual(['Saladas', 'Carnes']);
    });

    it('saves categories into catalog/root/categories with batch writes', async () => {
      seed('catalog/root/categories/old', {
        name: 'Antiga',
        sortOrder: 0,
        selectionPolicy: { maxSelections: null, sharedLimitGroupId: null, allowRepeatedItems: false },
      });

      const { saveCategories } = await import('../lib/storage');
      await saveCategories(['Saladas', 'Carnes']);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'catalog/root/categories/saladas' }),
        expect.objectContaining({ name: 'Saladas', sortOrder: 0 }),
      );
      expect(mockBatchDelete).toHaveBeenCalledWith(expect.objectContaining({ path: 'catalog/root/categories/old' }));
    });

    it('rejects categories that normalize to the same identifier', async () => {
      const { saveCategories } = await import('../lib/storage');

      await expect(saveCategories(['Cafe', 'Café'])).rejects.toThrow(
        'As categorias "Cafe" e "Café" geram o mesmo identificador. Ajuste os nomes para salvar.',
      );
    });

    it('loads complements from catalog/root/items', async () => {
      seed('catalog/root/categories/saladas', {
        name: 'Saladas',
        sortOrder: 0,
        selectionPolicy: { maxSelections: null, sharedLimitGroupId: null, allowRepeatedItems: false },
      });
      seed('catalog/root/items/item-1', {
        categoryId: 'saladas',
        name: 'Alface',
        priceCents: 0,
        isActive: true,
        sortOrder: 0,
      });

      const { loadComplements } = await import('../lib/storage');
      await expect(loadComplements()).resolves.toEqual([
        { id: 'item-1', nome: 'Alface', categoria: 'Saladas', priceCents: 0 },
      ]);
    });

    it('loads and saves category rules through category selection policy', async () => {
      seed('catalog/root/categories/saladas', {
        name: 'Saladas',
        sortOrder: 0,
        selectionPolicy: { maxSelections: 1, sharedLimitGroupId: null, allowRepeatedItems: false },
      });
      seed('catalog/root/categories/carnes', {
        name: 'Carnes',
        sortOrder: 1,
        selectionPolicy: { maxSelections: 2, sharedLimitGroupId: 'proteinas', allowRepeatedItems: true },
      });

      const { loadCategorySelectionRules, saveCategorySelectionRules } = await import('../lib/storage');
      await expect(loadCategorySelectionRules()).resolves.toEqual([
        { category: 'Saladas', maxSelections: 1, sharedLimitGroupId: null },
        { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas', allowRepeatedItems: true },
      ]);

      await saveCategorySelectionRules([{ category: 'Carnes', maxSelections: 3, sharedLimitGroupId: 'proteinas' }]);
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'catalog/root/categories/carnes' }),
        expect.objectContaining({
          selectionPolicy: { maxSelections: 3, sharedLimitGroupId: 'proteinas', allowRepeatedItems: false },
        }),
      );
    });

    it('saves category rules using the current admin categories when the persisted snapshot is stale', async () => {
      seed('catalog/root/categories/saladas', {
        name: 'Saladas',
        sortOrder: 0,
        selectionPolicy: { maxSelections: null, sharedLimitGroupId: null, allowRepeatedItems: false },
      });

      const { saveCategorySelectionRules } = await import('../lib/storage');
      await saveCategorySelectionRules([
        { category: 'Sobremesas', maxSelections: 1, sharedLimitGroupId: null },
      ], ['Saladas', 'Sobremesas']);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'catalog/root/categories/sobremesas' }),
        expect.objectContaining({
          name: 'Sobremesas',
          selectionPolicy: { maxSelections: 1, sharedLimitGroupId: null, allowRepeatedItems: false },
        }),
      );
    });

    it('normalizes persisted category sort order before saving rules', async () => {
      seed('catalog/root/categories/saladas', {
        name: 'Saladas',
        sortOrder: 1.8,
        selectionPolicy: { maxSelections: null, sharedLimitGroupId: null, allowRepeatedItems: false },
      });

      const { saveCategorySelectionRules } = await import('../lib/storage');
      await saveCategorySelectionRules([{ category: 'Saladas', maxSelections: 2, sharedLimitGroupId: null }], ['Saladas']);

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'catalog/root/categories/saladas' }),
        expect.objectContaining({
          sortOrder: 1,
          selectionPolicy: { maxSelections: 2, sharedLimitGroupId: null, allowRepeatedItems: false },
        }),
      );
    });
  });

  describe('daily menu and history', () => {
    it('saves and loads day selection in dailyMenus/{dateKey}', async () => {
      const { saveDaySelection, loadDaySelection } = await import('../lib/storage');
      await saveDaySelection('2026-03-17', ['1', '2']);

      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'dailyMenus/2026-03-17' }),
        expect.objectContaining({
          dateKey: '2026-03-17',
          itemIds: ['1', '2'],
          status: 'draft',
        }),
      );

      await expect(loadDaySelection('2026-03-17')).resolves.toEqual(['1', '2']);
    });

    it('loads selection history from daily menu orders', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-18T12:00:00Z'));

      seed('dailyMenus/2026-03-18/orders/order-1', {
        id: 'order-1',
        dateKey: '2026-03-18',
        shareToken: 'token-1',
        menuVersionId: '2026-03-18__v1',
        customerName: 'Ana',
        lines: [
          { itemId: '1', quantity: 2, unitPriceCents: 0, name: 'Alface', categoryId: 'saladas', categoryName: 'Saladas' },
        ],
        paymentSummary: {
          freeTotalCents: 0,
          paidTotalCents: 0,
          currency: 'BRL',
          paymentStatus: 'not_required',
          provider: null,
          paymentMethod: null,
          providerPaymentId: null,
          refundedAt: null,
        },
        submittedAt: Date.now(),
      });

      const { loadSelectionHistory } = await import('../lib/storage');
      const history = await loadSelectionHistory(1);
      expect(history[0]?.ids).toEqual(['1', '1']);

      vi.useRealTimers();
    });

    it('publishes a daily menu version and reuses the same token', async () => {
      seed('dailyMenus/2026-03-17', {
        dateKey: '2026-03-17',
        status: 'published',
        shareToken: 'token-1',
        activeVersionId: '2026-03-17__old',
        itemIds: ['1'],
        updatedAt: Date.now(),
      });

      const { getOrCreateDailyShareLink } = await import('../lib/storage');
      const result = await getOrCreateDailyShareLink({
        dateKey: '2026-03-17',
        categories: ['Saladas'],
        complements: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        daySelection: ['1'],
        categorySelectionRules: [{ category: 'Saladas', maxSelections: 1 }],
      });

      expect(result).toEqual({
        token: 'token-1',
        url: `${window.location.origin}/s/token-1`,
      });
      expect(setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'dailyMenus/2026-03-17' }),
        expect.objectContaining({
          shareToken: 'token-1',
          activeVersionId: expect.stringMatching(/^2026-03-17__/),
          status: 'published',
        }),
      );
    });
  });

  describe('editor lock', () => {
    it('acquires and renews the lock for the current session', async () => {
      const { acquireEditorLock, renewEditorLock } = await import('../lib/storage');

      const acquired = await acquireEditorLock({
        sessionId: 'session-1',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
      });
      expect(acquired?.sessionId).toBe('session-1');

      const renewed = await renewEditorLock('session-1');
      expect(renewed?.sessionId).toBe('session-1');
    });

    it('refuses to acquire the lock when another session owns it', async () => {
      seed('config/editorLock', {
        sessionId: 'session-2',
        userEmail: 'other@maresia.com',
        deviceLabel: 'iPhone',
        status: 'active',
        acquiredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        expiresAt: Date.now() + 30_000,
      });

      const { acquireEditorLock } = await import('../lib/storage');
      await expect(acquireEditorLock({
        sessionId: 'session-1',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
      })).resolves.toBeNull();
    });

    it('releases the lock atomically with a transaction', async () => {
      seed('config/editorLock', {
        sessionId: 'session-1',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
        status: 'active',
        acquiredAt: Date.now(),
        lastHeartbeatAt: Date.now(),
        expiresAt: Date.now() + 30_000,
      });

      const { releaseEditorLock } = await import('../lib/storage');
      await releaseEditorLock('session-1');
      expect(runTransaction).toHaveBeenCalled();
      expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'config/editorLock' }));
    });
  });

  describe('public menu', () => {
    beforeEach(() => {
      seed('dailyMenuTokens/token-1', {
        shareToken: 'token-1',
        dateKey: '2099-03-17',
        activeVersionId: '2099-03-17__v1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      seed('dailyMenus/2099-03-17', {
        dateKey: '2099-03-17',
        status: 'published',
        shareToken: 'token-1',
        activeVersionId: '2099-03-17__v1',
        itemIds: ['1'],
        updatedAt: Date.now(),
      });
      seed('dailyMenus/2099-03-17/versions/2099-03-17__v1', {
        id: '2099-03-17__v1',
        dateKey: '2099-03-17',
        shareToken: 'token-1',
        createdAt: Date.now(),
        categories: [{
          id: 'saladas',
          name: 'Saladas',
          sortOrder: 0,
          selectionPolicy: { maxSelections: 1, sharedLimitGroupId: null, allowRepeatedItems: false },
        }],
        items: [{
          id: '1',
          categoryId: 'saladas',
          name: 'Alface',
          priceCents: 0,
          sortOrder: 0,
        }],
      });
    });

    it('loads and subscribes to the active public menu', async () => {
      const { loadPublicMenu, subscribePublicMenu } = await import('../lib/storage');
      await expect(loadPublicMenu('token-1')).resolves.toEqual(expect.objectContaining({
        token: 'token-1',
        dateKey: '2099-03-17',
        categories: ['Saladas'],
      }));

      const onValue = vi.fn();
      subscribePublicMenu('token-1', onValue);
      expect(onValue).toHaveBeenCalledWith(expect.objectContaining({
        token: 'token-1',
        currentVersionId: '2099-03-17__v1',
      }));
    });

    it('submits and deletes a public order against the active menu', async () => {
      const { submitPublicOrder, deletePublicOrder } = await import('../lib/storage');
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            kind: 'free_order_confirmed',
            order: {
              orderId: 'order-1',
              customerName: 'Ana',
              lines: [buildOrderLine('1', 'Alface', 'Saladas')],
              paymentSummary: {
                freeTotalCents: 0,
                paidTotalCents: 0,
                currency: 'BRL',
                paymentStatus: 'not_required',
                provider: null,
                paymentMethod: null,
                providerPaymentId: null,
                refundedAt: null,
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            refunded: false,
            paymentSummary: {
              freeTotalCents: 0,
              paidTotalCents: 0,
              currency: 'BRL',
              paymentStatus: 'not_required',
              provider: null,
              paymentMethod: null,
              providerPaymentId: null,
              refundedAt: null,
            },
          }),
        });

      await expect(submitPublicOrder({
        orderId: 'order-1',
        dateKey: '2099-03-17',
        shareToken: 'token-1',
        customerName: 'Ana',
        selectedItems: [{ itemId: '1', quantity: 1 }],
      })).resolves.toEqual(expect.objectContaining({
        lines: [buildOrderLine('1', 'Alface', 'Saladas')],
      }));

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'http://127.0.0.1:5001/maresia-grill-local/us-central1/preparePublicOrderCheckout',
        expect.objectContaining({ method: 'POST' }),
      );

      await deletePublicOrder({
        orderId: 'order-1',
        dateKey: '2099-03-17',
        shareToken: 'token-1',
      });
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'http://127.0.0.1:5001/maresia-grill-local/us-central1/cancelPublicOrder',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rejects public orders when the menu is closed', async () => {
      seed('dailyMenus/2099-03-17', {
        dateKey: '2099-03-17',
        status: 'closed',
        shareToken: 'token-1',
        activeVersionId: '2099-03-17__v1',
        itemIds: ['1'],
        updatedAt: Date.now(),
      });

      const { submitPublicOrder } = await import('../lib/storage');
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Os pedidos deste cardápio foram encerrados.' }),
      });
      await expect(submitPublicOrder({
        orderId: 'order-1',
        dateKey: '2099-03-17',
        shareToken: 'token-1',
        customerName: 'Ana',
        selectedItems: [{ itemId: '1', quantity: 1 }],
      })).rejects.toThrow('Os pedidos deste cardápio foram encerrados.');
    });
  });
});
