import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import {
  Play,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';
import type {
  TestExecution,
  TestExecutionDetail,
  ExecutionStatus,
  CreateTestExecutionRequest,
} from '@/types';
import {
  getTestExecutions,
  getTestExecution,
  createTestExecution,
} from '@/api/testExecutions';
import type { GetTestExecutionsParams } from '@/api/testExecutions';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column, DataTablePagination } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Alert } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/ToastProvider';

// ---------------------------------------------------------------------------
// TestExecutionsPage — list, create, and inspect test executions.
// ---------------------------------------------------------------------------

const PAGE_SIZE_DEFAULT = 20;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'error', label: 'Error' },
];

const ENVIRONMENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'dev', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// List columns
// ---------------------------------------------------------------------------

const columns: Column<TestExecution>[] = [
  {
    key: 'test_suite_name',
    header: 'Suite Name',
    sortable: true,
  },
  {
    key: 'environment_id',
    header: 'Environment',
    sortable: true,
    render: (val) => {
      const v = String(val ?? '');
      const label =
        ENVIRONMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;
      return <span className="capitalize">{label}</span>;
    },
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (val) => <StatusBadge status={String(val ?? '')} />,
  },
  {
    key: 'pass_count',
    header: 'Passed',
    sortable: true,
    render: (val) => (
      <span className="font-mono tabular-nums text-success">
        {String(val ?? 0)}
      </span>
    ),
  },
  {
    key: 'fail_count',
    header: 'Failed',
    sortable: true,
    render: (val) => (
      <span className="font-mono tabular-nums text-error">
        {String(val ?? 0)}
      </span>
    ),
  },
  {
    key: 'total_count',
    header: 'Total',
    sortable: true,
    render: (val) => (
      <span className="font-mono tabular-nums">{String(val ?? 0)}</span>
    ),
  },
  {
    key: 'duration',
    header: 'Duration',
    sortable: true,
    render: (val) => (
      <span className="font-mono tabular-nums">
        {formatDuration(Number(val ?? 0))}
      </span>
    ),
  },
  {
    key: 'executed_by',
    header: 'Executed By',
    sortable: true,
  },
  {
    key: 'created_at',
    header: 'Date',
    sortable: true,
    render: (val) => (
      <span className="whitespace-nowrap">{formatDate(String(val ?? ''))}</span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Create Execution form state
// ---------------------------------------------------------------------------

interface CreateFormState {
  test_suite_id: string;
  application_id: string;
  environment_id: string;
  release_id: string;
}

const INITIAL_FORM: CreateFormState = {
  test_suite_id: '',
  application_id: '',
  environment_id: '',
  release_id: '',
};

// ---------------------------------------------------------------------------
// Detail panel — stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-foreground-muted">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TestExecutionsPage() {
  const { addToast } = useToast();

  // ---- List state ----
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Filters ----
  const [statusFilter, setStatusFilter] = useState('');
  const [appFilter, setAppFilter] = useState('');
  const [releaseFilter, setReleaseFilter] = useState('');

  // ---- Create modal ----
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreateFormState, string>>>({});
  const [creating, setCreating] = useState(false);

  // ---- Detail view ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TestExecutionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ---- Fetch list ----
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetTestExecutionsParams = {
        page,
        page_size: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (appFilter) params.application_id = appFilter;
      if (releaseFilter) params.release_id = releaseFilter;

      const res = await getTestExecutions(params);
      setExecutions(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load test executions.';
      setError(msg);
      setExecutions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, appFilter, releaseFilter]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // ---- Fetch detail ----
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await getTestExecution(id);
      setDetail(res as TestExecutionDetail);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load execution details.';
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleRowClick = useCallback(
    (row: TestExecution) => {
      setSelectedId(row.id);
      void fetchDetail(row.id);
    },
    [fetchDetail],
  );

  const handleBackToList = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  // ---- Create form handlers ----
  const handleFormChange = useCallback(
    (field: keyof CreateFormState) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [],
  );

  const validateForm = useCallback((): boolean => {
    const errs: Partial<Record<keyof CreateFormState, string>> = {};
    if (!form.test_suite_id.trim()) errs.test_suite_id = 'Test suite is required';
    if (!form.application_id.trim()) errs.application_id = 'Application is required';
    if (!form.environment_id) errs.environment_id = 'Environment is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validateForm()) return;

      setCreating(true);
      try {
        const payload: CreateTestExecutionRequest = {
          test_suite_id: form.test_suite_id,
          application_id: form.application_id,
          environment_id: form.environment_id,
          trigger_type: 'manual',
        };
        if (form.release_id.trim()) {
          payload.release_id = form.release_id;
        }
        await createTestExecution(payload);
        addToast({ message: 'Test execution created successfully.', variant: 'success' });
        setShowCreate(false);
        setForm(INITIAL_FORM);
        setFormErrors({});
        void fetchList();
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : 'Failed to create test execution.';
        addToast({ message: msg, variant: 'error' });
      } finally {
        setCreating(false);
      }
    },
    [form, validateForm, addToast, fetchList],
  );

  const handleCloseCreate = useCallback(() => {
    setShowCreate(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

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

  // ---- Detail view ----
  if (selectedId) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Test Executions', href: '/test-executions' },
            { label: detail?.test_suite_name ?? 'Execution Detail' },
          ]}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToList}
            className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors duration-fast"
          >
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            Back to list
          </button>
        </div>

        {detailLoading && (
          <Card padding="lg">
            <div className="space-y-4">
              <Skeleton height="24px" width="40%" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} height="72px" />
                ))}
              </div>
              <Skeleton height="200px" />
            </div>
          </Card>
        )}

        {detailError && (
          <Alert variant="error" onDismiss={() => setDetailError(null)}>
            {detailError}
          </Alert>
        )}

        {!detailLoading && !detailError && detail && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {detail.test_suite_name}
              </h1>
              <p className="text-sm text-foreground-muted">
                Execution ID: <span className="font-mono">{detail.id}</span>
              </p>
            </div>

            {/* Status + meta */}
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={detail.status} />
              <span className="text-sm text-foreground-muted">
                {ENVIRONMENT_OPTIONS.find((o) => o.value === detail.environment_id)?.label ??
                  detail.environment_id}
              </span>
              <span className="text-sm text-foreground-muted">
                {formatDate(detail.start_time)}
              </span>
              {detail.end_time && (
                <span className="text-sm text-foreground-muted">
                  Duration: {formatDuration(detail.duration)}
                </span>
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <StatCard
                label="Passed"
                value={detail.pass_count}
                icon={<CheckCircle2 size={18} strokeWidth={1.5} aria-hidden="true" />}
                color="bg-success-light text-success"
              />
              <StatCard
                label="Failed"
                value={detail.fail_count}
                icon={<XCircle size={18} strokeWidth={1.5} aria-hidden="true" />}
                color="bg-error-light text-error"
              />
              <StatCard
                label="Blocked"
                value={detail.blocked_count ?? 0}
                icon={<Ban size={18} strokeWidth={1.5} aria-hidden="true" />}
                color="bg-warning-light text-warning"
              />
              <StatCard
                label="Skipped"
                value={detail.skipped_count ?? 0}
                icon={<SkipForward size={18} strokeWidth={1.5} aria-hidden="true" />}
                color="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
              />
              <StatCard
                label="Total"
                value={detail.total_count}
                icon={<Clock size={18} strokeWidth={1.5} aria-hidden="true" />}
                color="bg-info-light text-info"
              />
            </div>

            {/* Failure reason */}
            {detail.failure_reason && (
              <Card padding="md">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={20}
                    strokeWidth={1.5}
                    className="mt-0.5 flex-shrink-0 text-error"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">Failure Reason</p>
                    <p className="mt-1 text-sm text-foreground-muted">{detail.failure_reason}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* AI analysis */}
            {detail.ai_failure_analysis && (
              <Card padding="md">
                <p className="text-sm font-medium text-foreground mb-2">AI Failure Analysis</p>
                <p className="text-sm text-foreground-muted">{detail.ai_failure_analysis}</p>
                {detail.recommended_remediation && (
                  <>
                    <p className="text-sm font-medium text-foreground mt-4 mb-1">
                      Recommended Remediation
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {detail.recommended_remediation}
                    </p>
                  </>
                )}
              </Card>
            )}

            {/* Metadata */}
            <Card padding="md">
              <h3 className="text-sm font-medium text-foreground mb-3">Execution Metadata</h3>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div>
                  <dt className="text-foreground-muted">Executed By</dt>
                  <dd className="font-medium text-foreground">{detail.executed_by}</dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Trigger Type</dt>
                  <dd className="font-medium text-foreground capitalize">{detail.trigger_type}</dd>
                </div>
                <div>
                  <dt className="text-foreground-muted">Application ID</dt>
                  <dd className="font-mono text-foreground">{detail.application_id}</dd>
                </div>
                {detail.release_id && (
                  <div>
                    <dt className="text-foreground-muted">Release ID</dt>
                    <dd className="font-mono text-foreground">{detail.release_id}</dd>
                  </div>
                )}
                {detail.build_number && (
                  <div>
                    <dt className="text-foreground-muted">Build Number</dt>
                    <dd className="font-mono text-foreground">{detail.build_number}</dd>
                  </div>
                )}
                {detail.commit_id && (
                  <div>
                    <dt className="text-foreground-muted">Commit ID</dt>
                    <dd className="font-mono text-foreground">{detail.commit_id}</dd>
                  </div>
                )}
                {detail.pipeline_reference && (
                  <div>
                    <dt className="text-foreground-muted">Pipeline Reference</dt>
                    <dd className="font-mono text-foreground">{detail.pipeline_reference}</dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* Evidence IDs */}
            {detail.evidence_ids && detail.evidence_ids.length > 0 && (
              <Card padding="md">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Evidence ({detail.evidence_ids.length})
                </h3>
                <ul className="space-y-1">
                  {detail.evidence_ids.map((eid) => (
                    <li key={eid} className="text-sm font-mono text-foreground-muted">
                      {eid}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Defects */}
            {detail.defects_created && detail.defects_created.length > 0 && (
              <Card padding="md">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Defects Created ({detail.defects_created.length})
                </h3>
                <ul className="space-y-1">
                  {detail.defects_created.map((did) => (
                    <li key={did} className="text-sm font-mono text-foreground-muted">
                      {did}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {!detailLoading && !detailError && !detail && (
          <EmptyState
            icon={Play}
            title="Execution not found"
            description="The requested test execution could not be loaded."
          />
        )}
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Test Executions' },
        ]}
      />

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Test Executions
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            View and manage test execution runs across environments.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setShowCreate(true)}
        >
          <Play size={16} strokeWidth={1.5} aria-hidden="true" />
          New Execution
        </Button>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Status"
            name="filter-status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          />
          <FormField label="Application ID" name="filter-app">
            <input
              id="filter-app"
              name="filter-app"
              type="text"
              value={appFilter}
              onChange={(e) => {
                setAppFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by application…"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </FormField>
          <FormField label="Release ID" name="filter-release">
            <input
              id="filter-release"
              name="filter-release"
              type="text"
              value={releaseFilter}
              onChange={(e) => {
                setReleaseFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by release…"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </FormField>
        </div>
      </Card>

      {/* Data table */}
      <DataTable<TestExecution>
        data={executions}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchList}
        pagination={pagination}
        emptyMessage="No test executions"
        onRowClick={handleRowClick}
      />

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={handleCloseCreate}
        title="New Test Execution"
        size="md"
      >
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-5">
          <FormField
            label="Test Suite ID"
            name="create-suite"
            required
            error={formErrors.test_suite_id}
          >
            <input
              id="create-suite"
              name="create-suite"
              type="text"
              value={form.test_suite_id}
              onChange={handleFormChange('test_suite_id')}
              disabled={creating}
              aria-required="true"
              aria-invalid={!!formErrors.test_suite_id || undefined}
              aria-describedby={formErrors.test_suite_id ? 'create-suite-error' : undefined}
              placeholder="Enter test suite ID"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
            />
          </FormField>

          <FormField
            label="Application ID"
            name="create-app"
            required
            error={formErrors.application_id}
          >
            <input
              id="create-app"
              name="create-app"
              type="text"
              value={form.application_id}
              onChange={handleFormChange('application_id')}
              disabled={creating}
              aria-required="true"
              aria-invalid={!!formErrors.application_id || undefined}
              aria-describedby={formErrors.application_id ? 'create-app-error' : undefined}
              placeholder="Enter application ID"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
            />
          </FormField>

          <Select
            label="Environment"
            name="create-env"
            options={ENVIRONMENT_OPTIONS}
            value={form.environment_id}
            onChange={handleFormChange('environment_id')}
            required
            error={formErrors.environment_id}
            placeholder="Select environment"
            disabled={creating}
          />

          <FormField label="Release ID" name="create-release" hint="Optional">
            <input
              id="create-release"
              name="create-release"
              type="text"
              value={form.release_id}
              onChange={handleFormChange('release_id')}
              disabled={creating}
              placeholder="Enter release ID (optional)"
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleCloseCreate}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={creating}>
              Create Execution
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TestExecutionsPage;
