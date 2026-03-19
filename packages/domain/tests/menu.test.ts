import { describe, expect, it, vi } from 'vitest';
import {
  buildOrder,
  buildPublishedMenuVersion,
  calculateOrderPaymentSummaryFromLines,
  createCategoryId,
  createVersionId,
  createEmptyPaymentSummary,
  expandSelectionEntriesToIds,
  hasRepeatedSelectionEntries,
  normalizePriceCents,
  normalizeSelectionEntries,
  parseDateKeyFromVersionId,
  resolveOrderLines,
  validateSelection,
} from '../src/menu.js';
import type { CatalogCategory, CatalogItem, PublishedMenuVersion, SelectionEntry } from '../src/menu.js';

const categories: CatalogCategory[] = [
  {
    id: 'salads',
    name: 'Saladas',
    sortOrder: 2,
    selectionPolicy: { allowRepeatedItems: false, maxSelections: 1, sharedLimitGroupId: null },
  },
  {
    id: 'drinks',
    name: 'Bebidas',
    sortOrder: 1,
    selectionPolicy: { allowRepeatedItems: false, maxSelections: 1, sharedLimitGroupId: 'extras' },
  },
  {
    id: 'desserts',
    name: 'Sobremesas',
    sortOrder: 1,
    selectionPolicy: { allowRepeatedItems: false, maxSelections: 1, sharedLimitGroupId: 'extras' },
  },
];

const catalogItems: CatalogItem[] = [
  { id: 'dessert-2', categoryId: 'desserts', name: 'Brigadeiro', priceCents: 1000, isActive: true, sortOrder: 4 },
  { id: 'salad-1', categoryId: 'salads', name: 'Alface', priceCents: 0, isActive: true, sortOrder: 1 },
  { id: 'drink-1', categoryId: 'drinks', name: 'Coca-Cola', priceCents: 700, isActive: true, sortOrder: 2 },
  { id: 'dessert-1', categoryId: 'desserts', name: 'Brownie', priceCents: 900.8, isActive: true, sortOrder: 3 },
  { id: 'drink-2', categoryId: 'drinks', name: 'Guarana', priceCents: 600, isActive: false, sortOrder: 5 },
];

const publishedVersion: PublishedMenuVersion = {
  id: '2026-03-19__version',
  dateKey: '2026-03-19',
  shareToken: 'share-token',
  createdAt: 123,
  categories: [
    {
      id: 'salads',
      name: 'Saladas',
      sortOrder: 1,
      selectionPolicy: { allowRepeatedItems: false, maxSelections: 1, sharedLimitGroupId: null },
    },
    {
      id: 'drinks',
      name: 'Bebidas',
      sortOrder: 2,
      selectionPolicy: { allowRepeatedItems: false, maxSelections: 1, sharedLimitGroupId: 'extras' },
    },
    {
      id: 'desserts',
      name: 'Sobremesas',
      sortOrder: 3,
      selectionPolicy: { allowRepeatedItems: false, maxSelections: 1, sharedLimitGroupId: 'extras' },
    },
  ],
  items: [
    { id: 'salad-1', categoryId: 'salads', name: 'Alface', priceCents: 0, sortOrder: 1 },
    { id: 'drink-1', categoryId: 'drinks', name: 'Coca-Cola', priceCents: 700, sortOrder: 2 },
    { id: 'dessert-1', categoryId: 'desserts', name: 'Brownie', priceCents: 900, sortOrder: 3 },
  ],
};

describe('menu domain', () => {
  it('normalizes prices into non-negative integer cents', () => {
    expect(normalizePriceCents(900.8)).toBe(901);
    expect(normalizePriceCents(-1)).toBe(0);
    expect(normalizePriceCents('900')).toBe(0);
  });

  it('aggregates valid selection entries and falls back to legacy ids when needed', () => {
    expect(normalizeSelectionEntries([
      { itemId: 'drink-1', quantity: 1.9 },
      { itemId: 'drink-1', quantity: 2 },
      { itemId: 'dessert-1', quantity: 0 },
      { itemId: '', quantity: 1 },
    ])).toEqual([
      { itemId: 'drink-1', quantity: 3 },
      { itemId: '', quantity: 1 },
    ]);

    expect(normalizeSelectionEntries(undefined, ['drink-1', 'drink-1', '', 'dessert-1'])).toEqual([
      { itemId: 'drink-1', quantity: 2 },
      { itemId: 'dessert-1', quantity: 1 },
    ]);
  });

  it('expands and detects repeated selection entries', () => {
    const selection: SelectionEntry[] = [
      { itemId: 'drink-1', quantity: 2 },
      { itemId: 'dessert-1', quantity: 1 },
    ];

    expect(expandSelectionEntriesToIds(selection)).toEqual(['drink-1', 'drink-1', 'dessert-1']);
    expect(hasRepeatedSelectionEntries(selection)).toBe(true);
    expect(hasRepeatedSelectionEntries([{ itemId: 'salad-1', quantity: 1 }])).toBe(false);
  });

  it('reports category violations when a category exceeds its selection limit', () => {
    const violations = validateSelection(
      publishedVersion.categories,
      publishedVersion.items,
      [
        { itemId: 'salad-1', quantity: 2 },
      ],
    );

    expect(violations).toEqual([
      expect.objectContaining({
        type: 'category',
        category: 'Saladas',
        maxSelections: 1,
        selectedCount: 2,
        message: 'A categoria Saladas excedeu o limite permitido.',
      }),
    ]);
  });

  it('reports shared group violations with sorted category names', () => {
    const violations = validateSelection(
      publishedVersion.categories,
      publishedVersion.items,
      [
        { itemId: 'drink-1', quantity: 1 },
        { itemId: 'dessert-1', quantity: 1 },
      ],
    );

    expect(violations).toEqual([
      expect.objectContaining({
        type: 'group',
        category: 'Bebidas',
        groupId: 'extras',
        selectedCount: 2,
        categories: ['Bebidas', 'Sobremesas'],
        message: 'Escolha ate 1 somando com Sobremesas.',
      }),
    ]);
  });

  it('returns no violations when selection respects all policies', () => {
    expect(validateSelection(
      publishedVersion.categories,
      publishedVersion.items,
      [
        { itemId: 'salad-1', quantity: 1 },
        { itemId: 'drink-1', quantity: 1 },
      ],
    )).toEqual([]);
  });

  it('builds a published menu version with active selected items ordered by sort order and name', () => {
    const version = buildPublishedMenuVersion({
      versionId: 'v1',
      dateKey: '2026-03-19',
      shareToken: 'share-token',
      categories,
      items: catalogItems,
      selectedItemIds: ['drink-1', 'drink-2', 'dessert-1', 'dessert-2', 'salad-1'],
      createdAt: 999,
    });

    expect(version.categories.map((category) => category.name)).toEqual(['Bebidas', 'Sobremesas', 'Saladas']);
    expect(version.items).toEqual([
      expect.objectContaining({ id: 'salad-1', priceCents: 0 }),
      expect.objectContaining({ id: 'drink-1', priceCents: 700 }),
      expect.objectContaining({ id: 'dessert-1', priceCents: 901 }),
      expect.objectContaining({ id: 'dessert-2', priceCents: 1000 }),
    ]);
    expect(version.items.map((item) => item.id)).not.toContain('drink-2');
  });

  it('resolves order lines and calculates free and paid totals', () => {
    const lines = resolveOrderLines(publishedVersion, [
      { itemId: 'salad-1', quantity: 2 },
      { itemId: 'drink-1', quantity: 1 },
      { itemId: 'missing', quantity: 3 },
      { itemId: 'dessert-1', quantity: 0 },
    ]);

    expect(lines).toEqual([
      {
        itemId: 'salad-1',
        quantity: 2,
        unitPriceCents: 0,
        name: 'Alface',
        categoryId: 'salads',
        categoryName: 'Saladas',
      },
      {
        itemId: 'drink-1',
        quantity: 1,
        unitPriceCents: 700,
        name: 'Coca-Cola',
        categoryId: 'drinks',
        categoryName: 'Bebidas',
      },
    ]);

    expect(calculateOrderPaymentSummaryFromLines(lines, 'awaiting_payment')).toEqual({
      freeTotalCents: 0,
      paidTotalCents: 700,
      currency: 'BRL',
      paymentStatus: 'awaiting_payment',
      provider: 'stripe',
      paymentMethod: null,
      providerPaymentId: null,
      refundedAt: null,
    });
  });

  it('creates empty summaries without forcing a payment provider', () => {
    expect(createEmptyPaymentSummary('paid', 'mercado_pago', 'pix')).toEqual({
      freeTotalCents: 0,
      paidTotalCents: 0,
      currency: 'BRL',
      paymentStatus: 'paid',
      provider: 'mercado_pago',
      paymentMethod: 'pix',
      providerPaymentId: null,
      refundedAt: null,
    });
  });

  it('builds orders trimming the customer name and preserving payment summary', () => {
    const paymentSummary = createEmptyPaymentSummary('paid', 'stripe', 'card');

    expect(buildOrder({
      id: 'order-1',
      dateKey: '2026-03-19',
      shareToken: 'share-token',
      menuVersionId: 'v1',
      customerName: '  Maria  ',
      lines: [],
      paymentSummary,
      submittedAt: 111,
    })).toEqual({
      id: 'order-1',
      dateKey: '2026-03-19',
      shareToken: 'share-token',
      menuVersionId: 'v1',
      customerName: 'Maria',
      lines: [],
      paymentSummary,
      submittedAt: 111,
      sourceDraftId: null,
    });
  });

  it('normalizes category and version identifiers', () => {
    expect(createCategoryId('Pratos À La Carte')).toBe('pratos-a-la-carte');
    expect(parseDateKeyFromVersionId('2026-03-19__abc123')).toBe('2026-03-19');
    expect(parseDateKeyFromVersionId('abc123')).toBe('');
  });

  it('creates version ids with randomUUID when crypto is available', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'uuid-123' },
    });

    expect(createVersionId('2026-03-19')).toBe('2026-03-19__uuid-123');

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('falls back to Math.random when crypto is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    expect(createVersionId('2026-03-19')).toMatch(/^2026-03-19__/);

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
    randomSpy.mockRestore();
  });
});
