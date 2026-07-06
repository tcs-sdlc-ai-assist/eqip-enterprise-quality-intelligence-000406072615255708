import clsx from 'clsx';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface ToastItemProps {
  /** Unique toast id */
  id: string;
  /** Toast message */
  message: string;
  /** Visual variant */
  variant: 'success' | 'error' | 'warning' | 'info';
  /** Dismiss handler */
  onDismiss: (id: string) => void;
}

const variantStyles: Record<ToastItemProps['variant'], string> = {
  success:
    'bg-success-light text-success border-success/20 dark:bg-success/10 dark:text-green-300 dark:border-success/30',
  error:
    'bg-error-light text-error border-error/20 dark:bg-error/10 dark:text-red-300 dark:border-error/30',
  warning:
    'bg-warning-light text-warning border-warning/20 dark:bg-warning/10 dark:text-yellow-300 dark:border-warning/30',
  info:
    'bg-info-light text-info border-info/20 dark:bg-info/10 dark:text-blue-300 dark:border-info/30',
};

const variantIcons: Record<ToastItemProps['variant'], React.FC<{ className?: string }>> = {
  success: (props) => <CheckCircle {...props} aria-hidden="true" />,
  error: (props) => <AlertCircle {...props} aria-hidden="true" />,
  warning: (props) => <AlertTriangle {...props} aria-hidden="true" />,
  info: (props) => <Info {...props} aria-hidden="true" />,
};

function ToastItem({ id, message, variant, onDismiss }: ToastItemProps) {
  const IconComponent = variantIcons[variant];

  return (
    <div
      role="status"
      className={clsx(
        'pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-sm',
        'animate-slide-in-right motion-reduce:animate-none',
        'w-80 max-w-[calc(100vw-3rem)]',
        variantStyles[variant],
      )}
    >
      <IconComponent className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded p-0.5 opacity-70 transition-opacity duration-fast hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export { ToastItem };
