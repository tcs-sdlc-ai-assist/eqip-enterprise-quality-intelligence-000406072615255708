import { ChevronRight } from 'lucide-react';
import type React from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="h-4 w-4 text-foreground-muted flex-shrink-0"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              )}
              {isLast || !item.href ? (
                <span
                  className={
                    isLast
                      ? 'text-foreground font-medium'
                      : 'text-foreground-muted'
                  }
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="text-foreground-muted hover:text-foreground transition-colors duration-fast"
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export { Breadcrumb };
export type { BreadcrumbProps, BreadcrumbItem };
