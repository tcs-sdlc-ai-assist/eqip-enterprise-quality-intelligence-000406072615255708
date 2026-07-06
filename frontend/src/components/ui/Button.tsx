import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { LoadingSpinner } from './LoadingSpinner';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Show a spinner and disable interaction */
  loading?: boolean;
  children: ReactNode;
}

const variantMap: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700',
  secondary: 'border border-border text-foreground hover:bg-surface-raised',
  ghost:     'text-foreground hover:bg-surface-raised',
  danger:    'bg-error text-white hover:bg-red-700',
};

const sizeMap: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const spinnerSizeMap: Record<NonNullable<ButtonProps['size']>, 'sm' | 'md'> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      className,
      type = 'button',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          'inline-flex items-center justify-center gap-2 font-medium rounded',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantMap[variant],
          sizeMap[size],
          className,
        )}
        {...rest}
      >
        {loading && (
          <LoadingSpinner
            size={spinnerSizeMap[size]}
            className="text-current"
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
