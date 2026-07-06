import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import type { ReactNode, KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  danger?: boolean;
}

export interface DropdownMenuProps {
  /** The element that triggers the menu */
  trigger: ReactNode;
  /** Menu items */
  items: DropdownMenuItem[];
  /** Horizontal alignment of the menu relative to the trigger */
  align?: 'left' | 'right';
}

function DropdownMenu({
  trigger,
  items,
  align = 'right',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        setActiveIndex(-1);
      }
      return !prev;
    });
  }, []);

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  /* ── Focus active item ── */
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < items.length - 1 ? prev + 1 : 0,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : items.length - 1,
          );
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < items.length) {
            items[activeIndex].onClick();
            close();
          }
          break;
        }
        case 'Tab': {
          close();
          break;
        }
        default:
          break;
      }
    },
    [isOpen, activeIndex, items, close],
  );

  const alignMap: Record<NonNullable<DropdownMenuProps['align']>, string> = {
    left: 'left-0',
    right: 'right-0',
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {trigger}
      </div>

      {/* Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={clsx(
            'absolute z-40 mt-1 min-w-[10rem] rounded-md border border-border bg-surface py-1 shadow-lg',
            'focus:outline-none',
            alignMap[align],
          )}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="menuitem"
                tabIndex={activeIndex === index ? 0 : -1}
                onClick={() => {
                  item.onClick();
                  close();
                }}
                className={clsx(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors duration-fast',
                  'focus:outline-none',
                  item.danger
                    ? 'text-error hover:bg-error-light focus:bg-error-light dark:hover:bg-error/10 dark:focus:bg-error/10'
                    : 'text-foreground hover:bg-surface-raised focus:bg-surface-raised',
                )}
              >
                {Icon && (
                  <Icon
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { DropdownMenu };
