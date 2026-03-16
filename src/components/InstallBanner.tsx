import { usePWAInstall } from '../hooks/usePWAInstall';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

export default function InstallBanner() {
  const { canInstall, installMode, install, dismiss } = usePWAInstall();
  const { lightTap, success } = useHapticFeedback();

  if (!canInstall) return null;

  const handleInstall = () => {
    if (installMode !== 'prompt') {
      lightTap();
      dismiss();
      return;
    }

    success();
    void install();
  };

  const handleDismiss = () => {
    lightTap();
    dismiss();
  };

  const title = installMode === 'ios-manual' ? 'Instalar no iPhone' : 'Instalar o app';
  const description = installMode === 'ios-manual'
    ? 'Toque em Compartilhar no Safari e depois em Adicionar a Tela de Inicio.'
    : 'Acesse mais rápido pela tela inicial';
  const actionLabel = installMode === 'ios-manual' ? 'Entendi' : 'Instalar';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-[12px]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}
    >
      <div className="mx-auto flex max-w-[960px] items-center gap-[12px] rounded-[22px] border border-[var(--border-strong)] bg-[rgba(29,31,23,0.96)] px-[14px] py-[12px] shadow-[0_16px_38px_rgba(0,0,0,0.24)] backdrop-blur-[18px]">
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[var(--text)] truncate">
            {title}
          </p>
          <p className="text-[13px] text-[var(--text-dim)]">
            {description}
          </p>
        </div>
        <button
          type="button"
          className="min-h-[44px] shrink-0 rounded-[14px] bg-[var(--accent)] px-[14px] py-[10px] text-[14px] font-semibold text-[var(--bg)] transition-opacity hover:opacity-90"
          onClick={handleInstall}
        >
          {actionLabel}
        </button>
        <button
          type="button"
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-[20px] leading-none text-[var(--text-dim)] transition-colors hover:border-[var(--border)] hover:text-[var(--text)]"
          onClick={handleDismiss}
          aria-label="Fechar banner de instalação"
        >
          ×
        </button>
      </div>
    </div>
  );
}
