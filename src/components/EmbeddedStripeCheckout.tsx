import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckoutProvider, PaymentElement, useCheckout } from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';

const getPublishableKey = () => {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : '';
};

const stripePromise = (() => {
  const key = getPublishableKey();
  return key ? loadStripe(key) : null;
})();

interface EmbeddedStripeCheckoutProps {
  clientSecret: string;
  email: string;
  onEmailChange: (value: string) => void;
  onComplete: () => void;
  onError: (message: string) => void;
}

function CheckoutForm({
  email,
  onEmailChange,
  onComplete,
  onError,
}: Omit<EmbeddedStripeCheckoutProps, 'clientSecret'>) {
  const checkoutState = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (checkoutState.type !== 'success') return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      const message = 'Informe seu e-mail para concluir o pagamento.';
      setErrorMessage(message);
      onError(message);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await checkoutState.checkout.confirm({
        redirect: 'if_required',
        email: trimmedEmail,
      });

      if (result.type === 'error') {
        const message = result.error.message || 'Não foi possível concluir o pagamento.';
        setErrorMessage(message);
        onError(message);
        return;
      }

      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível concluir o pagamento.';
      setErrorMessage(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (checkoutState.type === 'loading') {
    return (
      <div className="stripe-payment-shell flex min-h-[360px] items-center justify-center text-[14px] text-[var(--text-dim)]">
        Preparando pagamento...
      </div>
    );
  }

  if (checkoutState.type === 'error') {
    return (
      <div className="stripe-payment-shell flex min-h-[220px] items-center justify-center px-[18px] text-center text-[14px] text-[var(--danger)]">
        {checkoutState.error.message || 'Não foi possível carregar o pagamento.'}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-[14px]">
      <label className="block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
        E-mail para o pagamento
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="voce@empresa.com"
          className="neon-gold-focus mt-[8px] w-full rounded-[18px] border border-[var(--border)] bg-[rgba(255,248,232,0.05)] px-[16px] py-[14px] text-[16px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
        />
      </label>

      <div className="stripe-payment-shell">
        {!elementReady ? (
          <div className="stripe-payment-loading">Carregando métodos de pagamento...</div>
        ) : null}
        <PaymentElement
          options={{ layout: 'accordion' }}
          onReady={() => setElementReady(true)}
          onLoadError={(event) => {
            const message = event.error.message || 'Não foi possível carregar os métodos de pagamento.';
            setErrorMessage(message);
            onError(message);
          }}
        />
      </div>

      <div className="public-inline-panel flex items-center justify-between gap-[12px] px-[14px] py-[12px]">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Pagamento seguro
          </p>
          <p className="mt-[4px] text-[13px] leading-[1.5] text-[var(--text-dim)]">
            O pedido segue automaticamente assim que o Stripe confirmar o pagamento.
          </p>
          {errorMessage ? (
            <p className="mt-[8px] text-[13px] leading-[1.5] text-[var(--danger)]">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="neon-gold-fill min-h-[48px] rounded-[18px] bg-[var(--accent)] px-[18px] text-[14px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Confirmando...' : 'Pagar agora'}
        </button>
      </div>
    </form>
  );
}

export default function EmbeddedStripeCheckout({
  clientSecret,
  email,
  onEmailChange,
  onComplete,
  onError,
}: EmbeddedStripeCheckoutProps) {
  const options = useMemo(() => ({
    clientSecret,
    elementsOptions: {
      appearance: {
        variables: {
          colorPrimary: '#d7b05c',
          colorBackground: '#24271d',
          colorText: '#f5efdf',
          colorTextSecondary: 'rgba(245, 239, 223, 0.58)',
          colorDanger: '#f97373',
          borderRadius: '18px',
          spacingUnit: '5px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        rules: {
          '.Block': {
            backgroundColor: 'rgba(17, 18, 13, 0.72)',
            border: '1px solid rgba(215, 176, 92, 0.16)',
            boxShadow: 'none',
          },
          '.Input': {
            backgroundColor: 'rgba(13, 14, 10, 0.76)',
            border: '1px solid rgba(215, 176, 92, 0.16)',
            boxShadow: 'none',
          },
          '.Input:focus': {
            borderColor: 'rgba(215, 176, 92, 0.42)',
            boxShadow: '0 0 0 1px rgba(215, 176, 92, 0.2)',
          },
          '.Label': {
            color: '#f5efdf',
          },
          '.Tab': {
            backgroundColor: 'rgba(17, 18, 13, 0.7)',
            border: '1px solid rgba(215, 176, 92, 0.16)',
          },
          '.Tab--selected': {
            backgroundColor: 'rgba(215, 176, 92, 0.12)',
            borderColor: 'rgba(215, 176, 92, 0.36)',
          },
        },
      },
    },
  }), [clientSecret]);

  if (!stripePromise) {
    return (
      <div className="stripe-payment-shell flex min-h-[220px] items-center justify-center px-[18px] text-center text-[14px] text-[var(--danger)]">
        VITE_STRIPE_PUBLISHABLE_KEY não configurado.
      </div>
    );
  }

  return (
    <CheckoutProvider stripe={stripePromise} options={options} key={clientSecret}>
      <CheckoutForm
        email={email}
        onEmailChange={onEmailChange}
        onComplete={onComplete}
        onError={onError}
      />
    </CheckoutProvider>
  );
}
