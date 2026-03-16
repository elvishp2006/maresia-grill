import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DocumentSnapshot } from 'firebase/firestore';

vi.mock('../firebase', () => ({ db: {} }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }));

vi.mock('firebase/firestore', () => ({
  getDoc: (ref: unknown) => mockGetDoc(ref),
  setDoc: (ref: unknown, data: unknown) => mockSetDoc(ref, data),
  doc: (db: unknown, ...segments: string[]) => mockDoc(db, ...segments),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('storage', () => {
  describe('loadCategories', () => {
    it('returns items array when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ items: ['Saladas', 'Carnes'] }),
      } as unknown as DocumentSnapshot);

      const { loadCategories } = await import('../storage');
      const result = await loadCategories();
      expect(result).toEqual(['Saladas', 'Carnes']);
    });

    it('returns empty array when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false } as unknown as DocumentSnapshot);

      const { loadCategories } = await import('../storage');
      const result = await loadCategories();
      expect(result).toEqual([]);
    });
  });

  describe('saveCategories', () => {
    it('calls setDoc with correct data', async () => {
      const { saveCategories } = await import('../storage');
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

      const { loadComplements } = await import('../storage');
      const result = await loadComplements();
      expect(result).toEqual(items);
    });
  });

  describe('saveDaySelection', () => {
    it('calls setDoc with today as key', async () => {
      const { saveDaySelection } = await import('../storage');
      const today = new Date().toISOString().slice(0, 10);
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

      const { loadDaySelection } = await import('../storage');
      const result = await loadDaySelection();
      expect(result).toEqual(['1', '2']);
    });

    it('returns empty array when no document for today', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false } as unknown as DocumentSnapshot);

      const { loadDaySelection } = await import('../storage');
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

      const { loadSelectionHistory } = await import('../storage');
      const result = await loadSelectionHistory(3);

      expect(result).toHaveLength(2);
      expect(result[0]?.ids).toEqual(['1', '2']);
      expect(result[1]?.ids).toEqual(['3']);
    });
  });
});
