import { describe, expect, it } from 'vitest';
import {
  buildReturnUrl,
  canReplaceExistingOrderWithPaidDraft,
  createBasePaymentSummary,
  isDuplicatePaidDraft,
  isWinningOrderDraft,
  mapPaymentMethods,
  normalizeCustomerName,
  validateSelection,
  validateSelectionForVersion,
} from '../src/core.js';
import type { PublishedMenuVersion } from '../../../packages/domain/src/menu.js';

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

describe('functions core', () => {
  it('normalizes valid customer names and rejects invalid ones', () => {
    expect(normalizeCustomerName('  Maria  ')).toBe('Maria');
    expect(() => normalizeCustomerName('   ')).toThrow('Informe o nome para finalizar o pedido.');
    expect(() => normalizeCustomerName(null)).toThrow('Nome do cliente inválido.');
  });

  it('creates a payment summary from a published version using selection entries', () => {
    expect(createBasePaymentSummary(
      publishedVersion,
      [
        { itemId: 'salad-1', quantity: 1 },
        { itemId: 'drink-1', quantity: 2 },
      ],
      'awaiting_payment',
    )).toEqual({
      freeTotalCents: 0,
      paidTotalCents: 1400,
      currency: 'BRL',
      paymentStatus: 'awaiting_payment',
      provider: 'stripe',
      paymentMethod: null,
      providerPaymentId: null,
      refundedAt: null,
    });
  });

  it('creates a payment summary from inline items using legacy selected ids', () => {
    expect(createBasePaymentSummary(
      [
        { id: 'drink-1', nome: 'Coca-Cola', categoria: 'Bebidas', priceCents: 700 },
        { id: 'dessert-1', nome: 'Brownie', categoria: 'Sobremesas', priceCents: null },
      ],
      ['drink-1', 'drink-1', 'dessert-1'],
      'awaiting_payment',
    )).toEqual({
      freeTotalCents: 0,
      paidTotalCents: 1400,
      currency: 'BRL',
      paymentStatus: 'awaiting_payment',
      provider: 'stripe',
      paymentMethod: null,
      providerPaymentId: null,
      refundedAt: null,
    });
  });

  it('validates selections against a published version', () => {
    expect(() => validateSelectionForVersion(publishedVersion, ['salad-1'])).not.toThrow();
    expect(() => validateSelectionForVersion(publishedVersion, ['drink-1', 'dessert-1']))
      .toThrow('Escolha ate 1 somando com Sobremesas.');
  });

  it('validates category and shared group limits with legacy function rules', () => {
    expect(() => validateSelection(
      [
        { id: 'salad-1', nome: 'Alface', categoria: 'Saladas' },
        { id: 'salad-2', nome: 'Tomate', categoria: 'Saladas' },
      ],
      ['salad-1', 'salad-2'],
      [{ category: 'Saladas', maxSelections: 1 }],
    )).toThrow('A categoria Saladas excedeu o limite permitido.');

    expect(() => validateSelection(
      [
        { id: 'drink-1', nome: 'Coca-Cola', categoria: 'Bebidas' },
        { id: 'dessert-1', nome: 'Brownie', categoria: 'Sobremesas' },
      ],
      ['drink-1', 'dessert-1'],
      [
        { category: 'Bebidas', maxSelections: 1, sharedLimitGroupId: 'extras' },
        { category: 'Sobremesas', maxSelections: 1, sharedLimitGroupId: 'extras' },
      ],
    )).toThrow('O grupo compartilhado extras excedeu o limite permitido.');

    expect(() => validateSelection(
      [{ id: 'salad-1', nome: 'Alface', categoria: 'Saladas' }],
      [],
      [{ category: 'Saladas', minSelections: 1 }],
    )).toThrow('A categoria Saladas requer pelo menos 1 item(s).');

    expect(() => validateSelection(
      [
        { id: 'drink-1', nome: 'Coca-Cola', categoria: 'Bebidas' },
        { id: 'dessert-1', nome: 'Brownie', categoria: 'Sobremesas' },
      ],
      [],
      [
        { category: 'Bebidas', minSelections: 2, sharedLimitGroupId: 'extras' },
        { category: 'Sobremesas', minSelections: 2, sharedLimitGroupId: 'extras' },
      ],
    )).toThrow('O grupo compartilhado extras requer pelo menos 2 item(s).');
  });

  it('correctly counts group totals for min-only shared group rules (no maxSelections)', () => {
    // With the pre-pass fix, groupedCounts is populated regardless of whether maxSelections is set.
    // Before the fix, 1 item in Bebidas would not be counted for the group because the
    // groupedCounts map was only populated inside the maxSelections loop.
    expect(() => validateSelection(
      [
        { id: 'drink-1', nome: 'Coca-Cola', categoria: 'Bebidas' },
        { id: 'dessert-1', nome: 'Brownie', categoria: 'Sobremesas' },
      ],
      [{ itemId: 'drink-1', quantity: 1 }],
      [
        { category: 'Bebidas', minSelections: 1, sharedLimitGroupId: 'extras' },
        { category: 'Sobremesas', minSelections: 1, sharedLimitGroupId: 'extras' },
      ],
    )).not.toThrow();

    expect(() => validateSelection(
      [
        { id: 'drink-1', nome: 'Coca-Cola', categoria: 'Bebidas' },
        { id: 'dessert-1', nome: 'Brownie', categoria: 'Sobremesas' },
      ],
      [],
      [
        { category: 'Bebidas', minSelections: 1, sharedLimitGroupId: 'extras' },
        { category: 'Sobremesas', minSelections: 1, sharedLimitGroupId: 'extras' },
      ],
    )).toThrow('O grupo compartilhado extras requer pelo menos 1 item(s).');
  });

  it('builds return urls with draftId, hash fallback and origin validation', () => {
    expect(buildReturnUrl(
      'draft-1',
      ' https://app.maresia.com/s/token-1?from=checkout ',
      'https://app.maresia.com/',
    )).toBe('https://app.maresia.com/s/token-1?from=checkout&draftId=draft-1#/enviado');

    expect(() => buildReturnUrl(
      'draft-1',
      'https://evil.example/s/token-1#/pedido',
      'https://app.maresia.com',
    )).toThrow('URL de retorno fora da origem permitida.');

    expect(() => buildReturnUrl('draft-1', '   ')).toThrow('URL de retorno inválida.');

    expect(buildReturnUrl(
      'draft-1',
      'https://app.maresia.com/s/token-1#/pedido',
      '   ',
    )).toBe('https://app.maresia.com/s/token-1?draftId=draft-1#/pedido');
  });

  it('maps supported payment methods and falls back to card', () => {
    expect(mapPaymentMethods(['pix', 'card', 'pix', 'boleto'])).toEqual(['pix', 'card']);
    expect(mapPaymentMethods([])).toEqual(['card']);
  });

  it('detects winning and duplicate drafts correctly', () => {
    expect(isWinningOrderDraft({ sourceDraftId: 'draft-1' }, 'draft-1')).toBe(true);
    expect(isWinningOrderDraft({
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-2', 'pi_1')).toBe(true);
    expect(isWinningOrderDraft({ sourceDraftId: 'draft-2' }, 'draft-1', 'pi_1')).toBe(false);
    expect(isWinningOrderDraft({ paymentSummary: { providerPaymentId: 'pi_1' } }, 'draft-2')).toBe(false);

    expect(isDuplicatePaidDraft({
      sourceDraftId: 'draft-1',
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-2', 'pi_2')).toBe(true);
    expect(isDuplicatePaidDraft(null, 'draft-2', 'pi_2')).toBe(false);
    expect(isDuplicatePaidDraft({
      sourceDraftId: 'draft-1',
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-1', 'pi_2')).toBe(false);
    expect(isDuplicatePaidDraft({
      sourceDraftId: 'draft-1',
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-2', 'pi_1')).toBe(false);
  });

  it('only allows replacing unpaid existing orders', () => {
    expect(canReplaceExistingOrderWithPaidDraft({
      paymentSummary: { paidTotalCents: 0 },
    })).toBe(true);
    expect(canReplaceExistingOrderWithPaidDraft({
      paymentSummary: {},
    })).toBe(true);
    expect(canReplaceExistingOrderWithPaidDraft({
      paymentSummary: { paidTotalCents: 1500 },
    })).toBe(false);
    expect(canReplaceExistingOrderWithPaidDraft(null)).toBe(false);
  });
});
