import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfirmPayment = vi.fn();
const mockElementsSubmit = vi.fn();
const mockShowToast = vi.fn();
const mockPaymentElement = vi.fn();

async function buildDefaultReactStripeMock() {
  const React = await import('react');

  return {
    Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
    LinkAuthenticationElement: ({
      options,
      onChange,
    }: {
      options?: { defaultValues?: { email?: string } };
      onChange?: (event: { value: { email: string } }) => void;
    }) => {
      const [value, setValue] = React.useState(options?.defaultValues?.email ?? '');

      return (
        <input
          placeholder="voce@empresa.com"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onChange?.({ value: { email: event.target.value } });
          }}
        />
      );
    },
    PaymentElement: ({
      options,
      onReady,
      onLoadError,
    }: {
      options?: unknown;
      onReady?: () => void;
      onLoadError?: () => void;
    }) => {
      mockPaymentElement(options);
      React.useEffect(() => {
        onReady?.();
      }, [onReady]);

      return (
        <div>
          <div data-testid="payment-element">payment-element</div>
          <button type="button" onClick={() => onLoadError?.()}>
            disparar-load-error
          </button>
        </div>
      );
    },
    useStripe: () => ({
      confirmPayment: mockConfirmPayment,
    }),
    useElements: () => ({
      submit: mockElementsSubmit,
    }),
  };
}

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(async () => ({})),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

vi.mock('@stripe/react-stripe-js', buildDefaultReactStripeMock);

describe('EmbeddedStripeCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    mockElementsSubmit.mockResolvedValue({});
    mockConfirmPayment.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.resetModules();
    vi.doMock('@stripe/react-stripe-js', buildDefaultReactStripeMock);
  });

  it('renders a simplified checkout with email and payment sections', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="pi_123_secret_456"
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
        returnUrl="https://example.com/return"
      />,
    );

    expect(screen.getByPlaceholderText('voce@empresa.com')).toHaveValue('teste@empresa.com');
    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(mockPaymentElement).toHaveBeenCalledWith({
      layout: {
        type: 'accordion',
        defaultCollapsed: true,
      },
    });
  });

  it('confirms payment from the card flow', async () => {
    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');
    const onComplete = vi.fn();

    render(
      <EmbeddedStripeCheckout
        clientSecret="pi_123_secret_456"
        initialEmail="teste@empresa.com"
        onComplete={onComplete}
        returnUrl="https://example.com/return"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Pagar' }));

    await waitFor(() => {
      expect(mockElementsSubmit).toHaveBeenCalled();
      expect(mockConfirmPayment).toHaveBeenCalledWith({
        elements: expect.any(Object),
        clientSecret: 'pi_123_secret_456',
        confirmParams: { return_url: 'https://example.com/return' },
        redirect: 'if_required',
      });
    });
    expect(onComplete).toHaveBeenCalled();
  });

  it('shows a simple loading state before the payment element becomes ready', async () => {
    vi.resetModules();
    vi.doMock('@stripe/react-stripe-js', async () => {
      const React = await import('react');
      return {
        Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
        LinkAuthenticationElement: ({
          options,
          onChange,
        }: {
          options?: { defaultValues?: { email?: string } };
          onChange?: (event: { value: { email: string } }) => void;
        }) => (
          <input
            placeholder="voce@empresa.com"
            defaultValue={options?.defaultValues?.email ?? ''}
            onChange={(event) => onChange?.({ value: { email: event.target.value } })}
          />
        ),
        PaymentElement: ({ onReady }: { onReady?: () => void }) => {
          React.useEffect(() => {
            const timer = window.setTimeout(() => {
              onReady?.();
            }, 0);
            return () => window.clearTimeout(timer);
          }, [onReady]);
          return <div data-testid="payment-element">payment-element</div>;
        },
        useStripe: () => ({ confirmPayment: mockConfirmPayment }),
        useElements: () => ({ submit: mockElementsSubmit }),
      };
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="pi_123_secret_456"
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
        returnUrl="https://example.com/return"
      />,
    );

    expect(document.querySelector('.stripe-payment-loading')).toBeInTheDocument();
    expect(screen.getByText('Carregando pagamento...')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.stripe-payment-loading')).not.toBeInTheDocument();
    });
  });

  it('surfaces payment element load failures instead of waiting forever', async () => {
    vi.resetModules();
    vi.doMock('@stripe/react-stripe-js', async () => {
      return {
        Elements: ({ children }: { children: ReactNode }) => <>{children}</>,
        LinkAuthenticationElement: ({
          options,
          onChange,
        }: {
          options?: { defaultValues?: { email?: string } };
          onChange?: (event: { value: { email: string } }) => void;
        }) => (
          <input
            placeholder="voce@empresa.com"
            defaultValue={options?.defaultValues?.email ?? ''}
            onChange={(event) => onChange?.({ value: { email: event.target.value } })}
          />
        ),
        PaymentElement: ({ onLoadError }: { onLoadError?: () => void }) => (
          <div>
            <div data-testid="payment-element">payment-element</div>
            <button type="button" onClick={() => onLoadError?.()}>
              disparar-load-error
            </button>
          </div>
        ),
        useStripe: () => ({ confirmPayment: mockConfirmPayment }),
        useElements: () => ({ submit: mockElementsSubmit }),
      };
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="pi_123_secret_456"
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
        returnUrl="https://example.com/return"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'disparar-load-error' }));

    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar os meios de pagamento. Feche e tente novamente.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeDisabled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'Não foi possível carregar os meios de pagamento. Feche e tente novamente.',
      'error',
    );
    expect(document.querySelector('.stripe-payment-loading')).not.toBeInTheDocument();
  });

  it('keeps the checkout mounted when confirm returns an error', async () => {
    mockConfirmPayment.mockResolvedValue({
      error: { message: 'Pagamento recusado.' },
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="pi_123_secret_456"
        initialEmail="teste@empresa.com"
        onComplete={vi.fn()}
        returnUrl="https://example.com/return"
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Pagar' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockConfirmPayment).toHaveBeenCalled();
    });
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar' })).toBeInTheDocument();
  });

  it('surfaces submit errors from Stripe when the e-mail is missing', async () => {
    mockElementsSubmit.mockResolvedValue({
      error: { message: 'Preencha os dados necessários para continuar.' },
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="pi_123_secret_456"
        initialEmail=""
        onComplete={vi.fn()}
        returnUrl="https://example.com/return"
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Pagar' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockElementsSubmit).toHaveBeenCalled();
      expect(mockConfirmPayment).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('Preencha os dados necessários para continuar.', 'error');
    });
  });

  it('surfaces submit errors from Stripe when the e-mail format is invalid', async () => {
    mockElementsSubmit.mockResolvedValue({
      error: { message: 'Informe um e-mail válido para continuar com o pagamento.' },
    });

    const { default: EmbeddedStripeCheckout } = await import('../components/EmbeddedStripeCheckout');

    render(
      <EmbeddedStripeCheckout
        clientSecret="pi_123_secret_456"
        initialEmail="teste@empresa"
        onComplete={vi.fn()}
        returnUrl="https://example.com/return"
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Pagar' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockElementsSubmit).toHaveBeenCalled();
      expect(mockConfirmPayment).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('Informe um e-mail válido para continuar com o pagamento.', 'error');
    });
  });
});
