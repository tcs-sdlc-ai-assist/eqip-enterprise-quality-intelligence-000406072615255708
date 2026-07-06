import { useCallback, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileBarChart,
  FileText,
  RefreshCw,
  Shield,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { exportReport, getReport } from '@/api/reports';
import { Alert } from '@/components/ui/Alert';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { Report, ReportType } from '@/types';

// ---------------------------------------------------------------------------
// Report type definitions
// ---------------------------------------------------------------------------

interface ReportTypeOption {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const REPORT_TYPES: ReportTypeOption[] = [
  {
    type: 'quality_summary',
    label: 'Quality Summary',
    description: 'Overall quality metrics and trends across all applications.',
    icon: Shield,
  },
  {
    type: 'test_coverage',
    label: 'Test Coverage',
    description: 'Test coverage analysis by application, segment, and type.',
    icon: CheckCircle2,
  },
  {
    type: 'release_readiness',
    label: 'Release Readiness',
    description: 'Readiness assessment for upcoming releases with gate results.',
    icon: FileBarChart,
  },
  {
    type: 'compliance',
    label: 'Compliance',
    description: 'Governance and compliance status across procedures and gates.',
    icon: FileText,
  },
  {
    type: 'trend_analysis',
    label: 'Trend Analysis',
    description: 'Historical trends in quality, coverage, and execution metrics.',
    icon: TrendingUp,
  },
];

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

// ---------------------------------------------------------------------------
// Chart colors (restrained palette)
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  '#60a010',
  '#a3a8a3',
  '#3b82f6',
  '#f59e0b',
  '#6b7280',
  '#8b5cf6',
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
// Section data renderer
// ---------------------------------------------------------------------------

function SectionDataTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-raised">
            <th
              scope="col"
              className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
            >
              Metric
            </th>
            <th
              scope="col"
              className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-border">
              <td className="py-3 px-6 text-sm text-foreground">
                {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </td>
              <td className="py-3 px-6 text-sm text-foreground-muted font-mono tabular-nums">
                {typeof value === 'number'
                  ? value.toLocaleString()
                  : String(value ?? '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section chart renderer
// ---------------------------------------------------------------------------

interface SectionChartProps {
  chartType: string;
  title: string;
  data: unknown[];
}

function SectionChart({ chartType, title, data }: SectionChartProps) {
  const chartData = data as Record<string, unknown>[];
  if (!chartData?.length) return null;

  const keys = Object.keys(chartData[0] ?? {});
  const labelKey = keys[0] ?? 'name';
  const valueKeys = keys.slice(1);

  if (chartType === 'pie') {
    return (
      <div>
        <h4 className="text-sm font-medium text-foreground mb-4">{title}</h4>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey={valueKeys[0] ?? 'value'}
                nameKey={labelKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                strokeWidth={1}
                stroke="var(--color-border-raw, #e3e6e3)"
              >
                {chartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Default: bar chart
  return (
    <div>
      <h4 className="text-sm font-medium text-foreground mb-4">{title}</h4>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={28}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border-raw, #e3e6e3)"
            />
            <XAxis
              dataKey={labelKey}
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
            {valueKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportsPage
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');

  const fetchReport = useCallback(
    async (type: ReportType) => {
      setSelectedType(type);
      setLoading(true);
      setError(null);
      setReport(null);
      try {
        const data = await getReport(type);
        setReport(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load report. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleExport = useCallback(async () => {
    if (!selectedType) return;
    setExporting(true);
    try {
      const blob = await exportReport(selectedType, exportFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedType}_report.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Export failed. Please try again.';
      setError(message);
    } finally {
      setExporting(false);
    }
  }, [selectedType, exportFormat]);

  const handleRetry = useCallback(() => {
    if (selectedType) {
      fetchReport(selectedType);
    }
  }, [selectedType, fetchReport]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Reports' }]}
        />
        <h1 className="text-2xl font-semibold text-foreground mt-4">Reports</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Generate and export quality reports across your applications.
        </p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {REPORT_TYPES.map((rt) => {
          const Icon = rt.icon;
          const isActive = selectedType === rt.type;

          return (
            <button
              key={rt.type}
              type="button"
              onClick={() => fetchReport(rt.type)}
              className={`text-left border rounded-md p-5 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-950'
                  : 'border-border bg-surface hover:bg-surface-raised'
              }`}
            >
              <Icon
                className={`h-6 w-6 mb-3 ${
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-foreground-muted'
                }`}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <h3 className="text-sm font-medium text-foreground">{rt.label}</h3>
              <p className="text-xs text-foreground-muted mt-1 line-clamp-2">
                {rt.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          <SkeletonCard className="min-h-[120px]" />
          <SkeletonCard className="min-h-[300px]" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <Alert variant="error" title="Unable to load report">
          <p>{error}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRetry}
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
      )}

      {/* Report content */}
      {!loading && report && (
        <div className="space-y-6">
          {/* Summary + export */}
          <Card padding="md" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-lg font-medium text-foreground">
                  {report.title}
                </h2>
                <p className="text-xs text-foreground-muted mt-1">
                  Generated{' '}
                  {new Date(report.generated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
                  aria-label="Export format"
                >
                  {EXPORT_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleExport}
                  loading={exporting}
                >
                  <Download
                    className="h-4 w-4"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  Export
                </Button>
              </div>
            </div>

            {/* Summary text */}
            <div className="border-t border-border pt-4">
              <p className="text-sm text-foreground leading-relaxed">
                {report.summary}
              </p>
            </div>
          </Card>

          {/* Sections */}
          {(report.sections ?? []).map((section, sIdx) => (
            <Card key={sIdx} padding="none" className="overflow-hidden">
              <div className="px-6 pt-6 pb-4">
                <h3 className="text-base font-medium text-foreground">
                  {section.title}
                </h3>
              </div>

              {/* Data table */}
              <SectionDataTable data={section.data} />

              {/* Charts */}
              {(section.charts ?? []).length > 0 && (
                <div className="px-6 py-6 space-y-6 border-t border-border">
                  {section.charts.map((chart, cIdx) => (
                    <SectionChart
                      key={cIdx}
                      chartType={chart.chart_type}
                      title={chart.title}
                      data={chart.data}
                    />
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !report && !error && (
        <EmptyState
          icon={BarChart3}
          title="Select a report type"
          description="Choose a report type above to generate and view quality reports."
        />
      )}
    </div>
  );
}
