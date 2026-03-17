export default function NotFoundPage() {
  return (
    <main className="public-shell">
      <section className="public-topbar">
        <div className="flex items-center gap-[12px]">
          <div className="flex h-[40px] w-[40px] items-center justify-center rounded-[16px] border border-[var(--border)] bg-[rgba(215,176,92,0.08)]">
            <img
              src="/brand/menu-mark.svg"
              alt="Logo do Maresia Grill"
              className="h-[26px] w-[26px] shrink-0 object-cover object-top"
            />
          </div>
          <div className="min-w-0">
            <p className="public-topbar__eyebrow text-[var(--accent-red)]">
              Erro 404
            </p>
            <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[29px] font-bold leading-[1.02] tracking-[-0.02em] text-[var(--text)]">
              Página não encontrada
            </h1>
          </div>
        </div>
      </section>

      <section className="public-panel px-[18px] py-[20px]">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border border-[var(--border-strong)] bg-[rgba(208,109,86,0.08)] text-[var(--accent-red)]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 9h.01" />
            <path d="M15 9h.01" />
            <path d="M8 15c1-1 2.2-1.5 4-1.5s3 .5 4 1.5" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h2 className="mt-[18px] font-[Georgia,'Times_New_Roman',serif] text-[34px] font-bold leading-[1.02] tracking-[-0.03em] text-[var(--text)]">
          Esse caminho não existe
        </h2>
        <p className="mt-[12px] text-[15px] leading-[1.7] text-[var(--text-dim)]">
          O endereço acessado não pertence a este fluxo do app.
        </p>
        <a
          href="/"
          className="neon-gold-fill mt-[20px] inline-flex min-h-[56px] w-full items-center justify-center rounded-[22px] bg-[var(--accent)] px-[20px] text-[16px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
        >
          Voltar ao início
        </a>
      </section>
    </main>
  );
}
