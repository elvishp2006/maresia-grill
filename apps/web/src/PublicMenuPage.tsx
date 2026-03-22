import type { ReactNode } from 'react';
import type { OrderPaymentSummary } from './types';
import EmbeddedStripeCheckout from './components/EmbeddedStripeCheckout';
import BottomSheet from './components/BottomSheet';
import LoadingSpinner from './components/LoadingSpinner';
import PublicItemRow from './components/PublicItemRow';
import {
  buildStripeReturnUrl,
  countSelectedUnits,
  usePublicMenuPage,
} from './hooks/usePublicMenuPage';
import type {
  CachedPublicOrder,
  CancelledPublicOrderState,
  PendingPublicPaymentState,
} from './hooks/usePublicMenuPage';
import {
  describeCategorySelectionRule,
} from './lib/categorySelectionRules';
import { formatCurrency } from './lib/billing';
import { groupOrderItemsByCategory } from './lib/utils';

interface PublicMenuPageProps {
  token: string;
}

interface PublicStateCardProps {
  icon?: ReactNode;
  title: string;
  body: string;
  summary?: ReactNode;
  accent?: 'gold' | 'red' | 'green';
}

function PublicHeader() {
  return (
    <section className="public-topbar">
      <div className="public-content">
        <div className="public-brand-lockup">
          <img
            src="/brand/menu-mark.svg"
            alt="Logo do Maresia Grill"
            className="public-brand-lockup__logo"
          />
        </div>
      </div>
    </section>
  );
}

function PublicStateCard({ icon, title, body, summary, accent = 'gold' }: PublicStateCardProps) {
  const iconTone = accent === 'red'
    ? 'border-[rgba(208,109,86,0.32)] bg-[rgba(208,109,86,0.08)] text-[var(--accent-red)] shadow-[0_0_18px_rgba(208,109,86,0.18)]'
    : accent === 'green'
      ? 'border-[rgba(79,160,109,0.36)] bg-[rgba(79,160,109,0.12)] text-[var(--green)] shadow-[0_0_20px_rgba(79,160,109,0.24)]'
      : 'border-[var(--border-strong)] bg-[rgba(215,176,92,0.09)] text-[var(--accent)] shadow-[0_0_18px_rgba(215,176,92,0.18)]';

  return (
    <section className={`public-panel px-[18px] py-[20px] ${icon ? 'text-center' : ''}`}>
      {icon ? (
        <div className={`mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border ${iconTone}`}>
          {icon}
        </div>
      ) : null}
      <h2 className={`${icon ? 'mt-[18px]' : ''} text-[24px] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--text)] md:text-[28px]`}>
        {title}
      </h2>
      <p className="mt-[12px] text-[14px] leading-[1.65] text-[var(--text-dim)]">
        {body}
      </p>
      {summary ? (
        <div className="public-inline-panel mt-[18px] px-[16px] py-[14px] text-left">
          {summary}
        </div>
      ) : null}
    </section>
  );
}

function PublicOrderSummary({
  paidTotalCents,
  categories,
  selectedItems,
}: {
  paidTotalCents: number;
  categories: string[];
  selectedItems: Array<{ id: string; nome: string; categoria: string; quantity?: number }>;
}) {
  const groupedItems = groupOrderItemsByCategory(
    selectedItems.map(item => ({
      id: item.id,
      nome: item.nome,
      categoria: item.categoria,
      quantity: item.quantity,
    })),
    categories,
  );

  return (
    <>
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] py-[10px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
          Total pago
        </p>
        <p className="mt-[4px] text-[14px] font-semibold text-[var(--accent)]">
          {formatCurrency(paidTotalCents)}
        </p>
      </div>
      <div className="mt-[12px] flex items-center justify-between gap-[10px] text-[12px] text-[var(--text-dim)]">
        <span>Itens escolhidos</span>
        <span>{countSelectedUnits(selectedItems.map(item => ({ itemId: item.id, quantity: item.quantity ?? 1 })))} selecionados</span>
      </div>
      {groupedItems.length > 0 ? (
        <div className="mt-[10px] space-y-[10px]">
          {groupedItems.map(group => (
            <div
              key={group.category}
              className="rounded-[16px] border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-[12px] py-[10px]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {group.category}
              </p>
              <ul className="mt-[8px] space-y-[6px] text-[13px] leading-[1.55] text-[var(--text)]">
                {group.names.map(name => (
                  <li key={`${group.category}-${name}`}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function PublicActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="public-action-bar px-0 pt-[10px] pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-[880px] px-[4px] sm:px-[6px]">
        {children}
      </div>
    </div>
  );
}

function PublicCancelledView({
  cancelledState,
  canStartNewOrder,
  onNewOrder,
}: {
  cancelledState: CancelledPublicOrderState;
  canStartNewOrder: boolean;
  onNewOrder: () => void;
}) {
  return (
    <main className="public-shell flex flex-col">
      <PublicHeader />
      <div className="public-content">
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          )}
          accent="red"
          title="Seu pedido foi cancelado"
          body={
            canStartNewOrder
              ? `${cancelledState.customerName}, você ainda pode montar um novo pedido neste cardápio.`
              : `${cancelledState.customerName}, a confirmação do cancelamento foi preservada neste link.`
          }
        />
      </div>
      {canStartNewOrder ? (
        <div className="public-content mt-[16px]">
          <button
            type="button"
            onClick={onNewOrder}
            className="neon-gold-fill min-h-[54px] w-full rounded-[20px] bg-[var(--accent)] px-[18px] text-[14px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
          >
            Fazer novo pedido
          </button>
        </div>
      ) : null}
    </main>
  );
}

function PublicSuccessView({
  successState,
  canModifyExistingOrder,
  isMenuExpired,
  submitting,
  categories,
  onCancelOrder,
}: {
  successState: CachedPublicOrder;
  canModifyExistingOrder: boolean;
  isMenuExpired: boolean;
  submitting: boolean;
  categories: string[];
  onCancelOrder: () => void;
}) {
  return (
    <main className="public-shell flex flex-col">
      <PublicHeader />
      <div className="public-content">
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
          accent="green"
          title="Seu pedido foi enviado"
          body={
            canModifyExistingOrder
              ? 'Se precisar alterar algo, cancele este pedido e faça um novo.'
              : isMenuExpired
                ? 'A confirmação foi preservada, mas este cardápio não está mais disponível.'
                : 'A confirmação foi preservada, mas os pedidos já foram encerrados.'
          }
          summary={(
            <>
              {successState.observation ? (
                <div className="mb-[10px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[14px] py-[12px]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">Observação</p>
                  <p className="mt-[6px] text-[13px] leading-[1.5] text-[var(--text)]">{successState.observation}</p>
                </div>
              ) : null}
              <PublicOrderSummary
                paidTotalCents={successState.paymentSummary.paidTotalCents}
                categories={categories}
                selectedItems={successState.lines.map(line => ({
                  id: line.itemId,
                  nome: line.name,
                  categoria: line.categoryName,
                  quantity: line.quantity,
                }))}
              />
            </>
          )}
        />
      </div>
      {canModifyExistingOrder ? (
        <div className="public-content mt-[16px]">
          <button
            type="button"
            onClick={onCancelOrder}
            disabled={submitting}
            className="min-h-[54px] w-full rounded-[20px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)] px-[18px] text-[14px] font-semibold text-[var(--accent-red)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {successState.paymentSummary.paidTotalCents > 0 ? 'Cancelar e estornar' : 'Cancelar pedido'}
          </button>
        </div>
      ) : null}
    </main>
  );
}

function PublicPendingPaymentView({
  pendingPayment,
  pendingPaymentSummary,
  pendingSelectedItems,
  categories,
  onRetry,
}: {
  pendingPayment: PendingPublicPaymentState;
  pendingPaymentSummary: OrderPaymentSummary | null;
  pendingSelectedItems: Array<{ id: string; nome: string; categoria: string; quantity?: number }>;
  categories: string[];
  onRetry: () => void;
}) {
  const isFailed = pendingPayment.paymentStatus === 'failed';
  return (
    <main className="public-shell flex flex-col">
      <PublicHeader />
      <div className="public-content">
        <PublicStateCard
          icon={(
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          )}
          title={isFailed ? 'Pagamento não concluído' : 'Aguardando confirmação'}
          body={
            isFailed
              ? 'O Stripe informou que o pagamento não foi concluído. Você pode voltar ao pedido e tentar novamente.'
              : 'Estamos aguardando a confirmação do Stripe para finalizar o pedido. Esta tela atualiza automaticamente.'
          }
          summary={(
            <PublicOrderSummary
              paidTotalCents={pendingPaymentSummary?.paidTotalCents ?? 0}
              categories={categories}
              selectedItems={pendingSelectedItems}
            />
          )}
        />
      </div>
      {isFailed ? (
        <PublicActionBar>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[54px] w-full rounded-[20px] border border-[var(--border-strong)] bg-[var(--bg)] px-[18px] text-[14px] font-semibold text-[var(--text)] transition-opacity hover:opacity-90"
          >
            Voltar ao pedido
          </button>
        </PublicActionBar>
      ) : null}
    </main>
  );
}

export default function PublicMenuPage({ token }: PublicMenuPageProps) {
  const {
    menu,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    observation,
    setObservation,
    selection,
    submitting,
    successState,
    cancelledState,
    checkoutSession,
    pendingPayment,
    currentView,
    itemsByCategory,
    canModifyExistingOrder,
    canStartNewOrder,
    isMenuExpired,
    currentPaymentSummary,
    pendingSelectedItems,
    pendingPaymentSummary,
    selectionViolations,
    repeatedCategories,
    customerNameInputRef,
    mediumTap,
    canIncreaseItemQuantity,
    incrementItem,
    decrementItem,
    toggleItem,
    handleSubmit,
    handleDeleteOrder,
    handleStartNewOrderFromCancelled,
    handleRetryFromFailedPayment,
    handleCheckoutClose,
    openSubmittedPaymentState,
  } = usePublicMenuPage(token);

  if (menu === undefined) return <LoadingSpinner />;

  if (cancelledState) {
    return (
      <PublicCancelledView
        cancelledState={cancelledState}
        canStartNewOrder={canStartNewOrder}
        onNewOrder={handleStartNewOrderFromCancelled}
      />
    );
  }

  if (successState) {
    return (
      <PublicSuccessView
        successState={successState}
        canModifyExistingOrder={canModifyExistingOrder}
        isMenuExpired={isMenuExpired}
        submitting={submitting}
        categories={menu?.categories ?? []}
        onCancelOrder={() => { mediumTap(); void handleDeleteOrder(); }}
      />
    );
  }

  if (currentView === 'submitted' && pendingPayment && !successState) {
    return (
      <PublicPendingPaymentView
        pendingPayment={pendingPayment}
        pendingPaymentSummary={pendingPaymentSummary}
        pendingSelectedItems={pendingSelectedItems.map(item => ({
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          quantity: item.quantity,
        }))}
        categories={menu?.categories ?? []}
        onRetry={handleRetryFromFailedPayment}
      />
    );
  }

  if (!menu) {
    return (
      <main className="public-shell">
        <PublicHeader />
        <div className="public-content">
          <PublicStateCard
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            )}
            title="Este cardápio não está mais disponível"
            body="O link é válido apenas para o cardápio do dia. Solicite um novo compartilhamento."
          />
        </div>
      </main>
    );
  }

  if (!menu.acceptingOrders) {
    return (
      <main className="public-shell">
        <PublicHeader />
        <div className="public-content">
          <PublicStateCard
            icon={(
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 7V4m8 3V4" />
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18" />
              </svg>
            )}
            title="O recebimento de pedidos foi encerrado"
            body="A cozinha já está montando os pratos deste cardápio. Se precisar, solicite um novo posicionamento do restaurante."
          />
        </div>
      </main>
    );
  }

  return (
    <main className="public-shell flex flex-col">
      <PublicHeader />

      <div className="public-content">
        <section className="public-panel px-[18px] py-[18px] md:px-[22px] md:py-[20px]">
          <h2 className="text-[21px] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--text)] md:text-[24px]">
            Identificação
          </h2>

          <label className="mt-[16px] block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Seu nome
            <input
              ref={customerNameInputRef}
              type="text"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Digite seu nome"
              className="neon-gold-focus mt-[8px] w-full rounded-[20px] border border-[var(--border)] bg-[rgba(255,248,232,0.05)] px-[16px] py-[15px] text-[16px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
            />
          </label>

          <label className="mt-[16px] block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">
            Observação
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Ex: sem cebola, alérgico a amendoim"
              maxLength={500}
              rows={3}
              className="neon-gold-focus mt-[8px] w-full resize-none rounded-[20px] border border-[var(--border)] bg-[rgba(255,248,232,0.05)] px-[16px] py-[15px] text-[16px] font-medium text-[var(--text)] outline-none transition-colors placeholder:text-[var(--text-dim)] focus:border-[var(--accent)]"
            />
          </label>
        </section>

        <section className="mt-[16px] grid gap-[14px] pb-[calc(128px+env(safe-area-inset-bottom))] lg:grid-cols-2 lg:items-start lg:pb-[calc(146px+env(safe-area-inset-bottom))]">
          {itemsByCategory.map(({ category, items }) => (
            <section
              key={category}
              className="public-panel px-[18px] py-[18px] md:px-[22px] md:py-[20px]"
            >
              <div className="flex items-center justify-between gap-[12px]">
                <div>
                  <h2 className="text-[20px] font-semibold leading-[1.08] tracking-[-0.02em] text-[var(--text)] md:text-[22px]">
                    {category}
                  </h2>
                </div>
                <div className="public-pill neon-gold-text text-[14px] font-semibold text-[var(--accent)]">
                  {items.length}
                </div>
              </div>
              {describeCategorySelectionRule(category, menu.categorySelectionRules) ? (
                <p className="neon-gold-text mt-[10px] text-[13px] leading-[1.55] text-[var(--accent)]">
                  {describeCategorySelectionRule(category, menu.categorySelectionRules)}
                </p>
              ) : null}
              <ul className="mt-[14px] flex list-none flex-col gap-[10px]">
                {items.map(item => (
                  <PublicItemRow
                    key={item.id}
                    item={item}
                    quantity={selection.find(s => s.itemId === item.id)?.quantity ?? 0}
                    allowsRepeating={repeatedCategories.has(category)}
                    blockingViolation={canIncreaseItemQuantity(item.id, selection)}
                    submitting={submitting}
                    onDecrement={() => decrementItem(item.id)}
                    onIncrement={() => incrementItem(item.id)}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </section>
      </div>

      <PublicActionBar>
        <div className="px-[12px] py-[10px] md:px-[16px] md:py-[14px]">
          <div className="mb-[10px] flex items-end justify-between gap-[12px]">
            <div className="min-w-0">
              {selectionViolations[0] ? (
                <p className="text-[13px] leading-[1.6] text-[var(--accent-red)]">
                  {selectionViolations[0].message}
                </p>
              ) : null}
            </div>
            {currentPaymentSummary ? (
              <div className="min-w-[124px] text-right md:min-w-[190px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Total a pagar
                </p>
                <p className="neon-gold-text mt-[4px] text-[16px] font-semibold text-[var(--accent)]">
                  {formatCurrency(currentPaymentSummary.paidTotalCents)}
                </p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => { mediumTap(); void handleSubmit(); }}
            disabled={submitting}
            className="neon-gold-fill min-h-[52px] w-full rounded-[20px] bg-[var(--accent)] px-[18px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Processando...' : (currentPaymentSummary?.paidTotalCents ?? 0) > 0 ? 'Pagar e finalizar pedido' : 'Enviar pedido'}
          </button>
        </div>
      </PublicActionBar>

      <BottomSheet
        open={Boolean(checkoutSession?.clientSecret)}
        title="Finalize seu pedido"
        onClose={handleCheckoutClose}
      >
        {checkoutSession?.clientSecret ? (
          <div className="max-h-[min(78vh,720px)] overflow-hidden pt-[2px]">
            <EmbeddedStripeCheckout
              clientSecret={checkoutSession.clientSecret}
              initialEmail={customerEmail}
              onEmailChange={setCustomerEmail}
              returnUrl={buildStripeReturnUrl(checkoutSession.draftId)}
              onComplete={() => openSubmittedPaymentState(checkoutSession.draftId)}
            />
          </div>
        ) : null}
      </BottomSheet>
    </main>
  );
}
