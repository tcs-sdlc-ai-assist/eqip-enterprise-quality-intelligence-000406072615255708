import clsx from 'clsx';
import { Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search…',
  debounceMs = 300,
  className,
}) => {
  const [internal, setInternal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes
  useEffect(() => {
    setInternal(value);
  }, [value]);

  const debouncedChange = useCallback(
    (next: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(next);
      }, debounceMs);
    },
    [onChange, debounceMs],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setInternal(next);
    debouncedChange(next);
  };

  const handleClear = () => {
    setInternal('');
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange('');
  };

  return (
    <div className={clsx('relative', className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted pointer-events-none"
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <input
        type="text"
        value={internal}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
        aria-label={placeholder}
      />
      {internal && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-foreground-muted hover:text-foreground transition-colors duration-fast"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export { SearchBar };
export type { SearchBarProps };
