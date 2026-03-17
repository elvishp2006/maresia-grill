import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useUpdateNotification } from '../hooks/useUpdateNotification';

export default function UpdateBanner() {
  const { needRefresh, applyUpdate, dismiss } = useUpdateNotification();
  const { lightTap, success } = useHapticFeedback();

  if (!needRefresh) return null;

  const handleAction = () => {
    success();
    void applyUpdate();
  };

  const handleDismiss = () => {
    lightTap();
    dismiss();
  };

  return (
    <div
      className="fixed right-0 left-0 z-40 px-[12px]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 8px) + 92px)' }}
    >
      <div className="mx-auto flex max-w-[960px] items-center gap-[12px] rounded-[22px] border border-[var(--border-strong)] bg-[rgba(29,31,23,0.96)] px-[14px] py-[12px] shadow-[0_16px_38px_rgba(0,0,0,0.24)] backdrop-blur-[18px]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[var(--text)]">
            Atualizacao disponivel
          </p>
          <p className="text-[13px] text-[var(--text-dim)]">
            Uma nova versao do app ja pode ser aplicada.
          </p>
        </div>
        <button
          type="button"
          className="neon-gold-fill min-h-[44px] shrink-0 rounded-[14px] bg-[var(--accent)] px-[14px] py-[10px] text-[14px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
          onClick={handleAction}
        >
          Atualizar agora
        </button>
        <button
          type="button"
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-[20px] leading-none text-[var(--text-dim)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
          onClick={handleDismiss}
          aria-label="Fechar aviso de atualizacao"
        >
          ×
        </button>
      </div>
    </div>
  );
}
