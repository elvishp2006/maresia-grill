import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckoutProvider, PaymentElement, useCheckout } from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '../contexts/ToastContext';
import { isValidCustomerEmail, normalizeCustomerEmail } from '../lib/customerEmail';

const getPublishableKey = () => {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : '';
};

const stripePromise = (() => {
  const key = getPublishableKey();
  return key ? loadStripe(key) : null;
})();

const getStripePublishableMode = () => {
  const key = getPublishableKey();
  if (key.startsWith('pk_test_')) return 'test';
  if (key.startsWith('pk_live_')) return 'live';
  return 'unknown';
};

const getClientSecretMode = (clientSecret: string) => {
  if (clientSecret.startsWith('cs_test_')) return 'test';
  if (clientSecret.startsWith('cs_live_')) return 'live';
  return 'unknown';
};

interface EmbeddedStripeCheckoutProps {
  clientSecret: string;
  initialEmail?: string;
  onEmailChange?: (email: string) => void;
  onComplete: () => void;
}

function CheckoutForm({
  initialEmail = '',
  onEmailChange,
  onComplete,
}: Omit<EmbeddedStripeCheckoutProps, 'clientSecret'>) {
  const checkoutState = useCheckout();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [elementReady, setElementReady] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [emailTouched, setEmailTouched] = useState(false);
  const isLoading = checkoutState.type === 'loading';
  const normalizedEmail = normalizeCustomerEmail(email);
  const emailError = emailTouched && email.length > 0 && !isValidCustomerEmail(email)
    ? 'Informe um e-mail válido para continuar com o pagamento.'
    : '';

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);
    onEmailChange?.(nextEmail);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (checkoutState.type !== 'success') return;

    const pendingLabelTimer = window.setTimeout(() => {
      setSubmitting(true);
    }, 180);

    const trimmedEmail = normalizedEmail;
    if (!trimmedEmail) {
      setEmailTouched(true);
      window.clearTimeout(pendingLabelTimer);
      showToast('Preencha os dados necessários para continuar.', 'info');
      return;
    }
    if (!isValidCustomerEmail(trimmedEmail)) {
      setEmailTouched(true);
      window.clearTimeout(pendingLabelTimer);
      showToast('Informe um e-mail válido para continuar com o pagamento.', 'info');
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
      <label className="block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
        Seu e-mail
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="email"
          value={email}
          onChange={(event) => handleEmailChange(event.target.value)}
          onBlur={() => setEmailTouched(true)}
          placeholder="voce@empresa.com"
          aria-invalid={emailError ? 'true' : 'false'}
          className="neon-gold-focus mt-[8px] w-full rounded-[18px] border border-[var(--border)] bg-[var(--input-bg)] px-[16px] py-[14px] text-[16px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
        />
        {emailError ? (
          <p className="mt-[8px] text-[13px] leading-[1.5] normal-case tracking-normal text-[var(--accent-red)]">
            {emailError}
          </p>
        ) : null}
      </label>

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
  initialEmail,
  onEmailChange,
  onComplete,
}: EmbeddedStripeCheckoutProps) {
  const publishableMode = getStripePublishableMode();
  const clientSecretMode = getClientSecretMode(clientSecret);
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

  if (
    publishableMode !== 'unknown'
    && clientSecretMode !== 'unknown'
    && publishableMode !== clientSecretMode
  ) {
    return (
      <div className="stripe-payment-shell flex min-h-[220px] items-center justify-center px-[18px] text-center text-[14px] text-[var(--danger)]">
        Não foi possível carregar o pagamento agora. Tente novamente em instantes.
      </div>
    );
  }

  return (
    <CheckoutProvider stripe={stripePromise} options={options} key={clientSecret}>
      <CheckoutForm
        initialEmail={initialEmail}
        onEmailChange={onEmailChange}
        onComplete={onComplete}
      />
    </CheckoutProvider>
  );
}
