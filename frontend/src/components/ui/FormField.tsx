import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface FormFieldProps {
  /** Label text */
  label: string;
  /** Input name — also used as htmlFor binding */
  name: string;
  /** Validation error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** The form control (input / select / textarea) */
  children: ReactNode;
  /** Optional hint text below the input */
  hint?: string;
  className?: string;
}

function FormField({
  label,
  name,
  error,
  required = false,
  children,
  hint,
  className,
}: FormFieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={name}
        className="text-sm font-medium text-foreground"
        aria-required={required || undefined}
      >
        {label}
        {required && (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && (
        <p id={hintId} className="text-xs text-foreground-muted">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-error"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
