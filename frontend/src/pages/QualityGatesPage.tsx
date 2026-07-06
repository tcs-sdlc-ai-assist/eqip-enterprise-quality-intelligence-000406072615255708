import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ShieldCheck,
  Layers,
  Target,
} from 'lucide-react';
import apiClient from '@/api/client';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { SearchBar } from '@/components/ui/SearchBar';
import type { QualityGate, PaginatedResponse } from '@/types';

// ---------------------------------------------------------------------------
// QualityGatesPage — read-only card grid of all configured quality gates.
// ---------------------------------------------------------------------------

const BREADCRUMB_ITEMS = [
  { label: 'Home', href: '/dashboard' },
  { label: 'Quality Gates' },
];

/** Map governance status to StatusBadge variant */
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  active: 'success',
  draft: 'neutral',
  deprecated: 'neutral',
};

function QualityGatesPage() {
  const [gates, setGates] = useState<QualityGate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const fetchGates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<PaginatedResponse<QualityGate>>(
        '/quality-gates',
        { params: { page: 1, page_size: 100 } },
      );
      setGates(response.data?.items ?? []);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.detail
          ? String(err.response.data.detail)
          : 'Failed to load quality gates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGates();
  }, [fetchGates]);

  const filteredGates = gates.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={BREADCRUMB_ITEMS} />
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Quality Gates
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Configured quality gates that releases must satisfy before deployment.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search quality gates…"
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {/* Empty state */}
      {!loading && !error && filteredGates.length === 0 && (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No quality gates found"
            description={
              search
                ? 'Try adjusting your search query.'
                : 'No quality gates have been configured yet.'
            }
          />
        </Card>
      )}

      {/* Gate cards */}
      {!loading && !error && filteredGates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredGates.map((gate) => (
            <Card key={gate.id} padding="md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck
                    className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {gate.name}
                  </h3>
                </div>
                <StatusBadge
                  status={gate.status}
                  variant={STATUS_VARIANT[gate.status] ?? 'neutral'}
                  size="sm"
                />
              </div>

              <p className="text-sm text-foreground-muted mb-4 line-clamp-2">
                {gate.description}
              </p>

              {/* Threshold info */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <Target
                    className="h-4 w-4 text-foreground-muted flex-shrink-0"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-foreground-muted">
                    Threshold
                  </span>
                  <span className="ml-auto text-xs font-medium text-foreground font-mono tabular-nums">
                    ≥ {gate.threshold}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Layers
                    className="h-4 w-4 text-foreground-muted flex-shrink-0"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-foreground-muted">
                    Applicability
                  </span>
                  <span className="ml-auto text-xs text-foreground">
                    {gate.applicability.release_type.length > 0
                      ? gate.applicability.release_type.join(', ')
                      : 'All types'}
                    {gate.applicability.tier.length > 0 && (
                      <> · Tier {gate.applicability.tier.join(', ')}</>
                    )}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-foreground-muted">
                  Owner: {gate.owner}
                </span>
                <span className="text-xs text-foreground-muted font-mono tabular-nums">
                  {new Date(gate.updated_at).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default QualityGatesPage;
