import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentSnapshot } from 'firebase/firestore';

vi.mock('../lib/firebase', () => ({ db: {} }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }));
const mockOnSnapshot = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('firebase/firestore', () => ({
  getDoc: (ref: unknown) => mockGetDoc(ref),
  setDoc: (ref: unknown, data: unknown) => mockSetDoc(ref, data),
  doc: (db: unknown, ...segments: string[]) => mockDoc(db, ...segments),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
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

  describe('saveDaySelection', () => {
    it('calls setDoc with today as key', async () => {
      const { saveDaySelection } = await import('../lib/storage');
      const now = new Date();
      const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-');
      await saveDaySelection(['1', '2']);
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `selections/${today}` }),
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
      const result = await loadDaySelection();
      expect(result).toEqual(['1', '2']);
    });

    it('returns empty array when no document for today', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false } as unknown as DocumentSnapshot);

      const { loadDaySelection } = await import('../lib/storage');
      const result = await loadDaySelection();
      expect(result).toEqual([]);
    });

    it('returns empty array when ids is malformed', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ ids: null }),
      } as unknown as DocumentSnapshot);

      const { loadDaySelection } = await import('../lib/storage');
      const result = await loadDaySelection();
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
});
