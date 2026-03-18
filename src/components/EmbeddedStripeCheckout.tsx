import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckoutProvider, PaymentElement, useCheckout } from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '../contexts/ToastContext';

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
  onComplete: () => void;
}

function CheckoutForm({
  email,
  onComplete,
}: Omit<EmbeddedStripeCheckoutProps, 'clientSecret'>) {
  const checkoutState = useCheckout();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const isLoading = checkoutState.type === 'loading';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (checkoutState.type !== 'success') return;

    const pendingLabelTimer = window.setTimeout(() => {
      setSubmitting(true);
    }, 180);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      window.clearTimeout(pendingLabelTimer);
      showToast('Preencha os dados necessários para continuar.', 'info');
      return;
    }

    try {
      const emailResult = await checkoutState.checkout.updateEmail(trimmedEmail);
      if (emailResult.type === 'error') {
        showToast('Confira os dados do pagamento e tente novamente.', 'error');
        return;
      }

      const result = await checkoutState.checkout.confirm({
        redirect: 'if_required',
        email: trimmedEmail,
      });

      if (result.type === 'error') {
        showToast('Confira os dados do pagamento e tente novamente.', 'error');
        return;
      }

      onComplete();
    } catch {
      showToast('Não foi possível iniciar o pagamento. Tente novamente.', 'error');
    } finally {
      window.clearTimeout(pendingLabelTimer);
      setSubmitting(false);
    }
  };

  if (checkoutState.type === 'error') {
    return (
      <div className="stripe-payment-shell flex min-h-[220px] items-center justify-center px-[18px] text-center text-[14px] text-[var(--danger)]">
        {checkoutState.error.message || 'Não foi possível carregar o pagamento.'}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-[14px]">
      <div className="stripe-payment-shell stripe-payment-frame">
        {!elementReady || isLoading ? (
          <div className="stripe-payment-loading" aria-hidden="true">
            <div className="stripe-payment-skeleton">
              <div className="stripe-payment-skeleton__line stripe-payment-skeleton__line--short" />
              <div className="stripe-payment-skeleton__line stripe-payment-skeleton__line--medium" />
              <div className="stripe-payment-skeleton__block" />
              <div className="stripe-payment-skeleton__line stripe-payment-skeleton__line--full" />
              <div className="stripe-payment-skeleton__line stripe-payment-skeleton__line--short" />
              <div className="stripe-payment-skeleton__button" />
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <div className="stripe-payment-element" aria-hidden="true" />
        ) : (
          <div className={elementReady ? 'stripe-payment-element stripe-payment-element--ready' : 'stripe-payment-element'}>
            <PaymentElement
              options={{ layout: 'accordion' }}
              onReady={() => {
                setElementReady(true);
              }}
              onLoadError={() => {
                // O estado de erro do checkout cobre falhas fatais de carregamento.
              }}
            />
          </div>
        )}
      </div>

      <div className="public-inline-panel px-[12px] py-[12px]">
        <button
          type="submit"
          disabled={submitting || isLoading || !elementReady}
          className="neon-gold-fill min-h-[52px] w-full rounded-[18px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Processando pagamento...' : 'Pagar'}
        </button>
      </div>
    </form>
  );
}

export default function EmbeddedStripeCheckout({
  clientSecret,
  email,
  onComplete,
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
        onComplete={onComplete}
      />
    </CheckoutProvider>
  );
}
