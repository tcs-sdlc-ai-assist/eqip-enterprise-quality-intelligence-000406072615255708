import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

function buildPageRange(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) {
    pages.push('ellipsis');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < totalPages - 2) {
    pages.push('ellipsis');
  }

  pages.push(totalPages);

  return pages;
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const pages = buildPageRange(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
      {/* Showing X-Y of N */}
      <p className="text-sm text-foreground-muted font-mono tabular-nums">
        Showing{' '}
        <span className="font-medium text-foreground">{startItem}</span>
        –
        <span className="font-medium text-foreground">{endItem}</span>
        {' '}of{' '}
        <span className="font-medium text-foreground">{total}</span>
      </p>

      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="page-size-select"
              className="text-sm text-foreground-muted"
            >
              Rows
            </label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-border rounded bg-surface text-foreground text-sm py-1 px-2 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page navigation */}
        <nav aria-label="Pagination" className="flex items-center gap-1">
          {/* Previous */}
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>

          {/* Page numbers */}
          {pages.map((p, idx) =>
            p === 'ellipsis' ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-1 text-sm text-foreground-muted select-none"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={clsx(
                  'min-w-[32px] h-8 rounded text-sm font-medium transition-colors duration-fast tabular-nums',
                  p === page
                    ? 'bg-primary-600 text-white'
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-raised',
                )}
              >
                {p}
              </button>
            ),
          )}

          {/* Next */}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="p-1.5 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
};

export { Pagination };
export type { PaginationProps };
