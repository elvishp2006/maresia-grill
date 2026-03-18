import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mockConfirm = vi.fn();
const mockUseCheckout = vi.fn();

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

vi.mock('@stripe/react-stripe-js/checkout', async () => {
  const React = await import('react');

  return {
    CheckoutProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    PaymentElement: ({
      onReady,
      onLoadError,
    }: {
      onReady?: () => void;
      onLoadError?: (event: { error: { message: string } }) => void;
    }) => {
      React.useEffect(() => {
        onReady?.();
      }, [onReady]);

      return (
        <div>
          <div data-testid="payment-element">payment-element</div>
          <button type="button" onClick={() => onLoadError?.({ error: { message: 'falha de load' } })}>
            disparar-load-error
          </button>
        </div>
      );
    },
    useCheckout: () => mockUseCheckout(),
  };
});

describe('EmbeddedStripeCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockUseCheckout.mockReturnValue({
      type: 'success',
      checkout: {
        confirm: mockConfirm,
      },
    });
    mockConfirm.mockResolvedValue({
      type: 'success',
      session: {},
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the inline payment form and confirms with email', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onComplete = vi.fn();
    const onError = vi.fn();
    const onEmailChange = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        email="teste@empresa.com"
        onEmailChange={onEmailChange}
        onComplete={onComplete}
        onError={onError}
      />,
    );

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar agora' }));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith({
        redirect: 'if_required',
        email: 'teste@empresa.com',
      });
    });
    expect(onComplete).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('shows a stable skeleton area before the payment element becomes ready', async () => {
    vi.resetModules();
    vi.doMock('@stripe/react-stripe-js/checkout', async () => {
      const React = await import('react');

      return {
        CheckoutProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
        PaymentElement: ({
          onReady,
        }: {
          onReady?: () => void;
        }) => {
          React.useEffect(() => {
            const timer = window.setTimeout(() => {
              onReady?.();
            }, 0);
            return () => window.clearTimeout(timer);
          }, [onReady]);

          return <div data-testid="payment-element">payment-element</div>;
        },
        useCheckout: () => mockUseCheckout(),
      };
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        email="teste@empresa.com"
        onEmailChange={vi.fn()}
        onComplete={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(document.querySelector('.stripe-payment-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.stripe-payment-loading')).not.toBeInTheDocument();
    });
  });

  it('requires email before confirming', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onComplete = vi.fn();
    const onError = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        email=""
        onEmailChange={vi.fn()}
        onComplete={onComplete}
        onError={onError}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pagar agora' }));

    expect(mockConfirm).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Informe seu e-mail para concluir o pagamento.');
    expect(screen.getByText('Informe seu e-mail para concluir o pagamento.')).toBeInTheDocument();
  });

  it('keeps the checkout mounted when confirm returns an error', async () => {
    mockConfirm.mockResolvedValue({
      type: 'error',
      error: { message: 'Pagamento recusado.' },
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onError = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        email="teste@empresa.com"
        onEmailChange={vi.fn()}
        onComplete={vi.fn()}
        onError={onError}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pagar agora' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Pagamento recusado.');
    });
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByText('Pagamento recusado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar agora' })).toBeInTheDocument();
  });
});
