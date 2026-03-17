export default function NotFoundPage() {
  return (
    <main className="app-shell">
      <section className="sticky top-0 z-30 -mx-[16px] mb-[18px] border-b border-[var(--border)] bg-[rgba(21,22,15,0.92)] px-[16px] pb-[12px] pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-[18px]">
        <div className="flex items-center gap-[10px]">
          <img
            src="/brand/menu-mark.svg"
            alt="Logo do Maresia Grill"
            className="h-[28px] w-[28px] shrink-0 object-cover object-top"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
              Erro 404
            </p>
            <h1 className="font-[Georgia,'Times_New_Roman',serif] text-[22px] font-bold text-[var(--text)]">
              Página não encontrada
            </h1>
          </div>
        </div>
      </section>

      <section className="section-card">
        <p className="text-[15px] leading-[1.7] text-[var(--text-dim)]">
          O caminho acessado não existe nesta aplicação.
        </p>
        <a
          href="/"
          className="neon-gold-fill mt-[20px] inline-flex min-h-[52px] w-full items-center justify-center rounded-[20px] bg-[var(--accent)] px-[20px] text-[15px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90"
        >
          Voltar ao início
        </a>
      </section>
    </main>
  );
}
