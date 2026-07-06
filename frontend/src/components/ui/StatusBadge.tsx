import clsx from 'clsx';
import type React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  active: 'success',
  passed: 'success',
  pass: 'success',
  warning: 'warning',
  in_progress: 'warning',
  pending: 'warning',
  failed: 'error',
  fail: 'error',
  error: 'error',
  locked: 'error',
  blocked: 'error',
  inactive: 'neutral',
  deprecated: 'neutral',
  archived: 'neutral',
  draft: 'neutral',
  skipped: 'neutral',
};

const variantStyles: Record<BadgeVariant, string> = {
  success:
    'bg-success-light text-success dark:bg-success/10 dark:text-green-400',
  warning:
    'bg-warning-light text-warning dark:bg-warning/10 dark:text-yellow-400',
  error:
    'bg-error-light text-error dark:bg-error/10 dark:text-red-400',
  info:
    'bg-info-light text-info dark:bg-info/10 dark:text-blue-400',
  neutral:
    'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
};

const sizeStyles: Record<'sm' | 'md', string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
};

function capitalize(str: string): string {
  if (!str) return '';
  const display = str.replace(/_/g, ' ');
  return display.charAt(0).toUpperCase() + display.slice(1);
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  size = 'md',
}) => {
  const resolvedVariant =
    variant ?? STATUS_VARIANT_MAP[status.toLowerCase()] ?? 'neutral';

  return (
    <span
      role="status"
      className={clsx(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        variantStyles[resolvedVariant],
        sizeStyles[size],
      )}
    >
      {capitalize(status)}
    </span>
  );
};

export { StatusBadge };
export type { StatusBadgeProps, BadgeVariant };
