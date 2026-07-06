import type { ChangeEvent } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  /** Label text */
  label: string;
  /** Input name — also used as htmlFor binding */
  name: string;
  /** Available options */
  options: SelectOption[];
  /** Currently selected value */
  value: string;
  /** Change handler */
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  /** Validation error message */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder text shown as the first disabled option */
  placeholder?: string;
  /** Disable the select */
  disabled?: boolean;
  className?: string;
}

function Select({
  label,
  name,
  options,
  value,
  onChange,
  error,
  required = false,
  placeholder,
  disabled = false,
  className,
}: SelectProps) {
  const errorId = `${name}-error`;

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={name}
        className="text-sm font-medium text-foreground"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={clsx(
            'w-full appearance-none rounded border bg-surface px-3 py-2 pr-9 text-sm text-foreground',
            'transition-colors duration-fast',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-error focus:ring-error'
              : 'border-border hover:border-neutral-400',
          )}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted"
          aria-hidden="true"
        />
      </div>

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

export { Select };
