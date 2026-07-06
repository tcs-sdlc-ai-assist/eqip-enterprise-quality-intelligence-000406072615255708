import {
  useEffect,
  useRef,
  useCallback,
  useId,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';

export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Dialog title rendered in the header */
  title: string;
  children: ReactNode;
  /** Width preset */
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /* ── Focus trap ── */
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  /* ── ESC to close ── */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      trapFocus(e);
    },
    [onClose, trapFocus],
  );

  /* ── Body scroll lock, focus management, key listeners ── */
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleKeyDown);

    // Focus the dialog container so screen readers announce it
    requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog) {
        const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          dialog.focus();
        }
      }
    });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-fast"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative z-10 w-full bg-surface border border-border rounded-md shadow-lg',
          'mx-4 max-h-[85vh] flex flex-col',
          'focus:outline-none',
          sizeMap[size],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id={titleId} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close dialog"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export { Modal };
