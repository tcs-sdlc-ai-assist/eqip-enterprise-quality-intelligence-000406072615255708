import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Clock,
  DollarSign,
  Minus,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getAdoptionImpact } from '@/api/adoption';
import { Alert } from '@/components/ui/Alert';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { AdoptionImpact } from '@/types';

// ---------------------------------------------------------------------------
// Metric card definitions
// ---------------------------------------------------------------------------

interface MetricCardDef {
  key: keyof AdoptionImpact;
  label: string;
  icon: React.ElementType;
  format: (v: number) => string;
  suffix?: string;
  /** Key for the comparison value (previous period) — derived from the same data */
  previousKey?: keyof AdoptionImpact;
  /** Key for the change percentage */
  changeKey?: keyof AdoptionImpact;
}

const METRIC_CARDS: MetricCardDef[] = [
  {
    key: 'active_users',
    label: 'Active Users',
    icon: Users,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'segment_adoption_percent',
    label: 'Segment Adoption',
    icon: TrendingUp,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'application_adoption_percent',
    label: 'Application Adoption',
    icon: BarChart3,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'execution_volume',
    label: 'Execution Volume',
    icon: Zap,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'automation_growth',
    label: 'Automation Growth',
    icon: TrendingUp,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'ai_copilot_usage',
    label: 'AI Copilot Usage',
    icon: Bot,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'ai_generated_tests',
    label: 'AI Generated Tests',
    icon: Bot,
    format: (v) => v.toLocaleString(),
  },
  {
    key: 'ai_recommendation_adoption_percent',
    label: 'AI Recommendation Adoption',
    icon: Bot,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'manual_effort_reduction_hours',
    label: 'Manual Effort Saved',
    icon: Clock,
    format: (v) => `${v.toLocaleString()} hrs`,
  },
  {
    key: 'testing_cycle_time_improvement_percent',
    label: 'Cycle Time Improvement',
    icon: Clock,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'defect_reduction_percent',
    label: 'Defect Reduction',
    icon: TrendingUp,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'cost_avoidance_dollars',
    label: 'Cost Avoidance',
    icon: DollarSign,
    format: (v) =>
      `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString()}`,
  },
  {
    key: 'productivity_gain_percent',
    label: 'Productivity Gain',
    icon: Zap,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: 'business_value_score',
    label: 'Business Value Score',
    icon: BarChart3,
    format: (v) => v.toFixed(1),
  },
];

// ---------------------------------------------------------------------------
// Chart tooltip
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
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.name} className="text-foreground-muted">
          <span
            className="inline-block h-2 w-2 rounded-full mr-1.5"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{' '}
          <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card component
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  icon: React.ElementType;
  currentValue: string;
  changePercent: number | null;
}

function MetricCard({
  label,
  icon: Icon,
  currentValue,
  changePercent,
}: MetricCardProps) {
  const isPositive = changePercent !== null && changePercent > 0;
  const isNegative = changePercent !== null && changePercent < 0;
  const isFlat = changePercent === null || changePercent === 0;

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400">
          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        {!isFlat && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-medium ${
              isPositive ? 'text-success' : 'text-error'
            }`}
          >
            {isPositive ? (
              <ArrowUpRight
                className="h-3.5 w-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            ) : (
              <ArrowDownRight
                className="h-3.5 w-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
            {Math.abs(changePercent ?? 0).toFixed(1)}%
          </span>
        )}
        {isFlat && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-foreground-muted">
            <Minus
              className="h-3.5 w-3.5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            0%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground font-mono tabular-nums">
          {currentValue}
        </p>
        <p className="text-sm text-foreground-muted mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Derive change percentages from trend arrays
// ---------------------------------------------------------------------------

function deriveTrendChange(trend: number[] | undefined): number | null {
  if (!trend || trend.length < 2) return null;
  const prev = trend[trend.length - 2];
  const curr = trend[trend.length - 1];
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ---------------------------------------------------------------------------
// Build bar chart data from feature_usage
// ---------------------------------------------------------------------------

function buildFeatureUsageData(
  data: AdoptionImpact,
): { feature: string; usage: number }[] {
  if (!data.feature_usage) return [];
  return [
    { feature: 'Test Repository', usage: data.feature_usage.test_repository },
    { feature: 'Test Execution', usage: data.feature_usage.test_execution },
    { feature: 'AI Insights', usage: data.feature_usage.ai_insights },
    { feature: 'Reporting', usage: data.feature_usage.reporting },
    { feature: 'Governance', usage: data.feature_usage.governance },
  ];
}

// ---------------------------------------------------------------------------
// AdoptionPage
// ---------------------------------------------------------------------------

export default function AdoptionPage() {
  const [data, setData] = useState<AdoptionImpact | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdoptionImpact();
      // API returns an array; use the first entry
      const entry = Array.isArray(result) ? result[0] ?? null : result;
      setData(entry);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load adoption data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Loading ----
  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Breadcrumb
            items={[{ label: 'Home', href: '/' }, { label: 'Adoption & Impact' }]}
          />
          <h1 className="text-2xl font-semibold text-foreground mt-4">
            Adoption &amp; Impact
          </h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard className="min-h-[320px]" />
      </div>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <Breadcrumb
            items={[{ label: 'Home', href: '/' }, { label: 'Adoption & Impact' }]}
          />
          <h1 className="text-2xl font-semibold text-foreground mt-4">
            Adoption &amp; Impact
          </h1>
        </div>
        <Alert variant="error" title="Unable to load adoption data">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchData}
            className="mt-3"
          >
            <RefreshCw
              className="h-4 w-4"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  // Derive change percentages from trend arrays where available
  const activeUsersChange = deriveTrendChange(data.active_users_trend);
  const executionVolumeChange = deriveTrendChange(data.execution_volume_trend);

  // Build a change map for each metric card
  const changeMap: Partial<Record<keyof AdoptionImpact, number | null>> = {
    active_users: activeUsersChange,
    execution_volume: executionVolumeChange,
  };

  const featureUsageData = buildFeatureUsageData(data);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Adoption & Impact' }]}
        />
        <h1 className="text-2xl font-semibold text-foreground mt-4">
          Adoption &amp; Impact
        </h1>
        <p className="text-sm text-foreground-muted mt-1">
          Track platform adoption metrics and business impact across your
          organization.
        </p>
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {METRIC_CARDS.map((def) => {
          const rawValue = data[def.key];
          const numericValue =
            typeof rawValue === 'number' ? rawValue : 0;

          return (
            <MetricCard
              key={def.key}
              label={def.label}
              icon={def.icon}
              currentValue={def.format(numericValue)}
              changePercent={changeMap[def.key] ?? null}
            />
          );
        })}
      </div>

      {/* Feature usage bar chart */}
      {featureUsageData.length > 0 && (
        <Card padding="md">
          <h2 className="text-base font-medium text-foreground mb-6">
            Feature Usage
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureUsageData} barSize={32}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-raw, #e3e6e3)"
                />
                <XAxis
                  dataKey="feature"
                  tick={{
                    fontSize: 12,
                    fill: 'var(--color-foreground-muted-raw, #7c827c)',
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 12,
                    fill: 'var(--color-foreground-muted-raw, #7c827c)',
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="usage"
                  name="Usage"
                  fill="#60a010"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Computed timestamp */}
      {data.computed_at && (
        <p className="text-xs text-foreground-muted text-right">
          Last computed:{' '}
          {new Date(data.computed_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}
