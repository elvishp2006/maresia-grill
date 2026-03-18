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
} from '../../functions/src/core';

describe('functions payment core', () => {
  it('creates a payment summary from selected items', () => {
    const summary = createBasePaymentSummary(
      [
        { id: '1', nome: 'Prato', categoria: 'Pratos', priceCents: 0 },
        { id: '2', nome: 'Refrigerante', categoria: 'Bebidas', priceCents: 700 },
      ],
      ['1', '2'],
      'awaiting_payment',
    );

    expect(summary).toEqual({
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

  it('validates category and shared group limits', () => {
    expect(() => validateSelection(
      [
        { id: '1', nome: 'Picanha', categoria: 'Carnes' },
        { id: '2', nome: 'Frango', categoria: 'Carnes' },
      ],
      ['1', '2'],
      [{ category: 'Carnes', maxSelections: 1 }],
    )).toThrow('A categoria Carnes excedeu o limite permitido.');

    expect(() => validateSelection(
      [
        { id: '1', nome: 'Coca', categoria: 'Bebidas' },
        { id: '2', nome: 'Brownie', categoria: 'Sobremesas' },
      ],
      ['1', '2'],
      [
        { category: 'Bebidas', maxSelections: 1, sharedLimitGroupId: 'extras' },
        { category: 'Sobremesas', maxSelections: 1, sharedLimitGroupId: 'extras' },
      ],
    )).toThrow('O grupo compartilhado extras excedeu o limite permitido.');
  });

  it('builds a return url with draftId and default hash', () => {
    expect(
      buildReturnUrl('draft-1', 'https://app.maresia.com/s/token-1#/enviado'),
    ).toBe('https://app.maresia.com/s/token-1?draftId=draft-1#/enviado');

    expect(
      buildReturnUrl(
        'draft-1',
        'https://app.maresia.com/s/token-1#/pedido',
        'https://app.maresia.com',
      ),
    ).toBe('https://app.maresia.com/s/token-1?draftId=draft-1#/pedido');
  });

  it('rejects return urls outside the request origin', () => {
    expect(() => buildReturnUrl(
      'draft-1',
      'https://evil.example/s/token-1#/pedido',
      'https://app.maresia.com',
    )).toThrow('URL de retorno fora da origem permitida.');
  });

  it('maps Stripe payment method types with card fallback', () => {
    expect(mapPaymentMethods(['pix', 'card'])).toEqual(['pix', 'card']);
    expect(mapPaymentMethods(undefined)).toEqual(['card']);
  });

  it('normalizes and validates customer names', () => {
    expect(normalizeCustomerName('  Maria  ')).toBe('Maria');
    expect(() => normalizeCustomerName('   ')).toThrow('Informe o nome para finalizar o pedido.');
    expect(() => normalizeCustomerName(null)).toThrow('Nome do cliente inválido.');
  });

  it('detects the winning draft for an order', () => {
    expect(isWinningOrderDraft({ sourceDraftId: 'draft-1' }, 'draft-1')).toBe(true);
    expect(isWinningOrderDraft({
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-1', 'pi_1')).toBe(true);
    expect(isWinningOrderDraft({ sourceDraftId: 'draft-2' }, 'draft-1')).toBe(false);
    expect(isWinningOrderDraft(null, 'draft-1')).toBe(false);
  });

  it('treats paid drafts from another attempt as duplicates', () => {
    expect(isDuplicatePaidDraft({
      sourceDraftId: 'draft-1',
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-2', 'pi_2')).toBe(true);

    expect(isDuplicatePaidDraft({
      sourceDraftId: 'draft-1',
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-1', 'pi_1')).toBe(false);

    expect(isDuplicatePaidDraft({
      sourceDraftId: 'draft-1',
      paymentSummary: { providerPaymentId: 'pi_1' },
    }, 'draft-2', 'pi_1')).toBe(false);
  });

  it('allows replacing an existing unpaid order with a paid draft', () => {
    expect(canReplaceExistingOrderWithPaidDraft({
      paymentSummary: {
        paidTotalCents: 0,
      },
    })).toBe(true);

    expect(canReplaceExistingOrderWithPaidDraft({
      paymentSummary: {
        paidTotalCents: 1200,
      },
    })).toBe(false);

    expect(canReplaceExistingOrderWithPaidDraft(null)).toBe(false);
  });
});
