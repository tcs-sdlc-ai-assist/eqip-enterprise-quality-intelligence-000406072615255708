import type { ChangeEvent } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';

export interface CheckboxProps {
  /** Label text */
  label: string;
  /** Input name */
  name: string;
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Change handler */
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Disable the checkbox */
  disabled?: boolean;
  className?: string;
}

function Checkbox({
  label,
  name,
  checked,
  onChange,
  disabled = false,
  className,
}: CheckboxProps) {
  return (
    <label
      className={clsx(
        'inline-flex items-center gap-2 cursor-pointer select-none text-sm text-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span className="relative flex items-center justify-center">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          className={clsx(
            'flex h-4.5 w-4.5 items-center justify-center rounded border transition-colors duration-fast',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            checked
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'border-border bg-surface hover:border-neutral-400',
            disabled && 'pointer-events-none',
          )}
          aria-hidden="true"
        >
          {checked && <Check size={12} strokeWidth={3} aria-hidden="true" />}
        </span>
      </span>
      {label}
    </label>
  );
}

export { Checkbox };
