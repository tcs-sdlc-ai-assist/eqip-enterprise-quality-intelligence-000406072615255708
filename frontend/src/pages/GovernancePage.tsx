import { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  Eye,
  Pencil,
  Plus,
  MoreVertical,
  X,
  ArrowLeft,
  FileText,
  Users,
  Scale,
  Clock,
} from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';

import {
  getGovernanceProcedures,
  getGovernanceProcedure,
  createGovernanceProcedure,
  updateGovernanceProcedure,
} from '@/api/governance';

import type {
  GovernanceProcedure,
  GovernanceProcedureDetail,
  CreateGovernanceProcedureRequest,
  UpdateGovernanceProcedureRequest,
  GovernanceStatus,
  EvidenceType,
  RoleEnum,
  QualityGateApplicability,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVIDENCE_TYPE_OPTIONS: EvidenceType[] = [
  'log',
  'screenshot',
  'video',
  'document',
  'report',
];

const ROLE_OPTIONS: RoleEnum[] = [
  'admin',
  'qa_manager',
  'qa_lead',
  'qa_engineer',
  'developer',
  'release_manager',
  'compliance_officer',
  'auditor',
  'viewer',
  'api_consumer',
];

const GOVERNANCE_STATUS_OPTIONS: { value: GovernanceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'deprecated', label: 'Deprecated' },
];

function capitalize(str: string): string {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  description: string;
  status: GovernanceStatus;
  tiers: number[];
  release_types: string[];
  required_evidence: EvidenceType[];
  required_approval: RoleEnum[];
  applicable_test_types: string[];
  compliance_rule: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  description: '',
  status: 'draft',
  tiers: [],
  release_types: [],
  required_evidence: [],
  required_approval: [],
  applicable_test_types: [],
  compliance_rule: '',
};

interface FormErrors {
  name?: string;
  description?: string;
  compliance_rule?: string;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.description.trim()) errors.description = 'Description is required';
  if (!form.compliance_rule.trim()) errors.compliance_rule = 'Compliance rule is required';
  return errors;
}

// ---------------------------------------------------------------------------
// Multi-select toggle helper
// ---------------------------------------------------------------------------

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ---------------------------------------------------------------------------
// GovernancePage
// ---------------------------------------------------------------------------

function GovernancePage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // ---- List state ----
  const [procedures, setProcedures] = useState<GovernanceProcedure[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Modal state ----
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProcedure, setEditingProcedure] = useState<GovernanceProcedureDetail | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ---- Detail state ----
  const [detailProcedure, setDetailProcedure] = useState<GovernanceProcedureDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ---- Applicability dynamic inputs ----
  const [tierInput, setTierInput] = useState<string>('');
  const [releaseTypeInput, setReleaseTypeInput] = useState<string>('');
  const [testTypeInput, setTestTypeInput] = useState<string>('');

  // ---- Fetch list ----
  const fetchProcedures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getGovernanceProcedures({ page, page_size: pageSize });
      setProcedures(res.items ?? []);
      setTotal(res.total);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? 'Failed to load governance procedures');
      } else {
        setError('Failed to load governance procedures');
      }
      setProcedures([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchProcedures();
  }, [fetchProcedures]);

  // ---- Fetch detail ----
  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await getGovernanceProcedure(id);
      setDetailProcedure(res as GovernanceProcedureDetail);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setDetailError(err.response?.data?.detail ?? 'Failed to load procedure details');
      } else {
        setDetailError('Failed to load procedure details');
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ---- Open create modal ----
  const openCreateModal = useCallback(() => {
    setEditingProcedure(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setTierInput('');
    setReleaseTypeInput('');
    setTestTypeInput('');
    setModalOpen(true);
  }, []);

  // ---- Open edit modal ----
  const openEditModal = useCallback(
    async (procedure: GovernanceProcedure) => {
      setDetailLoading(true);
      try {
        const detail = (await getGovernanceProcedure(procedure.id)) as GovernanceProcedureDetail;
        setEditingProcedure(detail);
        setForm({
          name: detail.name,
          description: detail.description,
          status: detail.status,
          tiers: detail.applicability?.tier ?? [],
          release_types: detail.applicability?.release_type ?? [],
          required_evidence: detail.required_evidence ?? [],
          required_approval: (detail.required_approval ?? []) as RoleEnum[],
          applicable_test_types: detail.applicable_test_types ?? [],
          compliance_rule: detail.compliance_rule,
        });
        setFormErrors({});
        setTierInput('');
        setReleaseTypeInput('');
        setTestTypeInput('');
        setModalOpen(true);
      } catch (err) {
        if (axios.isAxiosError(err)) {
          addToast({ message: err.response?.data?.detail ?? 'Failed to load procedure', variant: 'error' });
        } else {
          addToast({ message: 'Failed to load procedure', variant: 'error' });
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [addToast],
  );

  // ---- Submit form ----
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const errors = validateForm(form);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) return;

      setSubmitting(true);
      try {
        const applicability: QualityGateApplicability = {
          tier: form.tiers,
          release_type: form.release_types,
        };

        if (editingProcedure) {
          const payload: UpdateGovernanceProcedureRequest = {
            name: form.name,
            description: form.description,
            status: form.status,
            applicability,
            required_evidence: form.required_evidence,
            required_approval: form.required_approval,
            applicable_test_types: form.applicable_test_types,
            compliance_rule: form.compliance_rule,
            version: editingProcedure.version,
          };
          await updateGovernanceProcedure(editingProcedure.id, payload);
          addToast({ message: 'Procedure updated successfully', variant: 'success' });
        } else {
          const payload: CreateGovernanceProcedureRequest = {
            name: form.name,
            description: form.description,
            status: form.status,
            applicability,
            required_evidence: form.required_evidence,
            required_approval: form.required_approval,
            applicable_test_types: form.applicable_test_types,
            compliance_rule: form.compliance_rule,
            owner: user ? `${user.first_name} ${user.last_name}` : 'system',
          };
          await createGovernanceProcedure(payload);
          addToast({ message: 'Procedure created successfully', variant: 'success' });
        }

        setModalOpen(false);
        fetchProcedures();
      } catch (err) {
        if (axios.isAxiosError(err)) {
          addToast({
            message: err.response?.data?.detail ?? 'Failed to save procedure',
            variant: 'error',
          });
        } else {
          addToast({ message: 'Failed to save procedure', variant: 'error' });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingProcedure, user, addToast, fetchProcedures],
  );

  // ---- Row click → detail ----
  const handleRowClick = useCallback(
    (row: GovernanceProcedure) => {
      fetchDetail(row.id);
    },
    [fetchDetail],
  );

  // ---- Page size change ----
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  // ---- Add tier ----
  const addTier = useCallback(() => {
    const num = parseInt(tierInput, 10);
    if (!isNaN(num) && !form.tiers.includes(num)) {
      setForm((prev) => ({ ...prev, tiers: [...prev.tiers, num] }));
    }
    setTierInput('');
  }, [tierInput, form.tiers]);

  // ---- Remove tier ----
  const removeTier = useCallback((tier: number) => {
    setForm((prev) => ({ ...prev, tiers: prev.tiers.filter((t) => t !== tier) }));
  }, []);

  // ---- Add release type ----
  const addReleaseType = useCallback(() => {
    const val = releaseTypeInput.trim();
    if (val && !form.release_types.includes(val)) {
      setForm((prev) => ({ ...prev, release_types: [...prev.release_types, val] }));
    }
    setReleaseTypeInput('');
  }, [releaseTypeInput, form.release_types]);

  // ---- Remove release type ----
  const removeReleaseType = useCallback((rt: string) => {
    setForm((prev) => ({ ...prev, release_types: prev.release_types.filter((r) => r !== rt) }));
  }, []);

  // ---- Add test type ----
  const addTestType = useCallback(() => {
    const val = testTypeInput.trim();
    if (val && !form.applicable_test_types.includes(val)) {
      setForm((prev) => ({ ...prev, applicable_test_types: [...prev.applicable_test_types, val] }));
    }
    setTestTypeInput('');
  }, [testTypeInput, form.applicable_test_types]);

  // ---- Remove test type ----
  const removeTestType = useCallback((tt: string) => {
    setForm((prev) => ({
      ...prev,
      applicable_test_types: prev.applicable_test_types.filter((t) => t !== tt),
    }));
  }, []);

  // ---- Table columns ----
  const columns: Column<GovernanceProcedure>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (_val, row) => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (_val, row) => (
        <span className="text-foreground-muted line-clamp-2 max-w-xs">
          {row.description}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (_val, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'required_evidence',
      header: 'Required Evidence',
      render: (_val, row) => (
        <div className="flex flex-wrap gap-1">
          {(row.required_evidence ?? []).length > 0
            ? row.required_evidence.map((ev) => (
                <span
                  key={ev}
                  className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-foreground-muted"
                >
                  {capitalize(ev)}
                </span>
              ))
            : <span className="text-foreground-muted text-xs">—</span>}
        </div>
      ),
    },
    {
      key: 'compliance_rule',
      header: 'Compliance Rule',
      render: (_val, row) => (
        <code className="text-xs font-mono text-foreground-muted bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
          {row.compliance_rule || '—'}
        </code>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (_val, row) => (
        <DropdownMenu
          trigger={
            <button
              type="button"
              className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors duration-fast"
              aria-label="Row actions"
            >
              <MoreVertical size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          }
          items={[
            {
              label: 'View',
              icon: Eye,
              onClick: () => fetchDetail(row.id),
            },
            {
              label: 'Edit',
              icon: Pencil,
              onClick: () => openEditModal(row),
            },
          ]}
        />
      ),
    },
  ];

  // ---- Detail view ----
  if (detailProcedure || detailLoading || detailError) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Governance', href: '/governance' },
            { label: detailProcedure?.name ?? 'Details' },
          ]}
        />

        <button
          type="button"
          onClick={() => {
            setDetailProcedure(null);
            setDetailError(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors duration-fast"
        >
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          Back to list
        </button>

        {detailLoading && (
          <Card>
            <div className="space-y-4">
              <Skeleton height="24px" width="40%" />
              <SkeletonText lines={4} />
              <Skeleton height="16px" width="60%" />
              <SkeletonText lines={3} />
            </div>
          </Card>
        )}

        {detailError && (
          <Card>
            <EmptyState
              title="Failed to load details"
              description={detailError}
              action={
                <Button variant="secondary" onClick={() => setDetailProcedure(null)}>
                  Go back
                </Button>
              }
            />
          </Card>
        )}

        {detailProcedure && !detailLoading && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {detailProcedure.name}
                </h1>
                <p className="mt-1 text-sm text-foreground-muted max-w-2xl">
                  {detailProcedure.description}
                </p>
              </div>
              <StatusBadge status={detailProcedure.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Compliance Rule */}
              <Card>
                <div className="flex items-start gap-3">
                  <Scale
                    size={20}
                    strokeWidth={1.5}
                    className="text-foreground-muted mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Compliance Rule</h3>
                    <code className="mt-1 block text-sm font-mono text-foreground-muted">
                      {detailProcedure.compliance_rule || '—'}
                    </code>
                  </div>
                </div>
              </Card>

              {/* Owner */}
              <Card>
                <div className="flex items-start gap-3">
                  <Users
                    size={20}
                    strokeWidth={1.5}
                    className="text-foreground-muted mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Owner</h3>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {detailProcedure.owner}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Required Evidence */}
              <Card>
                <div className="flex items-start gap-3">
                  <FileText
                    size={20}
                    strokeWidth={1.5}
                    className="text-foreground-muted mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Required Evidence</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(detailProcedure.required_evidence ?? []).length > 0
                        ? detailProcedure.required_evidence.map((ev) => (
                            <span
                              key={ev}
                              className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-foreground-muted"
                            >
                              {capitalize(ev)}
                            </span>
                          ))
                        : <span className="text-sm text-foreground-muted">None specified</span>}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Required Approvals */}
              <Card>
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={20}
                    strokeWidth={1.5}
                    className="text-foreground-muted mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Required Approvals</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(detailProcedure.required_approval ?? []).length > 0
                        ? detailProcedure.required_approval.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/20 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300"
                            >
                              {capitalize(role)}
                            </span>
                          ))
                        : <span className="text-sm text-foreground-muted">None specified</span>}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Applicability */}
            <Card>
              <h3 className="text-sm font-medium text-foreground mb-3">Applicability</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
                    Tiers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailProcedure.applicability?.tier ?? []).length > 0
                      ? detailProcedure.applicability.tier.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs font-mono text-foreground-muted"
                          >
                            Tier {t}
                          </span>
                        ))
                      : <span className="text-sm text-foreground-muted">All tiers</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-1.5">
                    Release Types
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(detailProcedure.applicability?.release_type ?? []).length > 0
                      ? detailProcedure.applicability.release_type.map((rt) => (
                          <span
                            key={rt}
                            className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-foreground-muted"
                          >
                            {capitalize(rt)}
                          </span>
                        ))
                      : <span className="text-sm text-foreground-muted">All types</span>}
                  </div>
                </div>
              </div>
            </Card>

            {/* Applicable Test Types */}
            {(detailProcedure.applicable_test_types ?? []).length > 0 && (
              <Card>
                <h3 className="text-sm font-medium text-foreground mb-3">Applicable Test Types</h3>
                <div className="flex flex-wrap gap-1.5">
                  {detailProcedure.applicable_test_types.map((tt) => (
                    <span
                      key={tt}
                      className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs text-foreground-muted"
                    >
                      {capitalize(tt)}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Audit History */}
            {(detailProcedure.audit_history ?? []).length > 0 && (
              <Card>
                <h3 className="text-sm font-medium text-foreground mb-3">Audit History</h3>
                <div className="space-y-3">
                  {detailProcedure.audit_history.map((entry, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 text-sm border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <Clock
                        size={16}
                        strokeWidth={1.5}
                        className="text-foreground-muted mt-0.5 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground">
                          <span className="font-medium">{entry.action}</span>
                          {' by '}
                          <span className="text-foreground-muted">{entry.user_id}</span>
                        </p>
                        <p className="text-xs text-foreground-muted font-mono tabular-nums mt-0.5">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    Created By
                  </p>
                  <p className="mt-1 text-foreground">{detailProcedure.created_by ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    Created At
                  </p>
                  <p className="mt-1 text-foreground font-mono tabular-nums">
                    {detailProcedure.created_at
                      ? new Date(detailProcedure.created_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    Updated By
                  </p>
                  <p className="mt-1 text-foreground">{detailProcedure.updated_by ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    Updated At
                  </p>
                  <p className="mt-1 text-foreground font-mono tabular-nums">
                    {detailProcedure.updated_at
                      ? new Date(detailProcedure.updated_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => openEditModal(detailProcedure)}
              >
                <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
                Edit Procedure
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Governance' },
        ]}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Governance &amp; Compliance
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Manage governance procedures, compliance rules, and approval workflows.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Create Procedure
        </Button>
      </div>

      <DataTable<GovernanceProcedure>
        data={procedures}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchProcedures}
        onRowClick={handleRowClick}
        emptyMessage="No governance procedures"
        pagination={{
          page,
          page_size: pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange: handlePageSizeChange,
        }}
      />

      {/* ---- Create / Edit Modal ---- */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProcedure ? 'Edit Procedure' : 'Create Procedure'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <FormField
            label="Name"
            name="procedure-name"
            required
            error={formErrors.name}
          >
            <input
              id="procedure-name"
              type="text"
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              aria-required="true"
              aria-invalid={formErrors.name ? true : undefined}
              aria-describedby={formErrors.name ? 'procedure-name-error' : undefined}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              placeholder="Procedure name"
            />
          </FormField>

          {/* Description */}
          <FormField
            label="Description"
            name="procedure-description"
            required
            error={formErrors.description}
          >
            <textarea
              id="procedure-description"
              value={form.description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              aria-required="true"
              aria-invalid={formErrors.description ? true : undefined}
              aria-describedby={formErrors.description ? 'procedure-description-error' : undefined}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast resize-y"
              placeholder="Describe the governance procedure"
            />
          </FormField>

          {/* Status */}
          <Select
            label="Status"
            name="procedure-status"
            value={form.status}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              setForm((prev) => ({ ...prev, status: e.target.value as GovernanceStatus }))
            }
            options={GOVERNANCE_STATUS_OPTIONS}
          />

          {/* Applicability — Tiers */}
          <FormField label="Applicability — Tiers" name="procedure-tiers">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tiers.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs text-foreground-muted"
                >
                  Tier {t}
                  <button
                    type="button"
                    onClick={() => removeTier(t)}
                    className="p-0.5 rounded hover:text-foreground transition-colors duration-fast"
                    aria-label={`Remove tier ${t}`}
                  >
                    <X size={12} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="procedure-tiers"
                type="number"
                value={tierInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTierInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTier();
                  }
                }}
                className="w-24 rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                placeholder="Tier #"
                min={1}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addTier}>
                Add
              </Button>
            </div>
          </FormField>

          {/* Applicability — Release Types */}
          <FormField label="Applicability — Release Types" name="procedure-release-types">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.release_types.map((rt) => (
                <span
                  key={rt}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs text-foreground-muted"
                >
                  {capitalize(rt)}
                  <button
                    type="button"
                    onClick={() => removeReleaseType(rt)}
                    className="p-0.5 rounded hover:text-foreground transition-colors duration-fast"
                    aria-label={`Remove ${rt}`}
                  >
                    <X size={12} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="procedure-release-types"
                type="text"
                value={releaseTypeInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setReleaseTypeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addReleaseType();
                  }
                }}
                className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                placeholder="e.g. major, minor, hotfix"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addReleaseType}>
                Add
              </Button>
            </div>
          </FormField>

          {/* Required Evidence (multi-select checkboxes) */}
          <FormField label="Required Evidence" name="procedure-evidence">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" id="procedure-evidence">
              {EVIDENCE_TYPE_OPTIONS.map((ev) => (
                <label
                  key={ev}
                  className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={form.required_evidence.includes(ev)}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        required_evidence: toggleItem(prev.required_evidence, ev),
                      }))
                    }
                    className="rounded border-border text-primary-600 focus:ring-ring"
                  />
                  {capitalize(ev)}
                </label>
              ))}
            </div>
          </FormField>

          {/* Required Approvals (multi-select checkboxes) */}
          <FormField label="Required Approvals" name="procedure-approvals">
            <div className="grid grid-cols-2 gap-2" id="procedure-approvals">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role}
                  className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={form.required_approval.includes(role)}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        required_approval: toggleItem(prev.required_approval, role),
                      }))
                    }
                    className="rounded border-border text-primary-600 focus:ring-ring"
                  />
                  {capitalize(role)}
                </label>
              ))}
            </div>
          </FormField>

          {/* Applicable Test Types */}
          <FormField label="Applicable Test Types" name="procedure-test-types">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.applicable_test_types.map((tt) => (
                <span
                  key={tt}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 text-xs text-foreground-muted"
                >
                  {capitalize(tt)}
                  <button
                    type="button"
                    onClick={() => removeTestType(tt)}
                    className="p-0.5 rounded hover:text-foreground transition-colors duration-fast"
                    aria-label={`Remove ${tt}`}
                  >
                    <X size={12} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="procedure-test-types"
                type="text"
                value={testTypeInput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTestTypeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTestType();
                  }
                }}
                className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                placeholder="e.g. regression, smoke, integration"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addTestType}>
                Add
              </Button>
            </div>
          </FormField>

          {/* Compliance Rule */}
          <FormField
            label="Compliance Rule"
            name="procedure-compliance-rule"
            required
            error={formErrors.compliance_rule}
            hint="Use AND/OR expressions, e.g. (evidence_log AND evidence_screenshot) OR approval_qa_manager"
          >
            <input
              id="procedure-compliance-rule"
              type="text"
              value={form.compliance_rule}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, compliance_rule: e.target.value }))
              }
              aria-required="true"
              aria-invalid={formErrors.compliance_rule ? true : undefined}
              aria-describedby={
                formErrors.compliance_rule
                  ? 'procedure-compliance-rule-error'
                  : 'procedure-compliance-rule-hint'
              }
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm font-mono text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              placeholder="(evidence_log AND approval_qa_lead) OR approval_admin"
            />
          </FormField>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting}>
              {editingProcedure ? 'Update Procedure' : 'Create Procedure'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default GovernancePage;
