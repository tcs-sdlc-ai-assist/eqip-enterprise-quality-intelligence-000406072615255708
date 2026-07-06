import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { Edit, MoreVertical, ShieldPlus, Lock } from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DataTable } from '@/components/ui/DataTable';
import type { Column, DataTablePagination } from '@/components/ui/DataTable';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';

import { getRoles, createRole, updateRole } from '@/api/roles';
import type { GetRolesParams } from '@/api/roles';
import type {
  Role,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BREADCRUMBS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Role Management' },
];

const PAGE_SIZE = 20;

/** System roles that cannot be edited */
const SYSTEM_ROLE_NAMES = ['admin', 'viewer'];

/**
 * Permissions grouped by category for the checkbox list.
 * In a real app these would come from an API; here they are a representative set
 * matching the EQIP domain.
 */
const PERMISSION_CATEGORIES: { category: string; permissions: string[] }[] = [
  {
    category: 'Users',
    permissions: ['users.view', 'users.create', 'users.edit', 'users.delete'],
  },
  {
    category: 'Roles',
    permissions: ['roles.view', 'roles.create', 'roles.edit', 'roles.delete'],
  },
  {
    category: 'Test Cases',
    permissions: [
      'test_cases.view',
      'test_cases.create',
      'test_cases.edit',
      'test_cases.delete',
    ],
  },
  {
    category: 'Test Suites',
    permissions: [
      'test_suites.view',
      'test_suites.create',
      'test_suites.edit',
      'test_suites.delete',
    ],
  },
  {
    category: 'Executions',
    permissions: [
      'executions.view',
      'executions.create',
      'executions.edit',
    ],
  },
  {
    category: 'Releases',
    permissions: ['releases.view', 'releases.create', 'releases.edit'],
  },
  {
    category: 'Governance',
    permissions: ['governance.view', 'governance.create', 'governance.edit'],
  },
  {
    category: 'Audit',
    permissions: ['audit.view'],
  },
  {
    category: 'Reports',
    permissions: ['reports.view', 'reports.export'],
  },
  {
    category: 'Integrations',
    permissions: ['integrations.view', 'integrations.manage'],
  },
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface RoleFormState {
  name: string;
  description: string;
  permissions: string[];
}

interface FormErrors {
  name?: string;
  description?: string;
}

function emptyForm(): RoleFormState {
  return { name: '', description: '', permissions: [] };
}

function validateForm(form: RoleFormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.description.trim()) errors.description = 'Description is required';
  return errors;
}

function isSystemRole(role: Role): boolean {
  return SYSTEM_ROLE_NAMES.includes(role.name.toLowerCase());
}

function formatPermissionLabel(perm: string): string {
  const parts = perm.split('.');
  const action = parts[parts.length - 1];
  return action.charAt(0).toUpperCase() + action.slice(1);
}

// ---------------------------------------------------------------------------
// RolesPage
// ---------------------------------------------------------------------------

function RolesPage() {
  const { addToast } = useToast();

  // ---- Data state ----
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Modal state ----
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ---- Fetch roles ----
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetRolesParams = { page, page_size: pageSize };
      const res = await getRoles(params);
      setRoles(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? err.message);
      } else {
        setError('Failed to load roles');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  // ---- Open create modal ----
  const openCreateModal = useCallback(() => {
    setEditingRole(null);
    setForm(emptyForm());
    setFormErrors({});
    setShowModal(true);
  }, []);

  // ---- Open edit modal ----
  const openEditModal = useCallback((role: Role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  // ---- Close modal ----
  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingRole(null);
    setForm(emptyForm());
    setFormErrors({});
  }, []);

  // ---- Submit form ----
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const errors = validateForm(form);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) return;

      setSubmitting(true);
      try {
        if (editingRole) {
          const data: UpdateRoleRequest = {
            name: form.name,
            description: form.description,
            permissions: form.permissions,
            version: editingRole.version,
          };
          await updateRole(editingRole.id, data);
          addToast({ message: 'Role updated successfully', variant: 'success' });
        } else {
          const data: CreateRoleRequest = {
            name: form.name,
            description: form.description,
            permissions: form.permissions,
            scope: { segments: [], applications: [] },
          };
          await createRole(data);
          addToast({ message: 'Role created successfully', variant: 'success' });
        }
        closeModal();
        void fetchRoles();
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          addToast({
            message: err.response?.data?.detail ?? 'Failed to save role',
            variant: 'error',
          });
        } else {
          addToast({ message: 'Failed to save role', variant: 'error' });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingRole, addToast, closeModal, fetchRoles],
  );

  // ---- Permission toggle ----
  const togglePermission = useCallback((perm: string) => {
    setForm((prev) => {
      const next = prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm];
      return { ...prev, permissions: next };
    });
  }, []);

  // ---- Is the modal read-only (system role)? ----
  const isReadOnly = useMemo(
    () => editingRole !== null && isSystemRole(editingRole),
    [editingRole],
  );

  // ---- Columns ----
  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (val) => (
        <span className="font-medium text-foreground">{String(val ?? '')}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (val) => (
        <span className="text-foreground-muted text-sm line-clamp-2">
          {String(val ?? '')}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (val) => {
        const perms = val as string[] | undefined;
        return (
          <span className="font-mono text-xs tabular-nums text-foreground-muted">
            {perms?.length ?? 0}
          </span>
        );
      },
    },
    {
      key: 'name',
      header: 'System Role',
      render: (_val, row) =>
        isSystemRole(row) ? (
          <StatusBadge status="System" variant="info" size="sm" />
        ) : (
          <StatusBadge status="Custom" variant="neutral" size="sm" />
        ),
    },
    {
      key: 'id',
      header: 'Actions',
      className: 'w-16',
      render: (_val, row) => {
        const sysRole = isSystemRole(row);
        const items: DropdownMenuItem[] = [
          {
            label: sysRole ? 'View' : 'Edit',
            icon: sysRole ? Lock : Edit,
            onClick: () => openEditModal(row),
          },
        ];
        return (
          <DropdownMenu
            trigger={
              <span className="inline-flex items-center justify-center p-1 rounded text-foreground-muted hover:text-foreground hover:bg-surface-raised transition-colors duration-fast">
                <MoreVertical size={16} strokeWidth={1.5} aria-hidden="true" />
              </span>
            }
            items={items}
          />
        );
      },
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
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground">Role Management</h1>
          <Button onClick={openCreateModal}>
            <ShieldPlus size={16} strokeWidth={1.5} aria-hidden="true" />
            Add Role
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable<Role>
        data={roles}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchRoles}
        pagination={pagination}
        emptyMessage="No roles found"
      />

      {/* Create / Edit / View Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={
          isReadOnly
            ? `View Role — ${editingRole?.name ?? ''}`
            : editingRole
              ? 'Edit Role'
              : 'Add Role'
        }
        size="lg"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <FormField label="Name" name="role-name" required error={formErrors.name}>
            <input
              id="role-name"
              name="role-name"
              type="text"
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              disabled={isReadOnly}
              aria-required
              aria-invalid={formErrors.name ? true : undefined}
              aria-describedby={formErrors.name ? 'role-name-error' : undefined}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g. QA Reviewer"
            />
          </FormField>

          <FormField
            label="Description"
            name="role-description"
            required
            error={formErrors.description}
          >
            <textarea
              id="role-description"
              name="role-description"
              value={form.description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              disabled={isReadOnly}
              rows={3}
              aria-required
              aria-invalid={formErrors.description ? true : undefined}
              aria-describedby={
                formErrors.description ? 'role-description-error' : undefined
              }
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Describe the role's purpose…"
            />
          </FormField>

          {/* Permissions grouped by category */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-foreground">Permissions</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PERMISSION_CATEGORIES.map((cat) => (
                <div
                  key={cat.category}
                  className="border border-border rounded-md p-3 space-y-2"
                >
                  <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
                    {cat.category}
                  </p>
                  {cat.permissions.map((perm) => (
                    <Checkbox
                      key={perm}
                      label={formatPermissionLabel(perm)}
                      name={`perm-${perm}`}
                      checked={form.permissions.includes(perm)}
                      onChange={() => togglePermission(perm)}
                      disabled={isReadOnly}
                    />
                  ))}
                </div>
              ))}
            </div>
          </fieldset>

          {/* Actions */}
          {!isReadOnly && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button variant="secondary" onClick={closeModal} type="button">
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingRole ? 'Save Changes' : 'Create Role'}
              </Button>
            </div>
          )}

          {isReadOnly && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button variant="secondary" onClick={closeModal} type="button">
                Close
              </Button>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

export default RolesPage;
