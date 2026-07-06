import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import clsx from 'clsx';

export interface SwitchProps {
  /** Label text */
  label: string;
  /** Whether the switch is on */
  checked: boolean;
  /** Toggle handler */
  onChange: (checked: boolean) => void;
  /** Disable the switch */
  disabled?: boolean;
  /** Input name */
  name?: string;
  className?: string;
}

function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  name,
  className,
}: SwitchProps) {
  const toggle = useCallback(() => {
    if (!disabled) {
      onChange(!checked);
    }
  }, [checked, disabled, onChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <label
      className={clsx(
        'inline-flex items-center gap-3 cursor-pointer select-none text-sm text-foreground',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        name={name}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none',
          checked ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600',
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-fast',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </button>
      <span>{label}</span>
    </label>
  );
}

export { Switch };
