import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Alert } from '@/components/ui/Alert';

import { getMetrics } from '@/api/metrics';

import type { Metric, MetricCategory, MetricEntry } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_TABS: { id: MetricCategory; label: string }[] = [
  { id: 'quality', label: 'Quality' },
  { id: 'performance', label: 'Performance' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'adoption', label: 'Adoption' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(str: string): string {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: number, name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('percent') || lower.includes('rate') || lower.includes('coverage')) {
    return `${value.toFixed(1)}%`;
  }
  if (lower.includes('time') || lower.includes('duration') || lower.includes('latency')) {
    if (value >= 3600) return `${(value / 3600).toFixed(1)}h`;
    if (value >= 60) return `${(value / 60).toFixed(1)}m`;
    return `${value.toFixed(1)}s`;
  }
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
}

function getTrendDirection(trend: number[]): 'up' | 'down' | 'flat' {
  if (!trend || trend.length < 2) return 'flat';
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (last > prev) return 'up';
  if (last < prev) return 'down';
  return 'flat';
}

function getTrendPercent(trend: number[]): number {
  if (!trend || trend.length < 2) return 0;
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (prev === 0) return 0;
  return Math.abs(((last - prev) / prev) * 100);
}

// ---------------------------------------------------------------------------
// Sparkline chart tooltip
// ---------------------------------------------------------------------------

interface SparklineTooltipPayloadEntry {
  value: number;
}

interface SparklineTooltipProps {
  active?: boolean;
  payload?: SparklineTooltipPayloadEntry[];
}

function SparklineTooltip({ active, payload }: SparklineTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-surface rounded px-2 py-1 text-xs shadow">
      <span className="font-medium text-foreground font-mono tabular-nums">
        {payload[0].value.toFixed(2)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline component
// ---------------------------------------------------------------------------

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;

  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip content={<SparklineTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGrad-${color.replace('#', '')})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend indicator
// ---------------------------------------------------------------------------

function TrendIndicator({ trend }: { trend: number[] }) {
  const direction = getTrendDirection(trend);
  const percent = getTrendPercent(trend);

  if (direction === 'flat') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground-muted">
        <Minus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
        0%
      </span>
    );
  }

  const isUp = direction === 'up';

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isUp ? 'text-success' : 'text-error'
      }`}
    >
      {isUp ? (
        <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      )}
      {percent.toFixed(1)}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({ entry }: { entry: MetricEntry }) {
  const direction = getTrendDirection(entry.trend);
  const sparkColor = direction === 'down' ? '#a3a8a3' : '#60a010';

  return (
    <Card padding="md" className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{capitalize(entry.metric_name)}</h3>
        <TrendIndicator trend={entry.trend} />
      </div>

      {/* Value */}
      <p className="text-3xl font-semibold text-foreground font-mono tabular-nums leading-tight">
        {formatValue(entry.value, entry.metric_name)}
      </p>

      {/* Sparkline */}
      {entry.trend && entry.trend.length >= 2 && (
        <Sparkline data={entry.trend} color={sparkColor} />
      )}

      {/* Computed at */}
      <p className="text-xs text-foreground-muted">
        Updated{' '}
        {(() => {
          try {
            return new Date(entry.computed_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          } catch {
            return entry.computed_at;
          }
        })()}
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// MetricsPage
// ---------------------------------------------------------------------------

function MetricsPage() {
  const [activeTab, setActiveTab] = useState<MetricCategory>('quality');
  const [metricsData, setMetricsData] = useState<Metric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch metrics for the active category ----
  const fetchMetrics = useCallback(async (category: MetricCategory) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMetrics(category);
      setMetricsData(res ?? []);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? 'Failed to load metrics');
      } else {
        setError('Failed to load metrics');
      }
      setMetricsData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(activeTab);
  }, [activeTab, fetchMetrics]);

  // ---- Handle tab change ----
  const handleTabChange = useCallback((id: string) => {
    setActiveTab(id as MetricCategory);
  }, []);

  // ---- Flatten metric entries from the response ----
  const entries: MetricEntry[] = (metricsData ?? []).flatMap((m) => m.metrics ?? []);

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Metrics' }]} />
        <h1 className="text-2xl font-semibold text-foreground mt-4">Metrics</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Track quality, performance, coverage, compliance, and adoption metrics across your testing portfolio.
        </p>
      </div>

      {/* ── Category tabs ── */}
      <Tabs
        tabs={CATEGORY_TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {/* ── Tab panel ── */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <Alert variant="error" title={`Unable to load ${capitalize(activeTab)} metrics`}>
            <p>{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchMetrics(activeTab)}
              className="mt-3"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Retry
            </Button>
          </Alert>
        )}

        {/* Empty */}
        {!loading && !error && entries.length === 0 && (
          <EmptyState
            icon={BarChart3}
            title={`No ${capitalize(activeTab)} metrics available`}
            description="Metrics will appear here once data has been collected and computed."
          />
        )}

        {/* Metric cards */}
        {!loading && !error && entries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {entries.map((entry) => (
              <MetricCard key={entry.metric_name} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricsPage;
