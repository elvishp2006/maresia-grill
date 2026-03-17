import type { InsightListItem, SuggestionItem, WeekdayAverage } from '../lib/insights';

interface InsightsPanelProps {
  loading: boolean;
  error: string | null;
  trackedDays: number;
  weekdayLabel: string;
  topItems: InsightListItem[];
  weekdayAverages: WeekdayAverage[];
  categoryLeaders: InsightListItem[];
  streakItems: Array<InsightListItem & { streak: number }>;
  neglectedItems: Array<InsightListItem & { lastSeen: string | null }>;
  suggestedItems: SuggestionItem[];
  onSelectSuggestion: (id: string) => void;
}

function RankingList({
  items,
  emptyText,
  valueLabel,
}: {
  items: Array<{ id: string; nome: string; categoria: string; count: number }>;
  emptyText: string;
  valueLabel: (count: number) => string;
}) {
  if (items.length === 0) {
    return <p className="text-[14px] leading-[1.5] text-[var(--text-dim)]">{emptyText}</p>;
  }

  const maxCount = Math.max(...items.map(item => item.count), 1);

  return (
    <ul className="flex list-none flex-col gap-[10px]">
      {items.map(item => (
        <li key={item.id} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[12px] py-[10px]">
          <div className="flex items-start justify-between gap-[12px]">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[var(--text)]">{item.nome}</p>
              <p className="mt-[2px] text-[12px] text-[var(--text-dim)]">{item.categoria}</p>
            </div>
            <span className="neon-gold-text shrink-0 text-[13px] font-semibold text-[var(--accent)]">{valueLabel(item.count)}</span>
          </div>
          <div className="mt-[8px] h-[6px] overflow-hidden rounded-full bg-[var(--input-bg)]">
            <div
              className="neon-gold-fill h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${Math.max(14, (item.count / maxCount) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function InsightsPanel({
  loading,
  error,
  trackedDays,
  weekdayLabel,
  topItems,
  weekdayAverages,
  categoryLeaders,
  streakItems,
  neglectedItems,
  suggestedItems,
  onSelectSuggestion,
}: InsightsPanelProps) {
  return (
    <section className="mb-[18px] flex flex-col gap-[16px]">
      <div className="section-card">
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
              Sugestões inteligentes
            </p>
            <h2 className="mt-[4px] font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
              O que faz sentido hoje
            </h2>
            <p className="mt-[8px] max-w-[48ch] text-[14px] leading-[1.6] text-[var(--text-dim)]">
              Baseado no seu histórico recente e no comportamento típico de {weekdayLabel}.
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] px-[10px] py-[6px] text-[12px] text-[var(--text-dim)]">
            {trackedDays} dias
          </span>
        </div>

        {loading ? (
          <p className="mt-[14px] text-[14px] text-[var(--text-dim)]">Analisando seu histórico...</p>
        ) : error ? (
          <p className="mt-[14px] text-[14px] text-[var(--accent-red)]">{error}</p>
        ) : suggestedItems.length === 0 ? (
          <p className="mt-[14px] text-[14px] text-[var(--text-dim)]">
            Ainda não há sugestões fortes. Continue usando o app para criar histórico.
          </p>
        ) : (
          <ul className="mt-[16px] flex list-none flex-col gap-[12px]">
            {suggestedItems.map(item => (
              <li key={item.id} className="rounded-[20px] border border-[var(--border)] bg-[var(--bg-card)] px-[14px] py-[14px] shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
                <div className="flex items-start justify-between gap-[12px]">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[var(--text)]">{item.nome}</p>
                    <p className="mt-[2px] text-[12px] text-[var(--text-dim)]">{item.categoria}</p>
                    <p className="mt-[10px] text-[13px] leading-[1.6] text-[var(--text-dim)]">{item.reason}</p>
                  </div>
                  <button
                    type="button"
                    className="neon-gold-fill min-h-[42px] shrink-0 rounded-[16px] bg-[var(--accent)] px-[14px] py-[10px] text-[13px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
                    onClick={() => onSelectSuggestion(item.id)}
                  >
                    Selecionar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section-card">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Estatísticas
        </p>
        <h2 className="mt-[4px] font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
          Leitura do cardápio
        </h2>

        {loading ? (
          <p className="mt-[14px] text-[14px] text-[var(--text-dim)]">Carregando estatísticas...</p>
        ) : error ? (
          <p className="mt-[14px] text-[14px] text-[var(--accent-red)]">{error}</p>
        ) : (
          <div className="mt-[16px] grid grid-cols-1 gap-[16px] lg:grid-cols-2">
            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
              <h3 className="text-[16px] font-semibold text-[var(--text)]">Complementos mais usados</h3>
              <div className="mt-[12px]">
                <RankingList
                  items={topItems}
                  emptyText="Sem dados suficientes ainda."
                  valueLabel={(count) => `${count}x`}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
              <h3 className="text-[16px] font-semibold text-[var(--text)]">Quantidade por dia da semana</h3>
              <ul className="mt-[12px] flex list-none flex-col gap-[10px]">
                {weekdayAverages.map(entry => (
                  <li key={entry.weekday} className="flex items-center justify-between gap-[10px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] py-[10px]">
                    <div>
                      <p className="text-[14px] font-semibold text-[var(--text)]">{entry.label}</p>
                      <p className="text-[12px] text-[var(--text-dim)]">{entry.sampleSize} registro(s)</p>
                    </div>
                    <span className="neon-gold-text text-[14px] font-semibold text-[var(--accent)]">{entry.average.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
              <h3 className="text-[16px] font-semibold text-[var(--text)]">Mais usados por categoria</h3>
              <div className="mt-[12px]">
                <RankingList
                  items={categoryLeaders}
                  emptyText="Nenhuma categoria com histórico suficiente."
                  valueLabel={(count) => `${count}x`}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
              <h3 className="text-[16px] font-semibold text-[var(--text)]">Sequências recentes</h3>
              {streakItems.length === 0 ? (
                <p className="mt-[12px] text-[14px] text-[var(--text-dim)]">Sem sequências relevantes no período.</p>
              ) : (
                <ul className="mt-[12px] flex list-none flex-col gap-[10px]">
                  {streakItems.map(item => (
                    <li key={item.id} className="rounded-[18px] border border-[var(--border)] bg-[var(--bg-elevated)] px-[12px] py-[10px]">
                      <div className="flex items-center justify-between gap-[12px]">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-[var(--text)]">{item.nome}</p>
                          <p className="mt-[2px] text-[12px] text-[var(--text-dim)]">{item.categoria}</p>
                        </div>
                        <span className="neon-gold-text shrink-0 text-[13px] font-semibold text-[var(--accent)]">{item.streak} dias</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[22px] border border-[var(--border)] bg-[var(--bg-card)] p-[16px] shadow-[0_8px_20px_rgba(0,0,0,0.08)] lg:col-span-2">
              <h3 className="text-[16px] font-semibold text-[var(--text)]">Complementos esquecidos</h3>
              {neglectedItems.length === 0 ? (
                <p className="mt-[12px] text-[14px] text-[var(--text-dim)]">Todos os itens tiveram alguma aparição recente.</p>
              ) : (
                <ul className="mt-[12px] flex list-none flex-col gap-[10px]">
                  {neglectedItems.map(item => (
                    <li key={item.id} className="flex items-center justify-between gap-[12px] rounded-[16px] border border-[var(--border)] px-[12px] py-[10px]">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-[var(--text)]">{item.nome}</p>
                        <p className="mt-[2px] text-[12px] text-[var(--text-dim)]">
                          {item.categoria} • {item.lastSeen ? `Última vez: ${item.lastSeen}` : 'Nunca apareceu'}
                        </p>
                      </div>
                      <span className="neon-gold-text shrink-0 text-[13px] font-semibold text-[var(--accent)]">{item.count}x</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
