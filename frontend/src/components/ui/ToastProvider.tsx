import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Global toast / notification system.
// Renders a fixed container (bottom-right) with an aria-live region.
// Auto-dismisses after `duration` ms (default 5 000).
// ---------------------------------------------------------------------------

export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const DEFAULT_DURATION = 5000;

// ---- Variant lookup maps (design-system contract: variants via lookup) ----

const variantStyles: Record<Toast['variant'], string> = {
  success:
    'bg-success-light text-success border-success/20 dark:bg-success/10 dark:text-green-300 dark:border-success/30',
  error:
    'bg-error-light text-error border-error/20 dark:bg-error/10 dark:text-red-300 dark:border-error/30',
  warning:
    'bg-warning-light text-warning border-warning/20 dark:bg-warning/10 dark:text-yellow-300 dark:border-warning/30',
  info:
    'bg-info-light text-info border-info/20 dark:bg-info/10 dark:text-blue-300 dark:border-info/30',
};

const variantIcons: Record<Toast['variant'], React.FC<{ className?: string }>> = {
  success: (props) => <CheckCircle {...props} aria-hidden="true" />,
  error: (props) => <AlertCircle {...props} aria-hidden="true" />,
  warning: (props) => <AlertTriangle {...props} aria-hidden="true" />,
  info: (props) => <Info {...props} aria-hidden="true" />,
};

// ---- Provider ----

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const duration = toast.duration ?? DEFAULT_DURATION;

      setToasts((prev) => [...prev, { ...toast, id }]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [removeToast],
  );

  const value = useMemo<ToastContextType>(
    () => ({ addToast, removeToast }),
    [addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* ---- Toast container ---- */}
      <div
        aria-live="polite"
        aria-relevant="additions removals"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((toast) => {
          const IconComponent = variantIcons[toast.variant];
          return (
            <div
              key={toast.id}
              role="status"
              className={clsx(
                'pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-sm',
                'animate-slide-in-right motion-reduce:animate-none',
                'w-80 max-w-[calc(100vw-3rem)]',
                variantStyles[toast.variant],
              )}
            >
              <IconComponent className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1 leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded p-0.5 opacity-70 transition-opacity duration-fast hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
