import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mockConfirm = vi.fn();
const mockUpdateEmail = vi.fn();
const mockUseCheckout = vi.fn();
const mockShowToast = vi.fn();

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
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
        updateEmail: mockUpdateEmail,
      },
    });
    mockUpdateEmail.mockResolvedValue({
      type: 'success',
      session: {},
    });
    mockConfirm.mockResolvedValue({
      type: 'success',
      session: {},
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the inline payment form and confirms payment', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onComplete = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        email="teste@empresa.com"
        onComplete={onComplete}
      />,
    );

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pagar' }));

    await waitFor(() => {
      expect(mockUpdateEmail).toHaveBeenCalledWith('teste@empresa.com');
      expect(mockConfirm).toHaveBeenCalledWith({
        redirect: 'if_required',
        email: 'teste@empresa.com',
      });
    });
    expect(onComplete).toHaveBeenCalled();
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
        onComplete={vi.fn()}
      />,
    );

    expect(document.querySelector('.stripe-payment-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.stripe-payment-loading')).not.toBeInTheDocument();
    });
  });

  it('keeps the checkout mounted when confirm returns an error', async () => {
    mockConfirm.mockResolvedValue({
      type: 'error',
      error: { message: 'Pagamento recusado.' },
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        email="teste@empresa.com"
        onComplete={vi.fn()}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Pagar' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockUpdateEmail).toHaveBeenCalledWith('teste@empresa.com');
      expect(mockConfirm).toHaveBeenCalledWith({
        redirect: 'if_required',
        email: 'teste@empresa.com',
      });
    });
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument();
  });

  it('shows a generic toast when the e-mail is missing', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        email=""
        onComplete={vi.fn()}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Pagar' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    fireEvent.click(submitButton);

    expect(mockUpdateEmail).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Preencha os dados necessários para continuar.', 'info');
  });
});
