import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrdersPanel from '../components/OrdersPanel';

vi.mock('../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({
    mediumTap: vi.fn(),
  }),
}));

describe('OrdersPanel', () => {
  it('prefers submittedItems over menu version resolution', () => {
    render(
      <OrdersPanel
        orders={[{
          id: 'entry-1',
          dateKey: '2026-03-18',
          shareToken: 'token-1',
          orderId: 'order-1',
          customerName: 'Ana',
          menuVersionId: 'version-1',
          lines: [
            {
              itemId: 'free-1',
              quantity: 1,
              unitPriceCents: 0,
              name: 'Arroz',
              categoryId: 'Acompanhamentos',
              categoryName: 'Acompanhamentos',
            },
            {
              itemId: 'paid-1',
              quantity: 1,
              unitPriceCents: 700,
              name: 'Refrigerante',
              categoryId: 'Bebidas',
              categoryName: 'Bebidas',
            },
          ],
          submittedItems: [
            { id: 'free-1', nome: 'Arroz', categoria: 'Acompanhamentos' },
            { id: 'paid-1', nome: 'Refrigerante', categoria: 'Bebidas', priceCents: 700 },
          ],
          paymentSummary: {
            freeTotalCents: 0,
            paidTotalCents: 700,
            currency: 'BRL',
            paymentStatus: 'paid',
            provider: 'stripe',
            paymentMethod: 'card',
            providerPaymentId: 'pi_1',
            refundedAt: null,
          },
          submittedAt: new Date('2026-03-18T12:00:00Z').getTime(),
        }]}
        categories={['Acompanhamentos', 'Bebidas']}
        menuVersions={{
          'version-1': {
            id: 'version-1',
            token: 'token-1',
            dateKey: '2026-03-18',
            categories: ['Acompanhamentos'],
            itemIds: ['free-1'],
            items: [{ id: 'free-1', nome: 'Arroz', categoria: 'Acompanhamentos' }],
            categorySelectionRules: [],
            createdAt: new Date('2026-03-18T11:00:00Z').getTime(),
          },
        }}
        acceptingOrders
        intakePending={false}
        canManageIntake
        onToggleIntake={vi.fn()}
        loading={false}
        error={false}
      />,
    );

    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('Refrigerante')).toBeInTheDocument();
  });
});
