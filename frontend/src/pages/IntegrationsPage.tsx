import { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import {
  Cable,
  Plus,
  RefreshCw,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/ToastProvider';
import { Alert } from '@/components/ui/Alert';

import {
  getIntegrations,
  createIntegration,
  updateIntegration,
  syncIntegration,
} from '@/api/integrations';

import type {
  Integration,
  IntegrationStatus,
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_TYPE_OPTIONS = [
  { value: 'jira', label: 'Jira' },
  { value: 'azure_devops', label: 'Azure DevOps' },
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'jenkins', label: 'Jenkins' },
  { value: 'sonarqube', label: 'SonarQube' },
  { value: 'selenium', label: 'Selenium Grid' },
  { value: 'custom', label: 'Custom' },
];

const AUTH_METHOD_OPTIONS = [
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'token', label: 'Bearer Token' },
];

const SYNC_FREQUENCY_OPTIONS = [
  { value: 'realtime', label: 'Real-time' },
  { value: '5m', label: 'Every 5 minutes' },
  { value: '15m', label: 'Every 15 minutes' },
  { value: '1h', label: 'Hourly' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
];

const STATUS_VARIANT_MAP: Record<IntegrationStatus, 'success' | 'neutral' | 'error'> = {
  active: 'success',
  inactive: 'neutral',
  error: 'error',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(str: string): string {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  system_type: string;
  owner: string;
  sync_frequency: string;
  authentication_method: string;
  url: string;
  credentials_ref: string;
}

const INITIAL_FORM: FormState = {
  name: '',
  system_type: '',
  owner: '',
  sync_frequency: '1h',
  authentication_method: 'api_key',
  url: '',
  credentials_ref: '',
};

interface FormErrors {
  name?: string;
  system_type?: string;
  owner?: string;
  url?: string;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.system_type) errors.system_type = 'System type is required';
  if (!form.owner.trim()) errors.owner = 'Owner is required';
  if (!form.url.trim()) errors.url = 'Connection URL is required';
  return errors;
}

// ---------------------------------------------------------------------------
// Connection status icon
// ---------------------------------------------------------------------------

function ConnectionStatusIcon({ status }: { status: IntegrationStatus }) {
  const iconMap: Record<IntegrationStatus, React.ElementType> = {
    active: CheckCircle2,
    inactive: MinusCircle,
    error: XCircle,
  };
  const colorMap: Record<IntegrationStatus, string> = {
    active: 'text-success',
    inactive: 'text-foreground-muted',
    error: 'text-error',
  };
  const Icon = iconMap[status] ?? MinusCircle;
  return <Icon className={`h-4 w-4 ${colorMap[status] ?? 'text-foreground-muted'}`} strokeWidth={1.5} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// IntegrationsPage
// ---------------------------------------------------------------------------

function IntegrationsPage() {
  const { addToast } = useToast();

  // ---- List state ----
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Modal state ----
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ---- Sync state ----
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  // ---- Fetch list ----
  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getIntegrations({ page: 1, page_size: 100 });
      setIntegrations(res.items ?? []);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? 'Failed to load integrations');
      } else {
        setError('Failed to load integrations');
      }
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // ---- Open create modal ----
  const openCreateModal = useCallback(() => {
    setEditingIntegration(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  // ---- Open edit modal ----
  const openEditModal = useCallback((integration: Integration) => {
    setEditingIntegration(integration);
    setForm({
      name: integration.name,
      system_type: integration.system_type,
      owner: integration.owner,
      sync_frequency: integration.sync_frequency,
      authentication_method: integration.authentication_method,
      url: '',
      credentials_ref: '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  // ---- Close modal ----
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingIntegration(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  // ---- Handle form change ----
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    },
    [],
  );

  // ---- Submit form ----
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
        if (editingIntegration) {
          const payload: UpdateIntegrationRequest = {
            name: form.name,
            system_type: form.system_type,
            owner: form.owner,
            sync_frequency: form.sync_frequency,
            authentication_method: form.authentication_method,
            connection_config: {
              url: form.url || undefined,
              credentials_ref: form.credentials_ref || undefined,
            },
            version: 1,
          };
          await updateIntegration(editingIntegration.id, payload);
          addToast({ message: 'Integration updated successfully', variant: 'success' });
        } else {
          const payload: CreateIntegrationRequest = {
            name: form.name,
            system_type: form.system_type,
            owner: form.owner,
            sync_frequency: form.sync_frequency,
            authentication_method: form.authentication_method,
            connection_config: {
              url: form.url,
              auth_type: form.authentication_method,
              credentials_ref: form.credentials_ref,
            },
            data_objects_synced: [],
            retry_rules: { max_retries: 3, backoff: 2 },
          };
          await createIntegration(payload);
          addToast({ message: 'Integration created successfully', variant: 'success' });
        }
        closeModal();
        fetchIntegrations();
      } catch (err) {
        if (axios.isAxiosError(err)) {
          addToast({
            message: err.response?.data?.detail ?? 'Failed to save integration',
            variant: 'error',
          });
        } else {
          addToast({ message: 'Failed to save integration', variant: 'error' });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, editingIntegration, addToast, closeModal, fetchIntegrations],
  );

  // ---- Sync integration ----
  const handleSync = useCallback(
    async (id: string) => {
      setSyncingIds((prev) => new Set(prev).add(id));
      try {
        const res = await syncIntegration(id);
        addToast({ message: res.message ?? 'Sync triggered successfully', variant: 'success' });
        fetchIntegrations();
      } catch (err) {
        if (axios.isAxiosError(err)) {
          addToast({
            message: err.response?.data?.detail ?? 'Sync failed',
            variant: 'error',
          });
        } else {
          addToast({ message: 'Sync failed', variant: 'error' });
        }
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [addToast, fetchIntegrations],
  );

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Integrations' }]} />
          <h1 className="text-2xl font-semibold text-foreground mt-4">Integrations</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Integrations' }]} />
          <h1 className="text-2xl font-semibold text-foreground mt-4">Integrations</h1>
        </div>
        <Alert variant="error" title="Unable to load integrations">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchIntegrations}
            className="mt-3"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Integrations' }]} />
          <h1 className="text-2xl font-semibold text-foreground mt-4">Integrations</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Manage external system connections and data synchronization.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openCreateModal}>
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          Add Integration
        </Button>
      </div>

      {/* ── Card grid ── */}
      {integrations.length === 0 ? (
        <EmptyState
          icon={Cable}
          title="No integrations configured"
          description="Connect external systems to synchronize test data, defects, and CI/CD pipelines."
          action={
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Add Integration
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <Card key={integration.id} padding="md" className="flex flex-col gap-4">
              {/* Top row: name + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex-shrink-0">
                    <Cable className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {integration.name}
                    </h3>
                    <StatusBadge
                      status={capitalize(integration.system_type)}
                      variant="info"
                      size="sm"
                    />
                  </div>
                </div>
                <StatusBadge
                  status={integration.connection_status}
                  variant={STATUS_VARIANT_MAP[integration.connection_status]}
                  size="sm"
                />
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-foreground-muted">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span>Last sync: {formatTimestamp(integration.last_sync)}</span>
                </div>
                <div className="flex items-center gap-2 text-foreground-muted">
                  <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                  <span>Frequency: {capitalize(integration.sync_frequency)}</span>
                </div>
                {integration.error_count > 0 && (
                  <div className="flex items-center gap-2 text-error">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span>{integration.error_count} error{integration.error_count !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Circuit breaker indicator */}
              <div className="flex items-center gap-2 text-xs">
                <ConnectionStatusIcon status={integration.connection_status} />
                <span className="text-foreground-muted">
                  Circuit: {integration.connection_status === 'error' ? 'Open' : 'Closed'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(integration)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={syncingIds.has(integration.id)}
                  onClick={() => handleSync(integration.id)}
                >
                  <Zap className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  Sync
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingIntegration ? 'Edit Integration' : 'Add Integration'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField
            label="Name"
            name="name"
            required
            error={formErrors.name}
          >
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Jira Cloud — Production"
              aria-required
              aria-invalid={formErrors.name ? true : undefined}
              aria-describedby={formErrors.name ? 'name-error' : undefined}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select
              label="System Type"
              name="system_type"
              options={SYSTEM_TYPE_OPTIONS}
              value={form.system_type}
              onChange={handleChange}
              required
              placeholder="Select type…"
              error={formErrors.system_type}
            />

            <Select
              label="Auth Method"
              name="authentication_method"
              options={AUTH_METHOD_OPTIONS}
              value={form.authentication_method}
              onChange={handleChange}
              required
            />
          </div>

          <FormField
            label="Owner"
            name="owner"
            required
            error={formErrors.owner}
          >
            <input
              id="owner"
              name="owner"
              type="text"
              value={form.owner}
              onChange={handleChange}
              placeholder="team-platform"
              aria-required
              aria-invalid={formErrors.owner ? true : undefined}
              aria-describedby={formErrors.owner ? 'owner-error' : undefined}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </FormField>

          <Select
            label="Sync Frequency"
            name="sync_frequency"
            options={SYNC_FREQUENCY_OPTIONS}
            value={form.sync_frequency}
            onChange={handleChange}
            required
          />

          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-foreground">Connection Configuration</legend>

            <FormField
              label="Connection URL"
              name="url"
              required
              error={formErrors.url}
            >
              <input
                id="url"
                name="url"
                type="url"
                value={form.url}
                onChange={handleChange}
                placeholder="https://your-instance.atlassian.net"
                aria-required
                aria-invalid={formErrors.url ? true : undefined}
                aria-describedby={formErrors.url ? 'url-error' : undefined}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </FormField>

            <FormField
              label="Credentials Reference"
              name="credentials_ref"
              hint="Vault path or secret name for the credentials"
            >
              <input
                id="credentials_ref"
                name="credentials_ref"
                type="text"
                value={form.credentials_ref}
                onChange={handleChange}
                placeholder="vault://secrets/jira-api-key"
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </FormField>
          </fieldset>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" size="md" onClick={closeModal} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" loading={submitting}>
              {editingIntegration ? 'Update Integration' : 'Create Integration'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default IntegrationsPage;
