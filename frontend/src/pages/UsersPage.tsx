import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { Edit, MoreVertical, UserMinus, UserPlus } from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { Column, DataTablePagination } from '@/components/ui/DataTable';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/ToastProvider';

import { getUsers, createUser, updateUser } from '@/api/users';
import type { GetUsersParams } from '@/api/users';
import type {
  User,
  RoleEnum,
  UserStatus,
  CreateUserRequest,
  UpdateUserRequest,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: RoleEnum; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'qa_manager', label: 'QA Manager' },
  { value: 'qa_lead', label: 'QA Lead' },
  { value: 'qa_engineer', label: 'QA Engineer' },
  { value: 'developer', label: 'Developer' },
  { value: 'release_manager', label: 'Release Manager' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'api_consumer', label: 'API Consumer' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'locked', label: 'Locked' },
];

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Roles' },
  ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label })),
];

const BREADCRUMBS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'User Management' },
];

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface UserFormState {
  first_name: string;
  last_name: string;
  email: string;
  role: RoleEnum;
  status: UserStatus;
  password: string;
}

interface FormErrors {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  password?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyForm(): UserFormState {
  return {
    first_name: '',
    last_name: '',
    email: '',
    role: 'viewer',
    status: 'active',
    password: '',
  };
}

function validateForm(form: UserFormState, isEdit: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!form.first_name.trim()) errors.first_name = 'First name is required';
  if (!form.last_name.trim()) errors.last_name = 'Last name is required';
  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_REGEX.test(form.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (!form.role) errors.role = 'Role is required';
  if (!isEdit && !form.password) errors.password = 'Password is required';
  return errors;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Build a display name from first + last name fields. */
function displayName(user: User): string {
  return `${user.first_name} ${user.last_name}`.trim();
}

// ---------------------------------------------------------------------------
// UsersPage
// ---------------------------------------------------------------------------

function UsersPage() {
  const { addToast } = useToast();

  // ---- Data state ----
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Filter state ----
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // ---- Modal state ----
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ---- Fetch users ----
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: GetUsersParams = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await getUsers(params);
      setUsers(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? err.message);
      } else {
        setError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, roleFilter, statusFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // ---- Search handler (resets to page 1) ----
  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  // ---- Open create modal ----
  const openCreateModal = useCallback(() => {
    setEditingUser(null);
    setForm(emptyForm());
    setFormErrors({});
    setShowModal(true);
  }, []);

  // ---- Open edit modal ----
  const openEditModal = useCallback((user: User) => {
    setEditingUser(user);
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      status: user.status,
      password: '',
    });
    setFormErrors({});
    setShowModal(true);
  }, []);

  // ---- Close modal ----
  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingUser(null);
    setForm(emptyForm());
    setFormErrors({});
  }, []);

  // ---- Handle deactivate ----
  const handleDeactivate = useCallback(
    async (user: User) => {
      try {
        const data: UpdateUserRequest = {
          status: 'inactive',
          version: (user as unknown as { version?: number }).version ?? 1,
        };
        await updateUser(user.id, data);
        addToast({ message: `${displayName(user)} has been deactivated`, variant: 'success' });
        void fetchUsers();
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          addToast({
            message: err.response?.data?.detail ?? 'Failed to deactivate user',
            variant: 'error',
          });
        } else {
          addToast({ message: 'Failed to deactivate user', variant: 'error' });
        }
      }
    },
    [addToast, fetchUsers],
  );

  // ---- Submit form ----
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const isEdit = editingUser !== null;
      const errors = validateForm(form, isEdit);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) return;

      setSubmitting(true);
      try {
        if (isEdit) {
          const data: UpdateUserRequest = {
            first_name: form.first_name,
            last_name: form.last_name,
            role: form.role,
            status: form.status,
            version: (editingUser as unknown as { version?: number }).version ?? 1,
          };
          await updateUser(editingUser.id, data);
          addToast({ message: 'User updated successfully', variant: 'success' });
        } else {
          const data: CreateUserRequest = {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email,
            role: form.role,
            status: form.status,
            password: form.password,
          };
          await createUser(data);
          addToast({ message: 'User created successfully', variant: 'success' });
        }
        closeModal();
        void fetchUsers();
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          addToast({
            message: err.response?.data?.detail ?? 'Failed to save user',
            variant: 'error',
          });
        } else {
          addToast({ message: 'Failed to save user', variant: 'error' });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingUser, addToast, closeModal, fetchUsers],
  );

  // ---- Form field handler ----
  const handleField = useCallback(
    (field: keyof UserFormState) =>
      (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    [],
  );

  // ---- Columns ----
  const columns: Column<User>[] = [
    {
      key: 'first_name',
      header: 'Name',
      sortable: true,
      render: (_val, row) => (
        <div className="flex items-center gap-3">
          <Avatar name={displayName(row)} size="sm" />
          <span className="font-medium text-foreground">{displayName(row)}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (val) => <StatusBadge status={String(val ?? '')} variant="info" size="sm" />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (val) => <StatusBadge status={String(val ?? '')} size="sm" />,
    },
    {
      key: 'last_login',
      header: 'Last Login',
      sortable: true,
      render: (val) => (
        <span className="font-mono text-xs tabular-nums text-foreground-muted">
          {formatDate(val as string | null)}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Actions',
      className: 'w-16',
      render: (_val, row) => {
        const items: DropdownMenuItem[] = [
          {
            label: 'Edit',
            icon: Edit,
            onClick: () => openEditModal(row),
          },
          {
            label: 'Deactivate',
            icon: UserMinus,
            danger: true,
            onClick: () => void handleDeactivate(row),
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
          <h1 className="text-2xl font-semibold text-foreground">User Management</h1>
          <Button onClick={openCreateModal}>
            <UserPlus size={16} strokeWidth={1.5} aria-hidden="true" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select
          label=""
          name="role-filter"
          options={ROLE_FILTER_OPTIONS}
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="sm:w-48"
        />
        <Select
          label=""
          name="status-filter"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="sm:w-48"
        />
      </div>

      {/* Table */}
      <DataTable<User>
        data={users}
        columns={columns}
        loading={loading}
        error={error}
        onRetry={fetchUsers}
        searchable
        searchPlaceholder="Search by name or email…"
        onSearch={handleSearch}
        pagination={pagination}
        emptyMessage="No users found"
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Add User'}
        size="md"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" name="first_name" required error={formErrors.first_name}>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleField('first_name')}
                aria-required
                aria-invalid={formErrors.first_name ? true : undefined}
                aria-describedby={formErrors.first_name ? 'first_name-error' : undefined}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                placeholder="Jane"
              />
            </FormField>

            <FormField label="Last Name" name="last_name" required error={formErrors.last_name}>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleField('last_name')}
                aria-required
                aria-invalid={formErrors.last_name ? true : undefined}
                aria-describedby={formErrors.last_name ? 'last_name-error' : undefined}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                placeholder="Doe"
              />
            </FormField>
          </div>

          <FormField label="Email" name="email" required error={formErrors.email}>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleField('email')}
              aria-required
              aria-invalid={formErrors.email ? true : undefined}
              aria-describedby={formErrors.email ? 'email-error' : undefined}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              placeholder="jane@example.com"
            />
          </FormField>

          <Select
            label="Role"
            name="role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={handleField('role')}
            required
            error={formErrors.role}
          />

          {editingUser && (
            <Select
              label="Status"
              name="status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'locked', label: 'Locked' },
              ]}
              value={form.status}
              onChange={handleField('status')}
            />
          )}

          <FormField
            label={editingUser ? 'New Password' : 'Password'}
            name="password"
            required={!editingUser}
            error={formErrors.password}
            hint={editingUser ? 'Leave blank to keep current password' : undefined}
          >
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleField('password')}
              aria-required={!editingUser || undefined}
              aria-invalid={formErrors.password ? true : undefined}
              aria-describedby={
                formErrors.password
                  ? 'password-error'
                  : editingUser
                    ? 'password-hint'
                    : undefined
              }
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              placeholder="••••••••"
            />
          </FormField>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" onClick={closeModal} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default UsersPage;
