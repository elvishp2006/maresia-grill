import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mockConfirm = vi.fn();
const mockUpdateEmail = vi.fn();
const mockUseCheckout = vi.fn();
const mockShowToast = vi.fn();
let mockAvailablePaymentMethods = {
  applePay: true,
  googlePay: false,
  link: true,
  paypal: false,
  amazonPay: false,
  klarna: false,
};
let mockExpressBehavior: 'methods' | 'undefined' | 'silent' | 'load_error' = 'methods';
let mockExpressConfirmEvent: { paymentFailed: ReturnType<typeof vi.fn>; expressPaymentType: 'apple_pay' } | null = null;

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
    ExpressCheckoutElement: ({
      onReady,
      onConfirm,
      onLoadError,
    }: {
      onReady?: (event: { availablePaymentMethods?: typeof mockAvailablePaymentMethods }) => void;
      onConfirm?: (event: { paymentFailed: ReturnType<typeof vi.fn>; expressPaymentType: 'apple_pay' }) => void;
      onLoadError?: (event: { error: { message: string } }) => void;
    }) => {
      React.useEffect(() => {
        if (mockExpressBehavior === 'methods') {
          onReady?.({ availablePaymentMethods: mockAvailablePaymentMethods });
          return;
        }
        if (mockExpressBehavior === 'undefined') {
          onReady?.({ availablePaymentMethods: undefined });
          return;
        }
        if (mockExpressBehavior === 'load_error') {
          onLoadError?.({ error: { message: 'falha express checkout' } });
        }
      }, []);

      return (
        <div>
          <div data-testid="express-checkout-element">express-checkout-element</div>
          <button
            type="button"
            onClick={() => {
              const event = { paymentFailed: vi.fn(), expressPaymentType: 'apple_pay' as const };
              mockExpressConfirmEvent = event;
              onConfirm?.(event);
            }}
          >
            disparar-express-confirm
          </button>
        </div>
      );
    },
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
    mockAvailablePaymentMethods = {
      applePay: true,
      googlePay: false,
      link: true,
      paypal: false,
      amazonPay: false,
      klarna: false,
    };
    mockExpressBehavior = 'methods';
    mockExpressConfirmEvent = null;
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
    vi.useRealTimers();
  });

  it('renders the payment-method selection first and opens the card form on demand', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onComplete = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        initialEmail="teste@empresa.com"
        onComplete={onComplete}
      />,
    );

    expect(await screen.findByText('Escolha como pagar')).toBeInTheDocument();
    expect(screen.getByText('Disponível agora: Apple Pay, Link.')).toBeInTheDocument();
    expect(screen.getByTestId('express-checkout-element')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }));

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('voce@empresa.com')).toHaveValue('teste@empresa.com');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para os meios de pagamento' }));
    expect(await screen.findByText('Escolha como pagar')).toBeInTheDocument();
  });

  it('confirms payment from the card flow', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onComplete = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        initialEmail="teste@empresa.com"
        onComplete={onComplete}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cartão de crédito' }));
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

  it('confirms payment from the express checkout flow', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onComplete = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        initialEmail="teste@empresa.com"
        onComplete={onComplete}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'disparar-express-confirm' }));

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith({
        redirect: 'if_required',
        expressCheckoutConfirmEvent: expect.objectContaining({
          expressPaymentType: 'apple_pay',
        }),
      });
    });
    expect(mockUpdateEmail).not.toHaveBeenCalled();
    expect(mockExpressConfirmEvent?.paymentFailed).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows the unavailable-wallet message when Stripe reports no compatible wallets', async () => {
    mockExpressBehavior = 'undefined';

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
      />,
    );

    expect(await screen.findByText('Nenhuma carteira compatível disponível neste dispositivo.')).toBeInTheDocument();
    expect(screen.queryByTestId('express-checkout-element')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cartão de crédito' })).toBeInTheDocument();
  });

  it('falls back to the unavailable-wallet message when express checkout fails to load', async () => {
    mockExpressBehavior = 'load_error';

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
      />,
    );

    expect(await screen.findByText('Nenhuma carteira compatível disponível neste dispositivo.')).toBeInTheDocument();
    expect(screen.queryByTestId('express-checkout-element')).not.toBeInTheDocument();
  });

  it('falls back after a timeout when express checkout never reports availability', async () => {
    vi.useFakeTimers();
    mockExpressBehavior = 'silent';

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText('Verificando carteiras compatíveis...')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText('Nenhuma carteira compatível disponível neste dispositivo.')).toBeInTheDocument();
    expect(screen.queryByTestId('express-checkout-element')).not.toBeInTheDocument();
  });

  it('shows a stable skeleton area before the payment element becomes ready', async () => {
    vi.resetModules();
    vi.doMock('@stripe/react-stripe-js/checkout', async () => {
      const React = await import('react');

      return {
        CheckoutProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
        ExpressCheckoutElement: ({
          onReady,
        }: {
          onReady?: (event: { availablePaymentMethods?: typeof mockAvailablePaymentMethods }) => void;
        }) => {
          React.useEffect(() => {
            onReady?.({ availablePaymentMethods: mockAvailablePaymentMethods });
          }, []);

          return <div data-testid="express-checkout-element">express-checkout-element</div>;
        },
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
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cartão de crédito' }));
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
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cartão de crédito' }));
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
        initialEmail=""
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cartão de crédito' }));
    const submitButton = screen.getByRole('button', { name: 'Pagar' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    fireEvent.click(submitButton);

    expect(mockUpdateEmail).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Preencha os dados necessários para continuar.', 'info');
  });

  it('blocks payment submission when the e-mail format is invalid', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="cs_test_123"
        initialEmail="teste@empresa"
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cartão de crédito' }));
    const submitButton = screen.getByRole('button', { name: 'Pagar' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    fireEvent.click(submitButton);

    expect(mockUpdateEmail).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Informe um e-mail válido para continuar com o pagamento.', 'info');
  });
});
