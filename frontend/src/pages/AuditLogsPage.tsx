import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import { FileText } from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { Column, DataTablePagination } from '@/components/ui/DataTable';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';

import { getAuditLogs } from '@/api/auditLogs';
import type { AuditLog } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BREADCRUMBS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Audit Logs' },
];

const PAGE_SIZE = 20;

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'export', label: 'Export' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function actionVariant(
  action: string,
): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  const lower = action.toLowerCase();
  if (lower === 'create') return 'success';
  if (lower === 'update') return 'warning';
  if (lower === 'delete') return 'error';
  if (lower === 'login' || lower === 'logout') return 'info';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// AuditLogsPage
// ---------------------------------------------------------------------------

function AuditLogsPage() {
  // ---- Data state ----
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Filter state ----
  const [userId, setUserId] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // ---- Fetch logs ----
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: {
        page?: number;
        page_size?: number;
        user_id?: string;
        action?: string;
        from_date?: string;
        to_date?: string;
      } = {
        page,
        page_size: pageSize,
      };
      if (userId.trim()) params.user_id = userId.trim();
      if (actionFilter) params.action = actionFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const res = await getAuditLogs(params);
      setLogs(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? err.message);
      } else {
        setError('Failed to load audit logs');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, userId, actionFilter, fromDate, toDate]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // ---- Reset filters ----
  const resetFilters = useCallback(() => {
    setUserId('');
    setActionFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  }, []);

  const hasActiveFilters = userId || actionFilter || fromDate || toDate;

  // ---- Columns ----
  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (val) => (
        <span className="font-mono text-xs tabular-nums text-foreground-muted whitespace-nowrap">
          {formatTimestamp(String(val ?? ''))}
        </span>
      ),
    },
    {
      key: 'user_name',
      header: 'User',
      sortable: true,
      render: (val) => (
        <span className="font-medium text-foreground">{String(val ?? '—')}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (val) => {
        const action = String(val ?? '');
        return (
          <StatusBadge
            status={action}
            variant={actionVariant(action)}
            size="sm"
          />
        );
      },
    },
    {
      key: 'entity_type',
      header: 'Entity Type',
      sortable: true,
      render: (val) => (
        <span className="text-sm text-foreground">{String(val ?? '—')}</span>
      ),
    },
    {
      key: 'entity_id',
      header: 'Entity ID',
      render: (val) => (
        <span className="font-mono text-xs tabular-nums text-foreground-muted">
          {String(val ?? '—')}
        </span>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP Address',
      render: (val) => (
        <span className="font-mono text-xs tabular-nums text-foreground-muted">
          {String(val ?? '—')}
        </span>
      ),
    },
  ];

  // ---- Pagination ----
  const pagination: DataTablePagination = {
    page,
    page_size: pageSize,
    total,
    onPageChange: setPage,
    onPageSizeChange: (size) => {
      setPageSize(size);
      setPage(1);
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={BREADCRUMBS} />
        <div className="mt-4 flex items-center gap-3">
          <FileText
            size={24}
            strokeWidth={1.5}
            className="text-foreground-muted"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="border border-border rounded-md p-4 space-y-4 bg-surface">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField label="User ID" name="audit-user-id">
            <input
              id="audit-user-id"
              name="audit-user-id"
              type="text"
              value={userId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setUserId(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by user ID…"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
            />
          </FormField>

          <Select
            label="Action"
            name="audit-action"
            options={ACTION_OPTIONS}
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          />

          <FormField label="From Date" name="audit-from-date">
            <input
              id="audit-from-date"
              name="audit-from-date"
              type="date"
              value={fromDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
            />
          </FormField>

          <FormField label="To Date" name="audit-to-date">
            <input
              id="audit-to-date"
              name="audit-to-date"
              type="date"
              value={toDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
            />
          </FormField>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <DataTable<AuditLog>
        data={logs}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchLogs}
        pagination={pagination}
        emptyMessage="No audit logs found"
      />
    </div>
  );
}

export default AuditLogsPage;
