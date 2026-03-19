import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Elements,
  LinkAuthenticationElement,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { StripeLinkAuthenticationElementChangeEvent } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '../contexts/ToastContext';

const getPublishableKey = () => {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : '';
};

interface EmbeddedStripeCheckoutProps {
  clientSecret: string;
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
  onComplete: () => void;
  returnUrl: string;
}

function CheckoutForm({
  clientSecret,
  initialEmail = '',
  onEmailChange,
  onComplete,
  returnUrl,
}: EmbeddedStripeCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [elementReady, setElementReady] = useState(false);

  const handleEmailChange = (nextEmail: string) => {
    onEmailChange?.(nextEmail);
  };

  const handleLinkChange = (event: StripeLinkAuthenticationElementChangeEvent) => {
    handleEmailChange(event.value.email ?? '');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    const pendingLabelTimer = window.setTimeout(() => {
      setSubmitting(true);
    }, 180);

    try {
      const submitResult = await elements.submit();
      if (submitResult.error) {
        showToast(submitResult.error.message || 'Confira os dados do pagamento e tente novamente.', 'error');
        return;
      }

      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      });

      if (result.error) {
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

  return (
    <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-[16px]">
      <section className="min-w-0 space-y-[8px]">
        <div className="stripe-payment-element stripe-payment-element--ready min-w-0">
          <LinkAuthenticationElement
            options={{
              defaultValues: initialEmail ? { email: initialEmail } : undefined,
            }}
            onChange={handleLinkChange}
          />
        </div>
      </section>

      <section className="min-w-0 space-y-[8px]">
        <p className="text-[12px] font-semibold text-[var(--text)]">
          Pagamento
        </p>
        <div className="stripe-payment-shell">
          {!elementReady ? (
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
          <div className={elementReady ? 'stripe-payment-element stripe-payment-element--ready min-w-0' : 'stripe-payment-element min-w-0'}>
            <PaymentElement
              options={{ layout: 'accordion' }}
              onReady={() => {
                setElementReady(true);
              }}
              onLoadError={() => {
                // O estado de erro do confirmPayment cobre falhas fatais de carregamento.
              }}
            />
          </div>
        </div>
      </section>

      <div className="px-[8px] pb-[12px] pt-[6px]">
        <button
          type="submit"
          disabled={submitting || !elementReady || !stripe || !elements}
          className="min-h-[54px] w-full rounded-[18px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_10px_22px_rgba(0,0,0,0.18)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Processando pagamento...' : 'Pagar'}
        </button>
      </div>
    </form>
  );
}

export default function EmbeddedStripeCheckout(props: EmbeddedStripeCheckoutProps) {
  const publishableKey = getPublishableKey();
  const stripePromise = useMemo(() => (
    publishableKey ? loadStripe(publishableKey) : null
  ), [publishableKey]);
  const options = useMemo(() => ({
    clientSecret: props.clientSecret,
    loader: 'auto' as const,
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
  }), [props.clientSecret]);

  if (!publishableKey || !stripePromise) {
    return (
      <div className="stripe-payment-shell flex min-h-[220px] items-center justify-center px-[18px] text-center text-[14px] text-[var(--danger)]">
        VITE_STRIPE_PUBLISHABLE_KEY não configurado.
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={options} key={props.clientSecret}>
      <CheckoutForm {...props} />
    </Elements>
  );
}
