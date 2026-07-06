import { Modal } from './Modal';
import { Button } from './Button';
import type { ButtonProps } from './Button';

export interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Called when the dialog should close */
  onClose: () => void;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Dialog title */
  title: string;
  /** Descriptive message */
  message: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Visual variant */
  variant?: 'danger' | 'warning' | 'default';
}

const confirmVariantMap: Record<
  NonNullable<ConfirmDialogProps['variant']>,
  ButtonProps['variant']
> = {
  danger: 'danger',
  warning: 'primary',
  default: 'primary',
};

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          {message}
        </p>

        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariantMap[variant]}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export { ConfirmDialog };
