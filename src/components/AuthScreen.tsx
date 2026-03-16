interface AuthScreenProps {
  email?: string | null;
  error?: string | null;
  mode: 'sign-in' | 'unauthorized';
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  primaryActionLabel: string;
  primaryDisabled?: boolean;
}

export default function AuthScreen({
  email,
  error,
  mode,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel,
  primaryDisabled = false,
}: AuthScreenProps) {
  const title = mode === 'sign-in' ? 'Acesso restrito' : 'Conta sem acesso';
  const description = mode === 'sign-in'
    ? 'Entre com sua conta Google autorizada para acessar o catalogo e o historico do restaurante.'
    : 'Sua conta Google foi reconhecida, mas ainda nao esta na allowlist de usuarios autorizados.';

  return (
    <div className="app-shell flex min-h-dvh items-center">
      <section className="section-card w-full">
        <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--text-dim)]">
          Firebase protegido
        </p>
        <h1 className="mt-[8px] font-[Georgia,'Times_New_Roman',serif] text-[34px] font-bold leading-[1.1] text-[var(--text)]">
          {title}
        </h1>
        <p className="mt-[12px] max-w-[52ch] text-[15px] leading-[1.7] text-[var(--text-dim)]">
          {description}
        </p>

        {email ? (
          <p className="mt-[18px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[14px] py-[12px] text-[14px] text-[var(--text)]">
            Conta atual: <span className="font-semibold">{email}</span>
          </p>
        ) : null}

        {error ? (
          <p className="mt-[18px] rounded-[18px] border border-[var(--accent-red)] bg-[rgba(208,109,86,0.08)] px-[14px] py-[12px] text-[14px] leading-[1.6] text-[var(--text)]">
            {error}
          </p>
        ) : null}

        <div className="mt-[20px] flex flex-col gap-[10px] sm:flex-row">
          <button
            type="button"
            className="min-h-[50px] flex-1 rounded-[18px] bg-[var(--accent)] px-[16px] py-[12px] text-[14px] font-semibold text-[var(--bg)] shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
          >
            {primaryActionLabel}
          </button>

          {onSecondaryAction ? (
            <button
              type="button"
              className="min-h-[50px] flex-1 rounded-[18px] border border-[var(--border)] bg-[var(--bg-card)] px-[16px] py-[12px] text-[14px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              onClick={onSecondaryAction}
            >
              Sair
            </button>
          ) : null}
        </div>

        <p className="mt-[16px] text-[13px] leading-[1.6] text-[var(--text-dim)]">
          Administre os acessos atualizando a allowlist de emails do app e as regras do Firestore.
        </p>
      </section>
    </div>
  );
}
