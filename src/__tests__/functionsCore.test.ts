import { describe, expect, it } from 'vitest';
import {
  buildReturnUrl,
  createBasePaymentSummary,
  mapPaymentMethods,
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
      buildReturnUrl('draft-1', 'token-1', '', 'https://app.maresia.com'),
    ).toBe('https://app.maresia.com/s/token-1?draftId=draft-1#/enviado');

    expect(
      buildReturnUrl('draft-1', 'token-1', 'https://app.maresia.com/s/token-1#/pedido', undefined),
    ).toBe('https://app.maresia.com/s/token-1?draftId=draft-1#/pedido');
  });

  it('maps Stripe payment method types with card fallback', () => {
    expect(mapPaymentMethods(['pix', 'card'])).toEqual(['pix', 'card']);
    expect(mapPaymentMethods(undefined)).toEqual(['card']);
  });
});
