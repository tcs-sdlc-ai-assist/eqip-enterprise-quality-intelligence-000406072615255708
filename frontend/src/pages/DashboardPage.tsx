import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Link2,
  RefreshCw,
  Shield,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import apiClient from '@/api/client';
import { Alert } from '@/components/ui/Alert';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ExecutionStatus } from '@/types';

// ---------------------------------------------------------------------------
// Dashboard-specific types — mirrors the GET /dashboard API response.
// ---------------------------------------------------------------------------

interface StatTrend {
  direction: 'up' | 'down' | 'flat';
  value: number;
}

interface DashboardStats {
  total_test_cases: number;
  pass_rate: number;
  active_integrations: number;
  quality_score: number;
  total_test_cases_trend: StatTrend;
  pass_rate_trend: StatTrend;
  active_integrations_trend: StatTrend;
  quality_score_trend: StatTrend;
}

interface ExecutionTrendPoint {
  date: string;
  passed: number;
  failed: number;
}

interface QualityBreakdownEntry {
  category: string;
  score: number;
}

interface RecentExecution {
  id: string;
  suite: string;
  status: ExecutionStatus;
  pass_rate: number;
  date: string;
}

interface UpcomingRelease {
  id: string;
  name: string;
  target_date: string;
  readiness_score: number;
}

interface DashboardData {
  stats: DashboardStats;
  execution_trend: ExecutionTrendPoint[];
  quality_breakdown: QualityBreakdownEntry[];
  recent_executions: RecentExecution[];
  upcoming_releases: UpcomingRelease[];
}

// ---------------------------------------------------------------------------
// Stat card helper
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  trend: StatTrend;
}

function StatCard({ icon: Icon, label, value, trend }: StatCardProps) {
  const isUp = trend.direction === 'up';
  const isDown = trend.direction === 'down';

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        {trend.direction !== 'flat' && (
          <span
            className={
              isUp
                ? 'inline-flex items-center gap-0.5 text-xs font-medium text-success'
                : 'inline-flex items-center gap-0.5 text-xs font-medium text-error'
            }
          >
            {isUp ? (
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            )}
            {trend.value}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground font-mono tabular-nums">{value}</p>
        <p className="text-sm text-foreground-muted mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Chart tooltip (shared)
// ---------------------------------------------------------------------------

interface ChartTooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadEntry[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-surface rounded-md p-3 text-xs shadow">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-foreground-muted">
          <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date formatter
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<DashboardData>('/dashboard');
      setData(response.data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load dashboard data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]} />
          <h1 className="text-2xl font-semibold text-foreground mt-4">Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard className="min-h-[320px]" />
          <SkeletonCard className="min-h-[320px]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard className="min-h-[280px]" />
          <SkeletonCard className="min-h-[280px]" />
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]} />
          <h1 className="text-2xl font-semibold text-foreground mt-4">Dashboard</h1>
        </div>
        <Alert variant="error" title="Unable to load dashboard">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchDashboard}
            className="mt-3"
          >
            <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const { stats, execution_trend, quality_breakdown, recent_executions, upcoming_releases } = data;

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]} />
        <h1 className="text-2xl font-semibold text-foreground mt-4">Dashboard</h1>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          icon={CheckCircle2}
          label="Total Test Cases"
          value={stats.total_test_cases.toLocaleString()}
          trend={stats.total_test_cases_trend}
        />
        <StatCard
          icon={Activity}
          label="Pass Rate"
          value={`${stats.pass_rate.toFixed(1)}%`}
          trend={stats.pass_rate_trend}
        />
        <StatCard
          icon={Link2}
          label="Active Integrations"
          value={stats.active_integrations.toLocaleString()}
          trend={stats.active_integrations_trend}
        />
        <StatCard
          icon={Shield}
          label="Quality Score"
          value={stats.quality_score.toFixed(1)}
          trend={stats.quality_score_trend}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Execution Trend */}
        <Card padding="md">
          <h2 className="text-base font-medium text-foreground mb-6">Test Execution Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={execution_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-raw, #e3e6e3)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  tick={{ fontSize: 12, fill: 'var(--color-foreground-muted-raw, #7c827c)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--color-foreground-muted-raw, #7c827c)' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="passed"
                  name="Passed"
                  stroke="#60a010"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  name="Failed"
                  stroke="#a3a8a3"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Quality Score Breakdown */}
        <Card padding="md">
          <h2 className="text-base font-medium text-foreground mb-6">Quality Score Breakdown</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quality_breakdown ?? []} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-raw, #e3e6e3)" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 12, fill: 'var(--color-foreground-muted-raw, #7c827c)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: 'var(--color-foreground-muted-raw, #7c827c)' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="score"
                  name="Score"
                  fill="#60a010"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Executions */}
        <Card padding="none">
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-base font-medium text-foreground">Recent Executions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-raised">
                  <th
                    scope="col"
                    className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
                  >
                    Suite
                  </th>
                  <th
                    scope="col"
                    className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
                  >
                    Pass Rate
                  </th>
                  <th
                    scope="col"
                    className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {(recent_executions ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-sm text-foreground-muted">
                      No recent executions.
                    </td>
                  </tr>
                )}
                {(recent_executions ?? []).map((exec) => (
                  <tr
                    key={exec.id}
                    className="border-b border-border hover:bg-surface-raised transition-colors duration-fast"
                  >
                    <td className="py-3 px-6 text-sm text-foreground">{exec.suite}</td>
                    <td className="py-3 px-6">
                      <StatusBadge status={exec.status} size="sm" />
                    </td>
                    <td className="py-3 px-6 text-sm text-foreground font-mono tabular-nums">
                      {exec.pass_rate.toFixed(1)}%
                    </td>
                    <td className="py-3 px-6 text-sm text-foreground-muted">
                      {formatDate(exec.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Upcoming Releases */}
        <Card padding="md">
          <h2 className="text-base font-medium text-foreground mb-6">Upcoming Releases</h2>
          {(upcoming_releases ?? []).length === 0 ? (
            <p className="text-sm text-foreground-muted py-8 text-center">
              No upcoming releases.
            </p>
          ) : (
            <ul className="space-y-5">
              {(upcoming_releases ?? []).map((release) => (
                <li key={release.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{release.name}</span>
                    <span className="text-xs text-foreground-muted font-mono tabular-nums">
                      {release.readiness_score}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all duration-fast"
                        style={{ width: `${Math.min(release.readiness_score, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-foreground-muted">
                    <Calendar className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    <span>{formatDate(release.target_date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
