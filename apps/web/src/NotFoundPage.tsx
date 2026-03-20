import { useHapticFeedback } from './hooks/useHapticFeedback';

export default function NotFoundPage() {
  const { lightTap } = useHapticFeedback();

  return (
    <main className="public-shell">
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

      <section className="not-found-hero">
        <div className="not-found-layout">
          <div>
            <div className="not-found-display" aria-hidden="true">
              <span className="not-found-display__digit not-found-display__digit--ghost">4</span>
              <span className="not-found-display__digit not-found-display__digit--accent">0</span>
              <span className="not-found-display__digit">4</span>
            </div>

            <div className="not-found-copy mt-[14px]">
              <h2 className="max-w-[10ch] text-[34px] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--text)] md:text-[56px]">
                Esse caminho não existe
              </h2>
              <p className="mt-[14px] max-w-[30rem] text-[16px] leading-[1.75] text-[var(--text-dim)] md:text-[18px]">
                Volte para o início e siga pelo fluxo principal.
              </p>
            </div>

            <div className="not-found-actions mt-[24px]">
              <a
                href="/"
                onClick={() => {
                  lightTap();
                }}
                className="neon-gold-fill inline-flex min-h-[56px] items-center justify-center rounded-[22px] bg-[var(--accent)] px-[24px] text-[16px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 sm:min-w-[220px]"
              >
                Voltar ao início
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
