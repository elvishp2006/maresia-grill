import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentSnapshot } from 'firebase/firestore';

vi.mock('../lib/firebase', () => ({ db: {} }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }));
const mockCollection = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }));
const mockQuery = vi.fn((ref: unknown, ordering?: unknown) => {
  void ordering;
  return ref;
});
const mockOrderBy = vi.fn((field: string, direction: string) => ({ field, direction }));
const mockOnSnapshot = vi.fn();
const mockRunTransaction = vi.fn();
const mockFetch = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDoc: (ref: unknown) => mockGetDoc(ref),
  setDoc: (ref: unknown, data: unknown) => mockSetDoc(ref, data),
  deleteDoc: (ref: unknown) => mockDeleteDoc(ref),
  doc: (db: unknown, ...segments: string[]) => mockDoc(db, ...segments),
  collection: (db: unknown, ...segments: string[]) => mockCollection(db, ...segments),
  query: (ref: unknown, ordering: unknown) => mockQuery(ref, ordering),
  orderBy: (field: string, direction: string) => mockOrderBy(field, direction),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_PUBLIC_ORDER_API_URL', 'http://127.0.0.1:5001/maresia-grill-local/us-central1');
  vi.stubGlobal('fetch', mockFetch);
  mockRunTransaction.mockImplementation(async (_db: unknown, callback: (transaction: {
    get: typeof mockGetDoc;
    set: typeof mockSetDoc;
    delete: typeof mockSetDoc;
  }) => unknown) => callback({
    get: mockGetDoc,
    set: mockSetDoc,
    delete: mockSetDoc,
  }));
});

describe('storage', () => {
  describe('loadCategories', () => {
    it('returns items array when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ items: ['Saladas', 'Carnes'] }),
      } as unknown as DocumentSnapshot);

      const { loadCategories } = await import('../lib/storage');
      const result = await loadCategories();
      expect(result).toEqual(['Saladas', 'Carnes']);
    });

    it('returns empty array when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false } as unknown as DocumentSnapshot);

      const { loadCategories } = await import('../lib/storage');
      const result = await loadCategories();
      expect(result).toEqual([]);
    });
  });

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
        selectedItemIds: ['1'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:5001/maresia-grill-local/us-central1/preparePublicOrderCheckout',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(result).toEqual(expect.objectContaining({
        kind: 'payment_required',
        draftId: 'draft-1',
      }));
    });

    it('loads public order status through the functions endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          draftId: 'draft-1',
          paymentStatus: 'awaiting_payment',
        }),
      });

      const { fetchPublicOrderStatus } = await import('../lib/storage');
      const result = await fetchPublicOrderStatus({
        shareToken: 'token-1',
        draftId: 'draft-1',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:5001/maresia-grill-local/us-central1/publicOrderStatus',
        expect.any(Object),
      );
      expect(result).toEqual({
        draftId: 'draft-1',
        paymentStatus: 'awaiting_payment',
      });
    });

    it('cancels public orders through the functions endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          refunded: true,
          paymentSummary: {
            freeTotalCents: 0,
            paidTotalCents: 700,
            currency: 'BRL',
            paymentStatus: 'refund_pending',
            provider: 'stripe',
            paymentMethod: 'card',
            providerPaymentId: 'pi_123',
            refundedAt: null,
          },
        }),
      });

      const { cancelPublicOrder } = await import('../lib/storage');
      const result = await cancelPublicOrder({
        orderId: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:5001/maresia-grill-local/us-central1/cancelPublicOrder',
        expect.any(Object),
      );
      expect(result).toEqual(expect.objectContaining({
        refunded: true,
      }));
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
        selectedItemIds: ['1'],
      })).rejects.toThrow('Falha remota.');
    });
  });

  describe('saveCategories', () => {
    it('calls setDoc with correct data', async () => {
      const { saveCategories } = await import('../lib/storage');
      await saveCategories(['Saladas', 'Carnes']);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'config/categories' }),
        { items: ['Saladas', 'Carnes'] }
      );
    });
  });

  describe('loadComplements', () => {
    it('returns items when document exists', async () => {
      const items = [{ id: '1', nome: 'Alface', categoria: 'Saladas' }];
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ items }),
      } as unknown as DocumentSnapshot);

      const { loadComplements } = await import('../lib/storage');
      const result = await loadComplements();
      expect(result).toEqual(items);
    });

    it('filters malformed items from the persisted payload', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          items: [
            { id: '1', nome: 'Alface', categoria: 'Saladas' },
            { id: '2', nome: 'Sem categoria' },
            null,
          ],
        }),
      } as unknown as DocumentSnapshot);

      const { loadComplements } = await import('../lib/storage');
      const result = await loadComplements();
      expect(result).toEqual([{ id: '1', nome: 'Alface', categoria: 'Saladas' }]);
    });
  });

  describe('category selection rules', () => {
    it('loads normalized rules from config/categorySelectionRules', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          rules: [
            { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
            { category: 'Saladas', maxSelections: 1 },
            { broken: true },
          ],
        }),
      } as unknown as DocumentSnapshot);

      const { loadCategorySelectionRules } = await import('../lib/storage');
      const result = await loadCategorySelectionRules();

      expect(result).toEqual([
        { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
        { category: 'Saladas', maxSelections: 1, sharedLimitGroupId: null },
      ]);
    });

    it('saves rules to config/categorySelectionRules', async () => {
      const { saveCategorySelectionRules } = await import('../lib/storage');
      await saveCategorySelectionRules([
        { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
      ]);

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'config/categorySelectionRules' }),
        { rules: [{ category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' }] }
      );
    });
  });

  describe('saveDaySelection', () => {
    it('calls setDoc with the provided date key', async () => {
      const { saveDaySelection } = await import('../lib/storage');
      await saveDaySelection('2026-03-17', ['1', '2']);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'selections/2026-03-17' }),
        { ids: ['1', '2'] }
      );
    });
  });

  describe('loadDaySelection', () => {
    it('returns ids for today when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ ids: ['1', '2'] }),
      } as unknown as DocumentSnapshot);

      const { loadDaySelection } = await import('../lib/storage');
      const result = await loadDaySelection('2026-03-17');
      expect(result).toEqual(['1', '2']);
    });

    it('returns empty array when no document for today', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false } as unknown as DocumentSnapshot);

      const { loadDaySelection } = await import('../lib/storage');
      const result = await loadDaySelection('2026-03-17');
      expect(result).toEqual([]);
    });

    it('returns empty array when ids is malformed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ ids: null }),
      } as unknown as DocumentSnapshot);

      const { loadDaySelection } = await import('../lib/storage');
      const result = await loadDaySelection('2026-03-17');
      expect(result).toEqual([]);
    });
  });

  describe('loadSelectionHistory', () => {
    it('returns only existing historical selection documents', async () => {
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ ids: ['1', '2'] }),
        } as unknown as DocumentSnapshot)
        .mockResolvedValueOnce({ exists: () => false } as unknown as DocumentSnapshot)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ ids: ['3'] }),
        } as unknown as DocumentSnapshot);

      const { loadSelectionHistory } = await import('../lib/storage');
      const result = await loadSelectionHistory(3);

      expect(result).toHaveLength(2);
      expect(result[0]?.ids).toEqual(['1', '2']);
      expect(result[1]?.ids).toEqual(['3']);
    });

    it('normalizes malformed history ids to an empty array', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ ids: { broken: true } }),
      } as unknown as DocumentSnapshot);

      const { loadSelectionHistory } = await import('../lib/storage');
      const result = await loadSelectionHistory(1);

      expect(result).toEqual([
        expect.objectContaining({ ids: [] }),
      ]);
    });
  });

  describe('editor lock', () => {
    it('acquires the lock when the document is missing', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false } as unknown as DocumentSnapshot);
      const { acquireEditorLock } = await import('../lib/storage');

      const result = await acquireEditorLock({
        sessionId: 'session-1',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
      });

      expect(result?.sessionId).toBe('session-1');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'config/editorLock' }),
        expect.objectContaining({
          sessionId: 'session-1',
          userEmail: 'chef@maresia.com',
          deviceLabel: 'Mac',
          status: 'active',
        })
      );
    });

    it('refuses to acquire the lock when another session is still active', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          sessionId: 'session-2',
          userEmail: 'other@maresia.com',
          deviceLabel: 'iPhone',
          status: 'active',
          acquiredAt: Date.now(),
          lastHeartbeatAt: Date.now(),
          expiresAt: Date.now() + 30_000,
        }),
      } as unknown as DocumentSnapshot);

      const { acquireEditorLock } = await import('../lib/storage');
      const result = await acquireEditorLock({
        sessionId: 'session-1',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
      });

      expect(result).toBeNull();
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('takes over an expired lock', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          sessionId: 'session-2',
          userEmail: 'other@maresia.com',
          deviceLabel: 'iPhone',
          status: 'active',
          acquiredAt: Date.now() - 120_000,
          lastHeartbeatAt: Date.now() - 120_000,
          expiresAt: Date.now() - 1,
        }),
      } as unknown as DocumentSnapshot);

      const { acquireEditorLock } = await import('../lib/storage');
      const result = await acquireEditorLock({
        sessionId: 'session-1',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
      });

      expect(result?.sessionId).toBe('session-1');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('forces takeover when explicitly requested', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          sessionId: 'session-2',
          userEmail: 'other@maresia.com',
          deviceLabel: 'iPhone',
          status: 'active',
          acquiredAt: Date.now(),
          lastHeartbeatAt: Date.now(),
          expiresAt: Date.now() + 30_000,
        }),
      } as unknown as DocumentSnapshot);

      const { acquireEditorLock } = await import('../lib/storage');
      const result = await acquireEditorLock({
        sessionId: 'session-1',
        userEmail: 'chef@maresia.com',
        deviceLabel: 'Mac',
      }, { force: true });

      expect(result?.sessionId).toBe('session-1');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('renews the heartbeat for the owner session', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          sessionId: 'session-1',
          userEmail: 'chef@maresia.com',
          deviceLabel: 'Mac',
          status: 'active',
          acquiredAt: Date.now(),
          lastHeartbeatAt: Date.now(),
          expiresAt: Date.now() + 30_000,
        }),
      } as unknown as DocumentSnapshot);

      const { renewEditorLock } = await import('../lib/storage');
      const result = await renewEditorLock('session-1');

      expect(result?.sessionId).toBe('session-1');
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('releases the lock only for the owner session', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          sessionId: 'session-1',
          userEmail: 'chef@maresia.com',
          deviceLabel: 'Mac',
          status: 'active',
          acquiredAt: Date.now(),
          lastHeartbeatAt: Date.now(),
          expiresAt: Date.now() + 30_000,
        }),
      } as unknown as DocumentSnapshot);

      const { releaseEditorLock } = await import('../lib/storage');
      await releaseEditorLock('session-1');

      expect(mockSetDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'config/editorLock' }));
    });
  });

  describe('daily share links', () => {
    it('reuses the same token when a valid link already exists for the day', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          acceptingOrders: false,
        }),
      } as unknown as DocumentSnapshot);

      const { getOrCreateDailyShareLink } = await import('../lib/storage');
      const result = await getOrCreateDailyShareLink({
        dateKey: '2026-03-17',
        categories: ['Saladas'],
        complements: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        daySelection: ['1'],
        categorySelectionRules: [{ category: 'Saladas', maxSelections: 1 }],
      });

      expect(result.token).toBe('token-1');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/^publicMenuVersions\//) }),
        expect.objectContaining({
          token: 'token-1',
          dateKey: '2026-03-17',
          itemIds: ['1'],
        })
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'publicMenus/token-1' }),
        expect.objectContaining({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: false,
          currentVersionId: expect.any(String),
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [{ category: 'Saladas', maxSelections: 1, sharedLimitGroupId: null }],
        })
      );
    });

    it('creates a public menu snapshot when there is no link for the day', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false } as unknown as DocumentSnapshot);
      vi.stubGlobal('crypto', { randomUUID: () => 'token-2' });

      const { getOrCreateDailyShareLink } = await import('../lib/storage');
      const result = await getOrCreateDailyShareLink({
        dateKey: '2026-03-17',
        categories: ['Saladas', 'Carnes'],
        complements: [
          { id: '1', nome: 'Alface', categoria: 'Saladas' },
          { id: '2', nome: 'Frango', categoria: 'Carnes' },
        ],
        daySelection: ['1'],
        categorySelectionRules: [
          { category: 'Saladas', maxSelections: 1 },
          { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
        ],
      });

      expect(result.token).toBe('token-2');
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'shareLinks/2026-03-17' }),
        expect.objectContaining({
          token: 'token-2',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          createdAt: expect.any(Date),
          expiresAt: expect.any(Date),
        })
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/^publicMenuVersions\//) }),
        expect.objectContaining({
          token: 'token-2',
          dateKey: '2026-03-17',
          itemIds: ['1'],
        })
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'publicMenus/token-2' }),
        expect.objectContaining({
          token: 'token-2',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          currentVersionId: expect.any(String),
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [{ category: 'Saladas', maxSelections: 1, sharedLimitGroupId: null }],
        })
      );
    });

    it('subscribes to open order intake when there is no link document yet', async () => {
      mockOnSnapshot.mockImplementation((_ref: unknown, onValue: (snap: { exists: () => boolean }) => void) => {
        onValue({ exists: () => false });
        return vi.fn();
      });

      const { subscribeOrderIntakeStatus } = await import('../lib/storage');
      const onValue = vi.fn();

      subscribeOrderIntakeStatus('2026-03-17', onValue);

      expect(onValue).toHaveBeenCalledWith(true);
    });

    it('updates order intake status and syncs the public menu snapshot', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
          acceptingOrders: true,
        }),
      } as unknown as DocumentSnapshot);

      const { setOrderIntakeStatus } = await import('../lib/storage');
      await setOrderIntakeStatus({
        dateKey: '2026-03-17',
        categories: ['Saladas'],
        complements: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        daySelection: ['1'],
        categorySelectionRules: [{ category: 'Saladas', maxSelections: 1 }],
        acceptingOrders: false,
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'shareLinks/2026-03-17' }),
        expect.objectContaining({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: false,
        })
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'publicMenus/token-1' }),
        expect.objectContaining({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: false,
        })
      );
    });
  });

  describe('public menu', () => {
    it('returns null when the public menu is expired', async () => {
      vi.useFakeTimers();
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          currentVersionId: 'version-1',
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2026-03-17T10:01:00Z'),
        }),
      } as unknown as DocumentSnapshot);
      vi.setSystemTime(new Date('2026-03-17T10:02:00Z'));

      const { loadPublicMenu } = await import('../lib/storage');
      await expect(loadPublicMenu('token-1')).resolves.toBeNull();
      vi.useRealTimers();
    });

    it('subscribes to a valid public menu snapshot', async () => {
      mockOnSnapshot.mockImplementation((_ref: unknown, onValue: (snap: { exists: () => boolean; data: () => unknown }) => void) => {
        onValue({
          exists: () => true,
          data: () => ({
            token: 'token-1',
            dateKey: '2026-03-17',
            acceptingOrders: true,
            currentVersionId: 'version-1',
            categories: ['Saladas'],
            items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
            categorySelectionRules: [],
            createdAt: new Date('2026-03-17T10:00:00Z'),
            expiresAt: new Date('2099-03-17T23:59:59Z'),
          }),
        });
        return vi.fn();
      });

      const { subscribePublicMenu } = await import('../lib/storage');
      const onValue = vi.fn();

      subscribePublicMenu('token-1', onValue);

      expect(onValue).toHaveBeenCalledWith(expect.objectContaining({
        token: 'token-1',
        dateKey: '2026-03-17',
      }));
    });
  });

  describe('public menu sync', () => {
    it('updates the public menu snapshot when a share link already exists for the day', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
          acceptingOrders: false,
        }),
      } as unknown as DocumentSnapshot);

      const { syncPublicMenuSnapshotForDate } = await import('../lib/storage');
      await syncPublicMenuSnapshotForDate({
        dateKey: '2026-03-17',
        categories: ['Saladas', 'Carnes'],
        complements: [
          { id: '1', nome: 'Alface', categoria: 'Saladas' },
          { id: '2', nome: 'Frango', categoria: 'Carnes' },
        ],
        daySelection: ['1', '2'],
        categorySelectionRules: [
          { category: 'Saladas', maxSelections: 1 },
          { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
        ],
      });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/^publicMenuVersions\//) }),
        expect.objectContaining({
          token: 'token-1',
          dateKey: '2026-03-17',
          itemIds: ['1', '2'],
        })
      );
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'publicMenus/token-1' }),
        expect.objectContaining({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: false,
          currentVersionId: expect.any(String),
          categories: ['Saladas', 'Carnes'],
          categorySelectionRules: [
            { category: 'Saladas', maxSelections: 1, sharedLimitGroupId: null },
            { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
          ],
          items: [
            { id: '1', nome: 'Alface', categoria: 'Saladas' },
            { id: '2', nome: 'Frango', categoria: 'Carnes' },
          ],
        })
      );
    });
  });

  describe('orders', () => {
    it('stores a public order entry', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          currentVersionId: 'version-1',
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
        }),
      } as unknown as DocumentSnapshot);

      const { submitPublicOrder } = await import('../lib/storage');

      await expect(submitPublicOrder({
        orderId: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        customerName: 'Ana',
        selectedItemIds: ['1'],
      })).resolves.toEqual({ selectedItemIds: ['1'] });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'orders/2026-03-17/entries/order-1' }),
        expect.objectContaining({
          orderId: 'order-1',
          dateKey: '2026-03-17',
          shareToken: 'token-1',
          customerName: 'Ana',
          menuVersionId: 'version-1',
          selectedItemIds: ['1'],
        })
      );
    });

    it('rejects public orders when order intake is closed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: false,
          currentVersionId: 'version-1',
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
        }),
      } as unknown as DocumentSnapshot);

      const { submitPublicOrder } = await import('../lib/storage');

      await expect(submitPublicOrder({
        orderId: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        customerName: 'Ana',
        selectedItemIds: ['1'],
      })).rejects.toThrow('Os pedidos deste cardapio foram encerrados.');
    });

    it('stores only selected item ids that are still valid in the current public menu', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          currentVersionId: 'version-2',
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
        }),
      } as unknown as DocumentSnapshot);

      const { submitPublicOrder } = await import('../lib/storage');

      await expect(submitPublicOrder({
        orderId: 'order-2',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        customerName: 'Ana',
        selectedItemIds: ['1', '999'],
      })).resolves.toEqual({ selectedItemIds: ['1'] });

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'orders/2026-03-17/entries/order-2' }),
        expect.objectContaining({
          menuVersionId: 'version-2',
          selectedItemIds: ['1'],
        })
      );
    });

    it('rejects public orders when a category limit is exceeded', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          currentVersionId: 'version-2',
          categories: ['Saladas'],
          items: [
            { id: '1', nome: 'Alface', categoria: 'Saladas' },
            { id: '2', nome: 'Tomate', categoria: 'Saladas' },
          ],
          categorySelectionRules: [{ category: 'Saladas', maxSelections: 1 }],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
        }),
      } as unknown as DocumentSnapshot);

      const { submitPublicOrder } = await import('../lib/storage');

      await expect(submitPublicOrder({
        orderId: 'order-3',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        customerName: 'Ana',
        selectedItemIds: ['1', '2'],
      })).rejects.toThrow('Voce pode escolher ate 1 item(ns) em Saladas.');
    });

    it('rejects public orders when a shared group limit is exceeded', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          currentVersionId: 'version-2',
          categories: ['Churrasco', 'Carnes'],
          items: [
            { id: '1', nome: 'Picanha', categoria: 'Churrasco' },
            { id: '2', nome: 'Frango', categoria: 'Carnes' },
            { id: '3', nome: 'Linguica', categoria: 'Carnes' },
          ],
          categorySelectionRules: [
            { category: 'Churrasco', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
            { category: 'Carnes', maxSelections: 2, sharedLimitGroupId: 'proteinas' },
          ],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
        }),
      } as unknown as DocumentSnapshot);

      const { submitPublicOrder } = await import('../lib/storage');

      await expect(submitPublicOrder({
        orderId: 'order-4',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
        customerName: 'Ana',
        selectedItemIds: ['1', '2', '3'],
      })).rejects.toThrow('Voce pode escolher ate 2 item(ns) entre Churrasco e Carnes.');
    });

    it('subscribes to orders sorted by submittedAt', async () => {
      mockOnSnapshot.mockImplementation((_ref: unknown, onValue: (snap: { docs: Array<{ id: string; data: () => unknown }> }) => void) => {
        onValue({
          docs: [{
            id: 'order-1',
            data: () => ({
              orderId: 'order-1',
              dateKey: '2026-03-17',
              shareToken: 'token-1',
              customerName: 'Ana',
              selectedItemIds: ['1'],
              submittedItems: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
              submittedAt: new Date('2026-03-17T12:00:00Z'),
            }),
          }],
        });
        return vi.fn();
      });

      const { subscribeOrders } = await import('../lib/storage');
      const onValue = vi.fn();
      subscribeOrders('2026-03-17', onValue);

      expect(mockOrderBy).toHaveBeenCalledWith('submittedAt', 'desc');
      expect(onValue).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'order-1',
          customerName: 'Ana',
          submittedItems: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
        }),
      ]);
    });

    it('deletes a public order entry while order intake is open', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: true,
          currentVersionId: 'version-1',
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
        }),
      } as unknown as DocumentSnapshot);

      const { deletePublicOrder } = await import('../lib/storage');

      await expect(deletePublicOrder({
        orderId: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
      })).resolves.toBeUndefined();

      expect(mockDeleteDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'orders/2026-03-17/entries/order-1' }),
      );
    });

    it('rejects public order deletion when order intake is closed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          token: 'token-1',
          dateKey: '2026-03-17',
          acceptingOrders: false,
          currentVersionId: 'version-1',
          categories: ['Saladas'],
          items: [{ id: '1', nome: 'Alface', categoria: 'Saladas' }],
          categorySelectionRules: [],
          createdAt: new Date('2026-03-17T10:00:00Z'),
          expiresAt: new Date('2099-03-17T23:59:59Z'),
        }),
      } as unknown as DocumentSnapshot);

      const { deletePublicOrder } = await import('../lib/storage');

      await expect(deletePublicOrder({
        orderId: 'order-1',
        dateKey: '2026-03-17',
        shareToken: 'token-1',
      })).rejects.toThrow('Os pedidos deste cardapio foram encerrados.');
    });
  });
});
