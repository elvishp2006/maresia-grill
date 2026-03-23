import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const { mediumTap } = useHapticFeedback();

  const handleClose = useCallback(() => {
    mediumTap();
    onClose();
  }, [mediumTap, onClose]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const dialogEl = dialogRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
        return;
      }
      if (event.key === 'Tab' && dialogEl) {
        const focusable = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) { event.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeInsideDialog = dialogEl.contains(document.activeElement);

        if (!activeInsideDialog) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [handleClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-[2px]"
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-h-[90svh] flex flex-col rounded-t-[30px] border border-b-0 border-[var(--border-strong)] bg-[var(--bg-elevated)] px-[20px] pb-[max(22px,env(safe-area-inset-bottom))] pt-[14px] shadow-[0_-20px_60px_rgba(0,0,0,0.35)]"
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mb-[18px] h-[5px] w-[60px] shrink-0 rounded-full bg-[var(--border-strong)]" />
        <div className="mb-[20px] shrink-0 flex items-start justify-between gap-[14px]">
          <div className="min-w-0">
            <h2 className="font-[var(--font-display)] text-[24px] font-bold text-[var(--text)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-[8px] text-[14px] leading-[1.6] text-[var(--text-dim)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] text-[22px] leading-none text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            onClick={handleClose}
            aria-label="Fechar painel"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto -mx-[20px] px-[20px] -mt-[20px] pt-[20px] -mb-[max(22px,env(safe-area-inset-bottom))] pb-[max(22px,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
