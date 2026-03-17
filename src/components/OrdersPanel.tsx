import type { OrderEntry, PublicMenuVersion } from '../types';
import { groupOrderItemsByCategory } from '../lib/utils';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface OrdersPanelProps {
  orders: OrderEntry[];
  categories: string[];
  menuVersions: Record<string, PublicMenuVersion>;
  acceptingOrders: boolean;
  intakePending: boolean;
  canManageIntake: boolean;
  onToggleIntake: () => void;
  loading: boolean;
  error: boolean;
}

export default function OrdersPanel({
  orders,
  categories,
  menuVersions,
  acceptingOrders,
  intakePending,
  canManageIntake,
  onToggleIntake,
  loading,
  error,
}: OrdersPanelProps) {
  const { mediumTap } = useHapticFeedback();

  return (
    <section className="space-y-[12px]">
      <section className={`section-card border ${acceptingOrders ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)]'}`}>
        <div className="flex items-center justify-between gap-[14px]">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text)]">
              Recebimento de pedidos
            </p>
            <p className={`mt-[4px] text-[13px] font-medium ${acceptingOrders ? 'text-[var(--accent)]' : 'text-[var(--accent-red)]'}`}>
              {acceptingOrders ? 'Aberto' : 'Encerrado'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-label="Recebimento de pedidos"
            aria-checked={acceptingOrders}
            className={`relative inline-flex h-[34px] w-[60px] shrink-0 items-center rounded-full border transition-colors ${acceptingOrders ? 'border-[var(--accent)] bg-[rgba(215,176,92,0.28)]' : 'border-[rgba(208,109,86,0.44)] bg-[rgba(208,109,86,0.18)]'} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => {
              mediumTap();
              onToggleIntake();
            }}
            disabled={!canManageIntake || intakePending}
          >
            <span className="sr-only">
              {acceptingOrders ? 'Encerrar pedidos' : 'Reabrir pedidos'}
            </span>
            <span
              className={`absolute left-[4px] h-[24px] w-[24px] rounded-full bg-[var(--text)] shadow-[0_6px_14px_rgba(0,0,0,0.18)] transition-transform ${acceptingOrders ? 'translate-x-[26px]' : 'translate-x-0'}`}
              aria-hidden="true"
            />
          </button>
        </div>
        {intakePending ? (
          <p className="mt-[8px] text-[12px] font-medium text-[var(--text-dim)]">
            Atualizando...
          </p>
        ) : null}
      </section>

      {loading ? (
        <section className="section-card">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
            Pedidos
          </p>
          <h2 className="mt-[10px] font-[Georgia,'Times_New_Roman',serif] text-[26px] font-bold text-[var(--text)]">
            Carregando pedidos
          </h2>
        </section>
      ) : null}

      {error ? (
        <section className="section-card border border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)]">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--accent-red)]">
            Pedidos
          </p>
          <h2 className="mt-[10px] font-[Georgia,'Times_New_Roman',serif] text-[26px] font-bold text-[var(--text)]">
            Pedidos indisponíveis
          </h2>
          <p className="mt-[8px] text-[14px] leading-[1.6] text-[var(--text-dim)]">
            Não foi possível carregar os pedidos do dia.
          </p>
        </section>
      ) : null}

      {!loading && !error && orders.length === 0 ? (
        <section className="section-card border-dashed">
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
            Pedidos
          </p>
          <h2 className="mt-[10px] font-[Georgia,'Times_New_Roman',serif] text-[26px] font-bold text-[var(--text)]">
            Nenhum pedido ainda
          </h2>
          <p className="mt-[8px] text-[14px] leading-[1.6] text-[var(--text-dim)]">
            Os pedidos enviados pelo link público aparecerão aqui.
          </p>
        </section>
      ) : null}

      {!loading && !error ? orders.map((order) => {
        const resolvedVersion = order.menuVersionId ? menuVersions[order.menuVersionId] : undefined;
        const resolvedItems = resolvedVersion
          ? resolvedVersion.items.filter(item => order.selectedItemIds.includes(item.id))
          : (order.submittedItems ?? []);
        const orderedCategories = resolvedVersion?.categories ?? categories;
        const groupedItems = groupOrderItemsByCategory(resolvedItems, orderedCategories);

        return (
          <article
            key={order.id}
            className="section-card border border-[var(--border)] bg-[var(--bg-card)]"
          >
            <div className="flex items-start justify-between gap-[10px]">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
                  Pedido
                </p>
                <h2 className="mt-[8px] truncate font-[Georgia,'Times_New_Roman',serif] text-[22px] font-bold text-[var(--text)]">
                  {order.customerName}
                </h2>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-[10px] py-[4px] text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                {new Date(order.submittedAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {groupedItems.length > 0 ? (
              <div className="mt-[14px] space-y-[10px]">
                {groupedItems.map((group) => (
                  <div
                    key={group.category}
                    className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[14px] py-[12px]"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">
                      {group.category}
                    </p>
                    <ul className="mt-[8px] space-y-[6px]">
                      {group.names.map((name) => (
                        <li key={name} className="text-[14px] leading-[1.5] text-[var(--text)]">
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-[14px] text-[14px] leading-[1.6] text-[var(--text)]">
                Nenhum item selecionado.
              </p>
            )}
          </article>
        );
      }) : null}
    </section>
  );
}
