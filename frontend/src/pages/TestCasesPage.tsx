import { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { Plus, MoreVertical, Eye, Pencil, Copy, Trash2 } from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { BadgeVariant } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';

import {
  getTestCases,
  createTestCase,
  updateTestCase,
  getTestCase,
  cloneTestCase,
} from '@/api/testCases';
import type { GetTestCasesParams } from '@/api/testCases';

import type {
  TestCase,
  TestCaseDetail,
  TestStep,
  CreateTestCaseRequest,
  UpdateTestCaseRequest,
  Priority,
  TestCaseStatus,
  AutomationStatus,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BREADCRUMB_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Test Cases' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'archived', label: 'Archived' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const AUTOMATION_OPTIONS = [
  { value: '', label: 'All Automation' },
  { value: 'manual', label: 'Manual' },
  { value: 'automated', label: 'Automated' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'planned', label: 'Planned' },
];

const TYPE_OPTIONS = [
  { value: 'functional', label: 'Functional' },
  { value: 'regression', label: 'Regression' },
  { value: 'integration', label: 'Integration' },
  { value: 'performance', label: 'Performance' },
  { value: 'security', label: 'Security' },
  { value: 'smoke', label: 'Smoke' },
  { value: 'e2e', label: 'End-to-End' },
];

const FORM_PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const FORM_AUTOMATION_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'automated', label: 'Automated' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'planned', label: 'Planned' },
];

const PRIORITY_VARIANT_MAP: Record<Priority, BadgeVariant> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

const AUTOMATION_VARIANT_MAP: Record<AutomationStatus, BadgeVariant> = {
  automated: 'success',
  manual: 'neutral',
  hybrid: 'info',
  planned: 'warning',
};

const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface TestCaseFormState {
  name: string;
  description: string;
  type: string;
  application_id: string;
  priority: Priority;
  automation_status: AutomationStatus;
  preconditions: string;
  steps: TestStep[];
  expected_result: string;
  tags: string;
}

const EMPTY_STEP: TestStep = { step_number: 1, action: '', expected_result: '' };

function emptyForm(): TestCaseFormState {
  return {
    name: '',
    description: '',
    type: 'functional',
    application_id: '',
    priority: 'medium',
    automation_status: 'manual',
    preconditions: '',
    steps: [{ ...EMPTY_STEP }],
    expected_result: '',
    tags: '',
  };
}

interface FormErrors {
  name?: string;
  application_id?: string;
  type?: string;
}

function validateForm(form: TestCaseFormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.application_id.trim()) errors.application_id = 'Application ID is required';
  if (!form.type.trim()) errors.type = 'Type is required';
  return errors;
}

// ---------------------------------------------------------------------------
// TestCasesPage
// ---------------------------------------------------------------------------

export default function TestCasesPage() {
  const { addToast } = useToast();

  // ---- Data state ----
  const [data, setData] = useState<TestCase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Filter state ----
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [automationFilter, setAutomationFilter] = useState('');

  // ---- Modal state ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState<number>(0);
  const [form, setForm] = useState<TestCaseFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // ---- Fetch data ----
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetTestCasesParams = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (automationFilter) params.automation_status = automationFilter;

      const result = await getTestCases(params);
      setData(result.items ?? []);
      setTotal(result.total);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load test cases';
      setError(msg);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, priorityFilter, automationFilter]);

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

  // ---- Open create modal ----
  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setEditVersion(0);
    setForm(emptyForm());
    setFormErrors({});
    setModalOpen(true);
  }, []);

  // ---- Open edit modal ----
  const openEditModal = useCallback(async (id: string) => {
    try {
      const detail: TestCaseDetail = await getTestCase(id);
      setEditingId(id);
      setEditVersion(detail.version);
      setForm({
        name: detail.name,
        description: detail.description ?? '',
        type: detail.type,
        application_id: detail.application_id,
        priority: detail.priority,
        automation_status: detail.automation_status,
        preconditions: '',
        steps: detail.steps.length > 0 ? detail.steps : [{ ...EMPTY_STEP }],
        expected_result: '',
        tags: detail.tags.join(', '),
      });
      setFormErrors({});
      setModalOpen(true);
    } catch {
      addToast({ message: 'Failed to load test case details', variant: 'error' });
    }
  }, [addToast]);

  // ---- Clone ----
  const handleClone = useCallback(
    async (id: string) => {
      try {
        await cloneTestCase(id);
        addToast({ message: 'Test case cloned successfully', variant: 'success' });
        void fetchData();
      } catch {
        addToast({ message: 'Failed to clone test case', variant: 'error' });
      }
    },
    [addToast, fetchData],
  );

  // ---- Close modal ----
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setFormErrors({});
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

  // ---- Step management ----
  const handleStepChange = useCallback(
    (index: number, field: 'action' | 'expected_result', value: string) => {
      setForm((prev) => {
        const steps = [...prev.steps];
        steps[index] = { ...steps[index], [field]: value };
        return { ...prev, steps };
      });
    },
    [],
  );

  const addStep = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { step_number: prev.steps.length + 1, action: '', expected_result: '' },
      ],
    }));
  }, []);

  const removeStep = useCallback((index: number) => {
    setForm((prev) => {
      const steps = prev.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step_number: i + 1 }));
      return { ...prev, steps: steps.length > 0 ? steps : [{ ...EMPTY_STEP }] };
    });
  }, []);

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
        const tagsArray = form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

        if (editingId) {
          const payload: UpdateTestCaseRequest = {
            name: form.name,
            type: form.type,
            application_id: form.application_id,
            priority: form.priority,
            automation_status: form.automation_status,
            description: form.description || null,
            steps: form.steps,
            tags: tagsArray,
            version: editVersion,
          };
          await updateTestCase(editingId, payload);
          addToast({ message: 'Test case updated successfully', variant: 'success' });
        } else {
          const payload: CreateTestCaseRequest = {
            name: form.name,
            type: form.type,
            application_id: form.application_id,
            segment_id: '',
            owner: '',
            priority: form.priority,
            automation_status: form.automation_status,
            description: form.description || null,
            steps: form.steps,
            tags: tagsArray,
            evidence_requirements: [],
          };
          await createTestCase(payload);
          addToast({ message: 'Test case created successfully', variant: 'success' });
        }
        closeModal();
        void fetchData();
      } catch (err) {
        const msg =
          axios.isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : editingId
              ? 'Failed to update test case'
              : 'Failed to create test case';
        addToast({ message: msg, variant: 'error' });
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingId, editVersion, addToast, closeModal, fetchData],
  );

  // ---- Columns ----
  const columns: Column<TestCase>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (_v, row) => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (_v, row) => (
        <span className="capitalize">{row.type.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      render: (_v, row) => (
        <StatusBadge
          status={row.priority}
          variant={PRIORITY_VARIANT_MAP[row.priority]}
          size="sm"
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (_v, row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'automation_status',
      header: 'Automation',
      sortable: true,
      render: (_v, row) => (
        <StatusBadge
          status={row.automation_status}
          variant={AUTOMATION_VARIANT_MAP[row.automation_status]}
          size="sm"
        />
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
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
            {
              label: 'Clone',
              icon: Copy,
              onClick: () => void handleClone(row.id),
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
          <h1 className="text-2xl font-semibold text-foreground">Test Cases</h1>
          <Button variant="primary" size="md" onClick={openCreateModal}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
            Create Test Case
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Status"
            name="statusFilter"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Priority"
            name="priorityFilter"
            options={PRIORITY_OPTIONS}
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Automation"
            name="automationFilter"
            options={AUTOMATION_OPTIONS}
            value={automationFilter}
            onChange={(e) => {
              setAutomationFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {/* Data table */}
      <DataTable<TestCase>
        data={data}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchData}
        searchable
        searchPlaceholder="Search test cases…"
        onSearch={handleSearch}
        pagination={{
          page,
          page_size: pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
        emptyMessage="No test cases"
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Edit Test Case' : 'Create Test Case'}
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
              placeholder="Enter test case name"
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
              placeholder="Describe the test case"
            />
          </FormField>

          {/* Type + Application ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Type"
              name="type"
              options={TYPE_OPTIONS}
              value={form.type}
              onChange={handleFieldChange}
              required
              error={formErrors.type}
            />
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
          </div>

          {/* Priority + Automation Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Priority"
              name="priority"
              options={FORM_PRIORITY_OPTIONS}
              value={form.priority}
              onChange={handleFieldChange}
              required
            />
            <Select
              label="Automation Status"
              name="automation_status"
              options={FORM_AUTOMATION_OPTIONS}
              value={form.automation_status}
              onChange={handleFieldChange}
            />
          </div>

          {/* Preconditions */}
          <FormField label="Preconditions" name="preconditions">
            <textarea
              id="preconditions"
              name="preconditions"
              value={form.preconditions}
              onChange={handleFieldChange}
              rows={2}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast resize-y"
              placeholder="Any preconditions for this test case"
            />
          </FormField>

          {/* Steps */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Test Steps
            </legend>
            {form.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 border border-border rounded-md p-3 bg-surface"
              >
                <span className="mt-2 text-xs font-mono text-foreground-muted tabular-nums w-6 text-center flex-shrink-0">
                  {step.step_number}
                </span>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={step.action}
                    onChange={(e) => handleStepChange(idx, 'action', e.target.value)}
                    placeholder="Action"
                    aria-label={`Step ${step.step_number} action`}
                    className="w-full rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                  />
                  <input
                    type="text"
                    value={step.expected_result}
                    onChange={(e) =>
                      handleStepChange(idx, 'expected_result', e.target.value)
                    }
                    placeholder="Expected result"
                    aria-label={`Step ${step.step_number} expected result`}
                    className="w-full rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  className="mt-2 p-1 rounded text-foreground-muted hover:text-error hover:bg-error-light transition-colors duration-fast"
                  aria-label={`Remove step ${step.step_number}`}
                >
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addStep}>
              <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
              Add Step
            </Button>
          </fieldset>

          {/* Expected Result */}
          <FormField label="Expected Result" name="expected_result">
            <textarea
              id="expected_result"
              name="expected_result"
              value={form.expected_result}
              onChange={handleFieldChange}
              rows={2}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast resize-y"
              placeholder="Overall expected result"
            />
          </FormField>

          {/* Tags */}
          <FormField
            label="Tags"
            name="tags"
            hint="Comma-separated (e.g. login, smoke, regression)"
          >
            <input
              id="tags"
              name="tags"
              type="text"
              value={form.tags}
              onChange={handleFieldChange}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              placeholder="login, smoke, regression"
            />
          </FormField>

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
