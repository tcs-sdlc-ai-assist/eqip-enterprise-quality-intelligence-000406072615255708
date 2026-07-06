import type { ReactNode } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

export interface AlertProps {
  /** Status variant */
  variant: 'success' | 'warning' | 'error' | 'info';
  /** Optional bold title */
  title?: string;
  /** Alert body */
  children: ReactNode;
  /** Show a dismiss button */
  onDismiss?: () => void;
  className?: string;
}

const variantMap: Record<AlertProps['variant'], string> = {
  success: 'bg-success-light text-success border-success/20',
  warning: 'bg-warning-light text-warning border-warning/20',
  error:   'bg-error-light text-error border-error/20',
  info:    'bg-info-light text-info border-info/20',
};

const roleMap: Record<AlertProps['variant'], 'alert' | 'status'> = {
  success: 'status',
  warning: 'alert',
  error:   'alert',
  info:    'status',
};

function Alert({
  variant,
  title,
  children,
  onDismiss,
  className,
}: AlertProps) {
  return (
    <div
      role={roleMap[variant]}
      className={clsx(
        'relative border rounded-md p-4 text-sm',
        variantMap[variant],
        className,
      )}
    >
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 p-0.5 rounded hover:opacity-70 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}

      {title && <p className="font-semibold mb-1">{title}</p>}

      <div className={clsx(onDismiss && 'pr-6')}>{children}</div>
    </div>
  );
}

export { Alert };
