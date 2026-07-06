import clsx from 'clsx';
import { AlertTriangle, ArrowDown, ArrowUp, Database, RefreshCw, SearchX } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import { SearchBar } from './SearchBar';

// ---------------------------------------------------------------------------
// Column definition — generic over the row type T
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
}

// ---------------------------------------------------------------------------
// DataTable props
// ---------------------------------------------------------------------------

export interface DataTablePagination {
  page: number;
  page_size: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  pagination?: DataTablePagination;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortDirection = 'ascending' | 'descending';

interface SortState<T> {
  key: keyof T & string;
  direction: SortDirection;
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-3 px-4">
        <div className="h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
      </td>
    ))}
  </tr>
);

// ---------------------------------------------------------------------------
// DataTable component
// ---------------------------------------------------------------------------

function DataTableInner<T>(
  props: DataTableProps<T>,
): React.ReactElement {
  const {
    data,
    columns,
    loading = false,
    error = null,
    onRetry,
    searchable = false,
    searchPlaceholder = 'Search…',
    onSearch,
    pagination,
    emptyMessage = 'No data',
    onRowClick,
  } = props;

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState<T> | null>(null);

  // ---- Search handler ----
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      onSearch?.(query);
    },
    [onSearch],
  );

  // ---- Sort handler ----
  const handleSort = useCallback(
    (key: keyof T & string) => {
      setSort((prev) => {
        if (prev?.key === key) {
          return prev.direction === 'ascending'
            ? { key, direction: 'descending' }
            : null;
        }
        return { key, direction: 'ascending' };
      });
    },
    [],
  );

  // ---- Sorted data (client-side) ----
  const sortedData = useMemo(() => {
    if (!sort) return data;
    const sorted = [...data].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      return String(aVal).localeCompare(String(bVal));
    });
    return sort.direction === 'descending' ? sorted.reverse() : sorted;
  }, [data, sort]);

  // ---- Aria sort value ----
  const ariaSortValue = (key: keyof T & string): 'ascending' | 'descending' | 'none' => {
    if (sort?.key === key) return sort.direction;
    return 'none';
  };

  // ---- Error state ----
  if (error) {
    return (
      <div className="space-y-4">
        {searchable && (
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            placeholder={searchPlaceholder}
            className="max-w-sm"
          />
        )}
        <div
          className="bg-error-light text-error border border-error/20 rounded-md p-4 text-sm"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="h-5 w-5 flex-shrink-0 mt-0.5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-1 text-sm opacity-90">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-error hover:underline"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Empty states ----
  const isEmpty = !loading && sortedData.length === 0;
  const isFilteredEmpty = isEmpty && searchQuery.length > 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      {searchable && (
        <SearchBar
          value={searchQuery}
          onChange={handleSearch}
          placeholder={searchPlaceholder}
          className="max-w-sm"
        />
      )}

      {/* Table wrapper — horizontal scroll on small screens */}
      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-raised">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={col.sortable ? ariaSortValue(col.key) : undefined}
                  className={clsx(
                    'text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-4 select-none',
                    col.sortable && 'cursor-pointer hover:text-foreground transition-colors duration-fast',
                    col.className,
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sort?.key === col.key && (
                      sort.direction === 'ascending' ? (
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={`skeleton-${i}`} cols={columns.length} />
              ))}

            {/* Data rows */}
            {!loading &&
              sortedData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx(
                    'border-b border-border transition-colors duration-fast',
                    onRowClick && 'cursor-pointer',
                    'hover:bg-surface-raised',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx('py-3 px-4 text-sm text-foreground', col.className)}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>

        {/* Empty states inside the bordered container */}
        {isEmpty && !isFilteredEmpty && (
          <EmptyState
            icon={Database}
            title={emptyMessage}
            description="There are no records to display yet."
          />
        )}
        {isFilteredEmpty && (
          <EmptyState
            icon={SearchX}
            title="No results match your filters"
            description="Try adjusting your search or filter criteria."
          />
        )}
      </div>

      {/* Pagination */}
      {pagination && !isEmpty && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.page_size}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]}
        />
      )}
    </div>
  );
}

// Wrap in a named const for export (React.FC-style)
const DataTable = DataTableInner;

export { DataTable };
