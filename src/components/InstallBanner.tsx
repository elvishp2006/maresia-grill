import { usePWAInstall } from '../hooks/usePWAInstall';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export default function InstallBanner() {
  const { canInstall, install, dismiss } = usePWAInstall();
  const { lightTap, success } = useHapticFeedback();

  if (!canInstall) return null;

  const handleInstall = () => {
    success();
    install();
  };

  const handleDismiss = () => {
    lightTap();
    dismiss();
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-card)] border-t border-[var(--border)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="max-w-[960px] mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[13px] font-semibold text-[var(--text)] truncate">
            Instalar o app
          </p>
          <p className="font-mono text-[11px] text-[var(--text-dim)]">
            Acesse mais rápido pela tela inicial
          </p>
        </div>
        <button
          type="button"
          className="font-mono text-[13px] font-semibold text-[var(--bg)] bg-[var(--accent)] border-none rounded-[4px] px-4 py-2 cursor-pointer touch-manipulation transition-opacity hover:opacity-90 active:scale-95 shrink-0"
          onClick={handleInstall}
        >
          Instalar
        </button>
        <button
          type="button"
          className="text-[18px] leading-none text-[var(--text-dim)] bg-transparent border-none cursor-pointer px-2 py-1 touch-manipulation hover:text-[var(--text)] active:scale-95 shrink-0"
          onClick={handleDismiss}
          aria-label="Fechar banner de instalação"
        >
          ×
        </button>
      </div>
    </div>
  );
}
