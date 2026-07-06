import {
  useState,
  useRef,
  useId,
  useCallback,
  cloneElement,
} from 'react';
import type { ReactElement } from 'react';
import clsx from 'clsx';

export interface TooltipProps {
  /** Tooltip text content */
  content: string;
  /** The trigger element */
  children: ReactElement;
  /** Tooltip position relative to the trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const positionMap: Record<NonNullable<TooltipProps['position']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

function Tooltip({
  content,
  children,
  position = 'top',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, 100);
  }, []);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {cloneElement(children, {
        'aria-describedby': visible ? tooltipId : undefined,
      })}

      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={clsx(
            'absolute z-50 whitespace-nowrap rounded px-2 py-1 text-xs font-medium',
            'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
            'pointer-events-none animate-none motion-reduce:animate-none',
            positionMap[position],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export { Tooltip };
