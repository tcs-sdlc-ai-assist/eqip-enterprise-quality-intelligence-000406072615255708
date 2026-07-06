import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import clsx from 'clsx';
import {
  Package,
  ShieldCheck,
  AlertTriangle,
  Bug,
  Gauge,
  Cpu,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import apiClient from '@/api/client';
import {
  getReleaseReadiness,
  getGateResults,
  updateGateResults,
} from '@/api/releases';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import type {
  Release,
  PaginatedResponse,
  ReleaseReadiness,
  ReleaseGateResults,
  GateResult,
  QualityGateResult,
  UpdateGateResultRequest,
} from '@/types';

// ---------------------------------------------------------------------------
// ReleasesPage — browse releases, view readiness assessment & quality gates.
// ---------------------------------------------------------------------------

const BREADCRUMB_ITEMS = [
  { label: 'Home', href: '/dashboard' },
  { label: 'Releases' },
];

/** Map gate result to StatusBadge variant */
const GATE_RESULT_VARIANT: Record<QualityGateResult, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  pass: 'success',
  warning: 'warning',
  fail: 'error',
  waived: 'info',
  not_applicable: 'neutral',
};

const GATE_RESULT_OPTIONS: { value: QualityGateResult; label: string }[] = [
  { value: 'pass', label: 'Pass' },
  { value: 'warning', label: 'Warning' },
  { value: 'fail', label: 'Fail' },
  { value: 'waived', label: 'Waived' },
  { value: 'not_applicable', label: 'Not Applicable' },
];

/** Circular progress indicator for readiness score */
function ReadinessGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  const color =
    clamped >= 80
      ? 'text-success'
      : clamped >= 50
        ? 'text-warning'
        : 'text-error';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width="140"
        height="140"
        viewBox="0 0 120 120"
        className="transform -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-neutral-200 dark:text-neutral-700"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={clsx('transition-all duration-500', color)}
        />
      </svg>
      <span
        className="absolute text-2xl font-semibold text-foreground font-mono tabular-nums"
        aria-label={`Readiness score ${clamped}%`}
      >
        {clamped}%
      </span>
    </div>
  );
}

/** Metric row inside the readiness card */
function MetricRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon
        className="h-5 w-5 text-foreground-muted flex-shrink-0"
        strokeWidth={1.5}
      />
      <span className="text-sm text-foreground-muted">{label}</span>
      <span className="ml-auto text-sm font-medium text-foreground font-mono tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate override modal state
// ---------------------------------------------------------------------------

interface GateOverride {
  gate_id: string;
  gate_name: string;
  result: QualityGateResult;
  waiver_justification: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ReleasesPage() {
  const { user } = useAuth();
  const { addToast } = useToast();

  // ---- Release list ----
  const [releases, setReleases] = useState<Release[]>([]);
  const [releasesLoading, setReleasesLoading] = useState<boolean>(true);
  const [releasesError, setReleasesError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  // ---- Selected release ----
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ---- Readiness ----
  const [readiness, setReadiness] = useState<ReleaseReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState<boolean>(false);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  // ---- Gate results ----
  const [gateResults, setGateResults] = useState<ReleaseGateResults | null>(null);
  const [gatesLoading, setGatesLoading] = useState<boolean>(false);
  const [gatesError, setGatesError] = useState<string | null>(null);

  // ---- Modal ----
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [overrides, setOverrides] = useState<GateOverride[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isReleaseManager =
    user?.role === 'release_manager' || user?.role === 'admin';

  // ---- Fetch releases ----
  const fetchReleases = useCallback(async () => {
    setReleasesLoading(true);
    setReleasesError(null);
    try {
      const response = await apiClient.get<PaginatedResponse<Release>>(
        '/releases',
        { params: { page: 1, page_size: 100 } },
      );
      setReleases(response.data?.items ?? []);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load releases';
      setReleasesError(message);
    } finally {
      setReleasesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  // ---- Fetch readiness + gates when a release is selected ----
  const fetchReleaseDetail = useCallback(async (id: string) => {
    setReadinessLoading(true);
    setReadinessError(null);
    setGatesLoading(true);
    setGatesError(null);
    setReadiness(null);
    setGateResults(null);

    try {
      const data = await getReleaseReadiness(id);
      setReadiness(data);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load readiness assessment';
      setReadinessError(message);
    } finally {
      setReadinessLoading(false);
    }

    try {
      const data = await getGateResults(id);
      setGateResults(data);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load gate results';
      setGatesError(message);
    } finally {
      setGatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchReleaseDetail(selectedId);
    }
  }, [selectedId, fetchReleaseDetail]);

  // ---- Filter releases by search ----
  const filteredReleases = releases.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.version.toLowerCase().includes(q)
    );
  });

  // ---- Open override modal ----
  const openOverrideModal = () => {
    if (!gateResults) return;
    setOverrides(
      gateResults.gates.map((g) => ({
        gate_id: g.gate_id,
        gate_name: g.gate_name,
        result: g.result,
        waiver_justification: g.waiver_justification ?? '',
      })),
    );
    setModalOpen(true);
  };

  // ---- Handle override field changes ----
  const handleOverrideResult = (index: number, value: QualityGateResult) => {
    setOverrides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], result: value };
      return next;
    });
  };

  const handleOverrideJustification = (index: number, value: string) => {
    setOverrides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], waiver_justification: value };
      return next;
    });
  };

  // ---- Submit overrides ----
  const handleSubmitOverrides = async () => {
    if (!selectedId) return;

    // Validate: waived gates need justification
    for (const o of overrides) {
      if (o.result === 'waived' && !o.waiver_justification.trim()) {
        addToast({
          message: `Waiver justification is required for "${o.gate_name}"`,
          variant: 'warning',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const gates: UpdateGateResultRequest[] = overrides.map((o) => ({
        gate_id: o.gate_id,
        result: o.result,
        waiver_justification:
          o.result === 'waived' ? o.waiver_justification : null,
      }));

      const updated = await updateGateResults(selectedId, { gates });
      setGateResults(updated);
      setModalOpen(false);
      addToast({ message: 'Gate results updated successfully', variant: 'success' });
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to update gate results';
      addToast({ message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render helpers ----

  const renderReleaseSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height="48px" className="w-full" />
      ))}
    </div>
  );

  const renderDetailSkeleton = () => (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Skeleton width="140px" height="140px" rounded="full" />
          <div className="flex-1 space-y-3 w-full">
            <Skeleton height="16px" width="60%" />
            <Skeleton height="14px" width="80%" />
            <Skeleton height="14px" width="50%" />
            <Skeleton height="14px" width="70%" />
          </div>
        </div>
      </Card>
      <Card>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="40px" className="w-full" />
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={BREADCRUMB_ITEMS} />
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Releases
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          View release readiness assessments and quality gate results.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left panel: release list ── */}
        <div className="lg:col-span-4">
          <Card padding="sm">
            <div className="mb-3">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search releases…"
              />
            </div>

            {releasesLoading && renderReleaseSkeleton()}

            {releasesError && (
              <Alert variant="error" title="Error">
                {releasesError}
              </Alert>
            )}

            {!releasesLoading && !releasesError && filteredReleases.length === 0 && (
              <EmptyState
                icon={Package}
                title="No releases found"
                description={
                  search
                    ? 'Try adjusting your search query.'
                    : 'No releases are available yet.'
                }
              />
            )}

            {!releasesLoading && !releasesError && filteredReleases.length > 0 && (
              <ul className="divide-y divide-border" role="listbox" aria-label="Releases">
                {filteredReleases.map((release) => {
                  const isSelected = release.id === selectedId;
                  return (
                    <li key={release.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => setSelectedId(release.id)}
                        className={clsx(
                          'w-full flex items-center justify-between px-3 py-3 text-left rounded transition-colors duration-fast',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected
                            ? 'bg-primary-600/10 dark:bg-primary-500/10'
                            : 'hover:bg-surface-raised',
                        )}
                      >
                        <div className="min-w-0">
                          <p
                            className={clsx(
                              'text-sm font-medium truncate',
                              isSelected
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-foreground',
                            )}
                          >
                            {release.name}
                          </p>
                          <p className="text-xs text-foreground-muted mt-0.5 font-mono tabular-nums">
                            v{release.version} · {release.release_type}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <StatusBadge status={release.status} size="sm" />
                          <ChevronRight
                            className="h-4 w-4 text-foreground-muted"
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* ── Right panel: detail ── */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedId && (
            <Card>
              <EmptyState
                icon={Package}
                title="Select a release"
                description="Choose a release from the list to view its readiness assessment and quality gate results."
              />
            </Card>
          )}

          {selectedId && (readinessLoading || gatesLoading) && renderDetailSkeleton()}

          {/* ── Readiness Assessment ── */}
          {selectedId && !readinessLoading && readinessError && (
            <Alert variant="error" title="Readiness Error">
              {readinessError}
            </Alert>
          )}

          {selectedId && !readinessLoading && readiness && (
            <Card>
              <h2 className="text-lg font-semibold text-foreground mb-6">
                Readiness Assessment
              </h2>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ReadinessGauge score={readiness.overall_readiness_score} />

                <div className="flex-1 w-full space-y-4">
                  <MetricRow
                    icon={Gauge}
                    label="Test Completion"
                    value={`${readiness.test_completion_percent.toFixed(1)}%`}
                  />
                  <MetricRow
                    icon={Cpu}
                    label="Automation Execution"
                    value={`${readiness.automation_execution_percent.toFixed(1)}%`}
                  />
                  <MetricRow
                    icon={Bug}
                    label="Open Critical Defects"
                    value={String(readiness.open_critical_defects)}
                  />
                  <MetricRow
                    icon={AlertTriangle}
                    label="Risk Rating"
                    value={readiness.risk_rating.charAt(0).toUpperCase() + readiness.risk_rating.slice(1)}
                  />

                  <div className="flex items-start gap-3 pt-2 border-t border-border">
                    <ShieldCheck
                      className="h-5 w-5 text-foreground-muted flex-shrink-0 mt-0.5"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-xs text-foreground-muted uppercase tracking-wide font-medium mb-1">
                        Recommendation
                      </p>
                      <p className="text-sm text-foreground">
                        {readiness.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* ── Quality Gate Results ── */}
          {selectedId && !gatesLoading && gatesError && (
            <Alert variant="error" title="Gate Results Error">
              {gatesError}
            </Alert>
          )}

          {selectedId && !gatesLoading && gateResults && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Quality Gate Results
                  </h2>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    Overall:{' '}
                    <StatusBadge
                      status={gateResults.overall_result}
                      variant={GATE_RESULT_VARIANT[gateResults.overall_result]}
                      size="sm"
                    />
                  </p>
                </div>

                {isReleaseManager && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={openOverrideModal}
                  >
                    <RefreshCw
                      className="h-4 w-4"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    Update Gate Results
                  </Button>
                )}
              </div>

              {gateResults.gates.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="No gate results"
                  description="No quality gate evaluations are available for this release."
                />
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          scope="col"
                          className="px-6 py-2 text-left text-xs font-medium text-foreground-muted uppercase tracking-wide"
                        >
                          Gate
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-2 text-left text-xs font-medium text-foreground-muted uppercase tracking-wide"
                        >
                          Result
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-2 text-right text-xs font-medium text-foreground-muted uppercase tracking-wide font-mono"
                        >
                          Threshold
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-2 text-right text-xs font-medium text-foreground-muted uppercase tracking-wide font-mono"
                        >
                          Actual
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-2 text-left text-xs font-medium text-foreground-muted uppercase tracking-wide"
                        >
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {gateResults.gates.map((gate: GateResult) => (
                        <tr key={gate.gate_id} className="hover:bg-surface-raised transition-colors duration-fast">
                          <td className="px-6 py-3 text-foreground font-medium whitespace-nowrap">
                            {gate.gate_name}
                          </td>
                          <td className="px-6 py-3">
                            <StatusBadge
                              status={gate.result}
                              variant={GATE_RESULT_VARIANT[gate.result]}
                              size="sm"
                            />
                          </td>
                          <td className="px-6 py-3 text-right text-foreground-muted font-mono tabular-nums">
                            {gate.threshold}
                          </td>
                          <td className="px-6 py-3 text-right text-foreground font-mono tabular-nums">
                            {gate.actual_value}
                          </td>
                          <td className="px-6 py-3 text-foreground-muted max-w-xs truncate">
                            {gate.waiver_justification ? (
                              <span className="text-xs">
                                Waived: {gate.waiver_justification}
                              </span>
                            ) : (
                              <span className="text-xs text-foreground-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-foreground-muted mt-3 font-mono tabular-nums">
                Computed at{' '}
                {new Date(gateResults.computed_at).toLocaleString()}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ── Override Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Update Gate Results"
        size="lg"
      >
        <div className="space-y-5">
          {overrides.map((o, idx) => (
            <div
              key={o.gate_id}
              className="border border-border rounded-md p-4 space-y-3"
            >
              <p className="text-sm font-medium text-foreground">
                {o.gate_name}
              </p>

              <FormField label="Result" name={`gate-result-${idx}`}>
                <select
                  id={`gate-result-${idx}`}
                  name={`gate-result-${idx}`}
                  value={o.result}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    handleOverrideResult(idx, e.target.value as QualityGateResult)
                  }
                  className="w-full appearance-none rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                >
                  {GATE_RESULT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FormField>

              {o.result === 'waived' && (
                <FormField
                  label="Waiver Justification"
                  name={`gate-justification-${idx}`}
                  required
                >
                  <textarea
                    id={`gate-justification-${idx}`}
                    name={`gate-justification-${idx}`}
                    value={o.waiver_justification}
                    onChange={(e) =>
                      handleOverrideJustification(idx, e.target.value)
                    }
                    rows={2}
                    aria-required="true"
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast resize-none"
                    placeholder="Provide justification for waiving this gate…"
                  />
                </FormField>
              )}
            </div>
          ))}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={submitting}
              onClick={handleSubmitOverrides}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ReleasesPage;
