import { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { Plus, MoreVertical, Pencil, Eye, X, Search } from 'lucide-react';

import apiClient from '@/api/client';
import { getTestCases } from '@/api/testCases';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';

import type {
  TestSuite,
  TestCase,
  CreateTestSuiteRequest,
  UpdateTestSuiteRequest,
  PaginatedResponse,
} from '@/types';

// ---------------------------------------------------------------------------
// Inline API helpers (no testSuites API module exists yet)
// ---------------------------------------------------------------------------

interface GetTestSuitesParams {
  page?: number;
  page_size?: number;
  search?: string;
  application_id?: string;
}

async function getTestSuites(
  params?: GetTestSuitesParams,
): Promise<PaginatedResponse<TestSuite>> {
  const response = await apiClient.get<PaginatedResponse<TestSuite>>(
    '/test-suites',
    { params },
  );
  return response.data;
}

async function getTestSuite(id: string): Promise<TestSuite> {
  const response = await apiClient.get<TestSuite>(`/test-suites/${id}`);
  return response.data;
}

async function createTestSuiteApi(
  data: CreateTestSuiteRequest,
): Promise<TestSuite> {
  const response = await apiClient.post<TestSuite>('/test-suites', data);
  return response.data;
}

async function updateTestSuiteApi(
  id: string,
  data: UpdateTestSuiteRequest,
): Promise<TestSuite> {
  const response = await apiClient.put<TestSuite>(`/test-suites/${id}`, data);
  return response.data;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BREADCRUMB_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Test Suites' },
];

const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface TestSuiteFormState {
  name: string;
  description: string;
  application_id: string;
  test_case_ids: string[];
}

function emptyForm(): TestSuiteFormState {
  return {
    name: '',
    description: '',
    application_id: '',
    test_case_ids: [],
  };
}

interface FormErrors {
  name?: string;
  application_id?: string;
}

function validateForm(form: TestSuiteFormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.application_id.trim()) errors.application_id = 'Application ID is required';
  return errors;
}

// ---------------------------------------------------------------------------
// TestSuitesPage
// ---------------------------------------------------------------------------

export default function TestSuitesPage() {
  const { addToast } = useToast();

  // ---- Data state ----
  const [data, setData] = useState<TestSuite[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Search ----
  const [search, setSearch] = useState('');

  // ---- Modal state ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<number>(0);
  const [form, setForm] = useState<TestSuiteFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // ---- Test case picker state ----
  const [tcSearch, setTcSearch] = useState('');
  const [tcResults, setTcResults] = useState<TestCase[]>([]);
  const [tcLoading, setTcLoading] = useState(false);

  // ---- Fetch suites ----
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetTestSuitesParams = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;

      const result = await getTestSuites(params);
      setData(result.items ?? []);
      setTotal(result.total);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load test suites';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ---- Search handler ----
  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  // ---- Page size change ----
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  // ---- Test case search for picker ----
  const searchTestCases = useCallback(async (query: string) => {
    setTcSearch(query);
    if (!query.trim()) {
      setTcResults([]);
      return;
    }
    setTcLoading(true);
    try {
      const result = await getTestCases({ search: query, page_size: 20 });
      setTcResults(result.items ?? []);
    } catch {
      setTcResults([]);
    } finally {
      setTcLoading(false);
    }
  }, []);

  const addTestCaseId = useCallback((id: string) => {
    setForm((prev) => {
      if (prev.test_case_ids.includes(id)) return prev;
      return { ...prev, test_case_ids: [...prev.test_case_ids, id] };
    });
  }, []);

  const removeTestCaseId = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      test_case_ids: prev.test_case_ids.filter((tcId) => tcId !== id),
    }));
  }, []);

  // ---- Open create modal ----
  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setEditVersion(0);
    setForm(emptyForm());
    setFormErrors({});
    setTcSearch('');
    setTcResults([]);
    setModalOpen(true);
  }, []);

  // ---- Open edit modal ----
  const openEditModal = useCallback(
    async (id: string) => {
      try {
        const detail = await getTestSuite(id);
        setEditingId(id);
        setEditVersion(0);
        setForm({
          name: detail.name,
          description: '',
          application_id: detail.application_id,
          test_case_ids: [],
        });
        setFormErrors({});
        setTcSearch('');
        setTcResults([]);
        setModalOpen(true);
      } catch {
        addToast({ message: 'Failed to load test suite details', variant: 'error' });
      }
    },
    [addToast],
  );

  // ---- Close modal ----
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setFormErrors({});
    setTcSearch('');
    setTcResults([]);
  }, []);

  // ---- Form field handlers ----
  const handleFieldChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    },
    [],
  );

  // ---- Submit ----
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const errors = validateForm(form);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      setSubmitting(true);
      try {
        if (editingId) {
          const payload: UpdateTestSuiteRequest = {
            name: form.name,
            application_id: form.application_id,
            description: form.description || null,
            test_case_ids: form.test_case_ids,
            version: editVersion,
          };
          await updateTestSuiteApi(editingId, payload);
          addToast({ message: 'Test suite updated successfully', variant: 'success' });
        } else {
          const payload: CreateTestSuiteRequest = {
            name: form.name,
            application_id: form.application_id,
            segment_id: '',
            owner: '',
            description: form.description || null,
            test_case_ids: form.test_case_ids,
            environment_requirements: [],
            test_data_requirements: [],
          };
          await createTestSuiteApi(payload);
          addToast({ message: 'Test suite created successfully', variant: 'success' });
        }
        closeModal();
        void fetchData();
      } catch (err) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : editingId
              ? 'Failed to update test suite'
              : 'Failed to create test suite';
        addToast({ message: msg, variant: 'error' });
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingId, editVersion, addToast, closeModal, fetchData],
  );

  // ---- Columns ----
  const columns: Column<TestSuite>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (_v, row) => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'application_id',
      header: 'Application',
      sortable: true,
    },
    {
      key: 'test_case_count',
      header: 'Test Cases',
      sortable: true,
      render: (_v, row) => (
        <span className="font-mono tabular-nums text-foreground">
          {row.test_case_count}
        </span>
      ),
    },
    {
      key: 'last_execution_result',
      header: 'Status',
      sortable: false,
      render: (_v, row) =>
        row.last_execution_result ? (
          <StatusBadge status={row.last_execution_result} size="sm" />
        ) : (
          <span className="text-foreground-muted text-sm">—</span>
        ),
    },
    {
      key: 'pass_rate',
      header: 'Pass Rate',
      sortable: true,
      render: (_v, row) => (
        <span className="font-mono tabular-nums text-foreground">
          {row.pass_rate}%
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (_v, row) => (
        <DropdownMenu
          trigger={
            <button
              type="button"
              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors duration-fast"
              aria-label={`Actions for ${row.name}`}
            >
              <MoreVertical size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          }
          items={[
            {
              label: 'View',
              icon: Eye,
              onClick: () => void openEditModal(row.id),
            },
            {
              label: 'Edit',
              icon: Pencil,
              onClick: () => void openEditModal(row.id),
            },
          ]}
        />
      ),
    },
  ];

  // ---- Render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={BREADCRUMB_ITEMS} />
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground">Test Suites</h1>
          <Button variant="primary" size="md" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Create Test Suite
          </Button>
        </div>
      </div>

      {/* Data table */}
      <DataTable<TestSuite>
        data={data}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchData}
        searchable
        searchPlaceholder="Search test suites…"
        onSearch={handleSearch}
        pagination={{
          page,
          page_size: pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        emptyMessage="No test suites"
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Test Suite' : 'Create Test Suite'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <FormField label="Name" name="name" required error={formErrors.name}>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleFieldChange}
              required
              aria-required="true"
              aria-invalid={formErrors.name ? true : undefined}
              aria-describedby={formErrors.name ? 'name-error' : undefined}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              placeholder="Enter test suite name"
            />
          </FormField>

          {/* Description */}
          <FormField label="Description" name="description">
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleFieldChange}
              rows={3}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast resize-y"
              placeholder="Describe the test suite"
            />
          </FormField>

          {/* Application ID */}
          <FormField
            label="Application ID"
            name="application_id"
            required
            error={formErrors.application_id}
          >
            <input
              id="application_id"
              name="application_id"
              type="text"
              value={form.application_id}
              onChange={handleFieldChange}
              required
              aria-required="true"
              aria-invalid={formErrors.application_id ? true : undefined}
              aria-describedby={
                formErrors.application_id ? 'application_id-error' : undefined
              }
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              placeholder="e.g. app-001"
            />
          </FormField>

          {/* Test Cases Picker */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Test Cases
            </legend>

            {/* Search input */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted pointer-events-none"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <input
                type="text"
                value={tcSearch}
                onChange={(e) => void searchTestCases(e.target.value)}
                placeholder="Search test cases to add…"
                aria-label="Search test cases to add"
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              />
            </div>

            {/* Search results */}
            {tcSearch.trim() && (
              <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                {tcLoading && (
                  <p className="px-3 py-2 text-sm text-foreground-muted">
                    Searching…
                  </p>
                )}
                {!tcLoading && tcResults.length === 0 && (
                  <p className="px-3 py-2 text-sm text-foreground-muted">
                    No test cases found
                  </p>
                )}
                {!tcLoading &&
                  tcResults.map((tc) => {
                    const isAdded = form.test_case_ids.includes(tc.id);
                    return (
                      <button
                        key={tc.id}
                        type="button"
                        disabled={isAdded}
                        onClick={() => addTestCaseId(tc.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-surface-raised transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed border-b border-border last:border-b-0"
                      >
                        <span className="truncate">{tc.name}</span>
                        {isAdded ? (
                          <span className="text-xs text-foreground-muted ml-2 flex-shrink-0">
                            Added
                          </span>
                        ) : (
                          <Plus
                            size={14}
                            strokeWidth={1.5}
                            className="ml-2 flex-shrink-0 text-primary-600"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Selected test case IDs */}
            {form.test_case_ids.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.test_case_ids.map((tcId) => (
                  <span
                    key={tcId}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-foreground"
                  >
                    <span className="font-mono tabular-nums truncate max-w-[120px]">
                      {tcId}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTestCaseId(tcId)}
                      className="p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors duration-fast"
                      aria-label={`Remove test case ${tcId}`}
                    >
                      <X size={12} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {form.test_case_ids.length === 0 && (
              <p className="text-xs text-foreground-muted">
                Search and add test cases above
              </p>
            )}
          </fieldset>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
