import { useEffect, type ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({
  open,
  title,
  description,
  onClose,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full rounded-t-[28px] border border-b-0 border-[var(--border-strong)] bg-[var(--bg-elevated)] px-[20px] pb-[max(20px,env(safe-area-inset-bottom))] pt-[14px] shadow-[0_-20px_60px_rgba(0,0,0,0.35)]"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mb-[16px] h-[5px] w-[56px] rounded-full bg-[var(--border-strong)]" />
        <div className="mb-[18px] flex items-start justify-between gap-[12px]">
          <div className="min-w-0">
            <h2 className="font-[Georgia,'Times_New_Roman',serif] text-[24px] font-bold text-[var(--text)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-[6px] text-[14px] leading-[1.5] text-[var(--text-dim)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-[var(--border)] text-[22px] leading-none text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            onClick={onClose}
            aria-label="Fechar painel"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
