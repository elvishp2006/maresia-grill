import { describe, expect, it } from 'vitest';
import {
  calculateOrderPaymentSummary,
  formatPriceInputFromCents,
  isPaidItem,
  normalizePriceCents,
  normalizePriceInputDigits,
  parsePriceInputToCents,
} from '../lib/billing';

describe('billing', () => {
  it('normalizes valid and invalid prices', () => {
    expect(normalizePriceCents(450.4)).toBe(450);
    expect(normalizePriceCents(-1)).toBeNull();
    expect(normalizePriceCents('450')).toBeNull();
  });

  it('identifies paid items by priceCents', () => {
    expect(isPaidItem({ id: '1', nome: 'Refrigerante', categoria: 'Bebidas', priceCents: 700 })).toBe(true);
    expect(isPaidItem({ id: '2', nome: 'Agua', categoria: 'Bebidas', priceCents: 0 })).toBe(false);
    expect(isPaidItem({ id: '3', nome: 'Molho', categoria: 'Extras' })).toBe(false);
  });

  it('calculates free and paid totals separately', () => {
    const summary = calculateOrderPaymentSummary(
      [
        { id: '1', nome: 'Prato', categoria: 'Pratos', priceCents: 0 },
        { id: '2', nome: 'Refrigerante', categoria: 'Bebidas', priceCents: 700 },
        { id: '3', nome: 'Brownie', categoria: 'Sobremesas', priceCents: 900 },
      ],
      ['1', '3'],
      'awaiting_payment',
      'stripe',
      'card',
    );

    expect(summary).toEqual({
      freeTotalCents: 0,
      paidTotalCents: 900,
      currency: 'BRL',
      paymentStatus: 'awaiting_payment',
      provider: 'stripe',
      paymentMethod: 'card',
      providerPaymentId: null,
      refundedAt: null,
    });
  });

  it('formats and parses masked money input', () => {
    expect(parsePriceInputToCents('1')).toBe(1);
    expect(parsePriceInputToCents('12,34')).toBe(1234);
    expect(formatPriceInputFromCents(1234)).toBe('12,34');
    expect(normalizePriceInputDigits('1234')).toBe('12,34');
    expect(formatPriceInputFromCents(null)).toBe('0,00');
  });
});
