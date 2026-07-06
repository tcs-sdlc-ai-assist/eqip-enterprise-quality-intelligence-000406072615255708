import { useCallback, useState } from 'react';
import {
  Brain,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { aiAsk, aiPredict, aiSearch } from '@/api/ai';
import { Alert } from '@/components/ui/Alert';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { SearchBar } from '@/components/ui/SearchBar';
import { Select } from '@/components/ui/Select';
import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import type {
  AIAskResponse,
  AIPredictionResponse,
  AISearchResult,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_TABS = [
  { id: 'search', label: 'Search' },
  { id: 'ask', label: 'Ask' },
  { id: 'predictions', label: 'Predictions' },
] as const;

const PREDICTION_TYPES = [
  { value: 'defect_risk', label: 'Defect Risk' },
  { value: 'test_failure', label: 'Test Failure' },
  { value: 'release_risk', label: 'Release Risk' },
  { value: 'coverage_gap', label: 'Coverage Gap' },
];

const ENTITY_VARIANT_MAP: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
  test_case: 'info',
  test_suite: 'success',
  release: 'warning',
  defect: 'neutral',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function impactColor(impact: string): string {
  const lower = impact.toLowerCase();
  if (lower === 'high') return 'text-error';
  if (lower === 'medium') return 'text-warning';
  return 'text-foreground-muted';
}

// ---------------------------------------------------------------------------
// Search Tab
// ---------------------------------------------------------------------------

function SearchTab() {
  const [query, setQuery] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('');
  const [results, setResults] = useState<AISearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await aiSearch({
        query: query.trim(),
        filters: applicationFilter
          ? { application_id: applicationFilter }
          : undefined,
        limit: 20,
      });
      setResults(response.results ?? []);
      setTotal(response.total ?? 0);
      setSearched(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Search failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [query, applicationFilter]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search controls */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search test cases, suites, releases…"
              debounceMs={0}
            />
          </div>
          <div className="w-full sm:w-48">
            <input
              type="text"
              value={applicationFilter}
              onChange={(e) => setApplicationFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Application ID"
              className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              aria-label="Application ID filter"
            />
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleSearch}
            loading={loading}
            disabled={!query.trim()}
          >
            <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Search
          </Button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="error" title="Search Error">
          <p>{error}</p>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && searched && results.length === 0 && (
        <EmptyState
          icon={Search}
          title="No results found"
          description="Try adjusting your search query or filters."
        />
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-foreground-muted">
            Showing {results.length} of {total} results
          </p>
          {results.map((result) => (
            <Card key={result.entity_id} padding="md" className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge
                      status={result.entity_type.replace(/_/g, ' ')}
                      variant={ENTITY_VARIANT_MAP[result.entity_type] ?? 'neutral'}
                      size="sm"
                    />
                    <span className="text-xs text-foreground-muted font-mono tabular-nums">
                      {result.entity_id}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-foreground truncate">
                    {result.title}
                  </h3>
                  <p className="text-sm text-foreground-muted mt-1 line-clamp-2">
                    {result.snippet}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-foreground-muted">Relevance</p>
                  <p className="text-lg font-semibold text-foreground font-mono tabular-nums">
                    {formatConfidence(result.relevance_score)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !searched && !error && (
        <EmptyState
          icon={Search}
          title="Search EQIP with AI"
          description="Enter a query to search across test cases, suites, releases, and more."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ask Tab
// ---------------------------------------------------------------------------

function AskTab() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AIAskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = useCallback(async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiAsk({ question: question.trim() });
      setResponse(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to get an answer. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [question]);

  const handleFollowUp = (followUp: string) => {
    setQuestion(followUp);
    setResponse(null);
  };

  return (
    <div className="space-y-6">
      {/* Question input */}
      <Card padding="md" className="space-y-4">
        <FormField label="Your Question" name="ai-question" required>
          <textarea
            id="ai-question"
            name="ai-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about your quality data…"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast resize-y"
            aria-required="true"
          />
        </FormField>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={handleAsk}
            loading={loading}
            disabled={!question.trim()}
          >
            <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Ask
          </Button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="error" title="Error">
          <p>{error}</p>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <Card padding="md" className="space-y-4">
          <Skeleton height="16px" width="30%" />
          <SkeletonText lines={4} />
          <Skeleton height="12px" width="50%" />
        </Card>
      )}

      {/* Answer */}
      {!loading && response && (
        <Card padding="md" className="space-y-5">
          {/* Confidence */}
          <div className="flex items-center gap-3">
            <Brain
              className="h-5 w-5 text-primary-600 dark:text-primary-400"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-foreground">AI Answer</span>
            <span className="ml-auto text-xs text-foreground-muted">
              Confidence:{' '}
              <span className="font-mono tabular-nums font-medium text-foreground">
                {formatConfidence(response.confidence)}
              </span>
            </span>
          </div>

          {/* Answer text */}
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {response.answer}
          </div>

          {/* Data sources */}
          {(response.data_sources ?? []).length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
                Data Sources
              </p>
              <ul className="space-y-1">
                {response.data_sources.map((source, i) => (
                  <li
                    key={i}
                    className="text-sm text-foreground-muted flex items-center gap-1.5"
                  >
                    <span className="h-1 w-1 rounded-full bg-primary-600 dark:bg-primary-400 flex-shrink-0" />
                    {source}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up suggestions (rendered as clickable chips) */}
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
              Follow-up Questions
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                'What are the top failing test suites?',
                'Show me coverage gaps',
                'Which releases are at risk?',
              ].map((followUp) => (
                <button
                  key={followUp}
                  type="button"
                  onClick={() => handleFollowUp(followUp)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground border border-border rounded hover:bg-surface-raised transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                  {followUp}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {!loading && !response && !error && (
        <EmptyState
          icon={MessageSquare}
          title="Ask EQIP AI"
          description="Type a question about your quality data and get an AI-powered answer with confidence scores."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Predictions Tab
// ---------------------------------------------------------------------------

function PredictionsTab() {
  const [predictionType, setPredictionType] = useState(PREDICTION_TYPES[0].value);
  const [entityId, setEntityId] = useState('');
  const [result, setResult] = useState<AIPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePredict = useCallback(async () => {
    if (!entityId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiPredict(predictionType, {
        entity_id: entityId.trim(),
      });
      setResult(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Prediction failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [predictionType, entityId]);

  return (
    <div className="space-y-6">
      {/* Parameters */}
      <Card padding="md" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Prediction Type"
            name="prediction-type"
            options={PREDICTION_TYPES}
            value={predictionType}
            onChange={(e) => setPredictionType(e.target.value)}
          />
          <FormField label="Entity ID" name="entity-id" required>
            <input
              id="entity-id"
              name="entity-id"
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="e.g. TC-001 or REL-005"
              className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors duration-fast"
              aria-required="true"
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={handlePredict}
            loading={loading}
            disabled={!entityId.trim()}
          >
            <TrendingUp className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Predict
          </Button>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="error" title="Prediction Error">
          <p>{error}</p>
        </Alert>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard className="min-h-[200px]" />
          <SkeletonCard className="min-h-[200px]" />
        </div>
      )}

      {/* Result */}
      {!loading && result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score & confidence */}
          <Card padding="md" className="space-y-5">
            <h3 className="text-base font-medium text-foreground">
              {result.prediction_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </h3>
            <div className="flex items-end gap-8">
              <div>
                <p className="text-xs text-foreground-muted uppercase tracking-wider mb-1">
                  Risk Score
                </p>
                <p className="text-3xl font-semibold text-foreground font-mono tabular-nums">
                  {(result.risk_score * 100).toFixed(0)}
                  <span className="text-base text-foreground-muted ml-0.5">%</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-muted uppercase tracking-wider mb-1">
                  Confidence
                </p>
                <p className="text-3xl font-semibold text-foreground font-mono tabular-nums">
                  {formatConfidence(result.confidence)}
                </p>
              </div>
            </div>

            {/* Recommendations */}
            {(result.recommendations ?? []).length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-2">
                  Recommendations
                </p>
                <ul className="space-y-1.5">
                  {result.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="text-sm text-foreground flex items-start gap-2"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-600 dark:bg-primary-400 flex-shrink-0 mt-1.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Factors */}
          <Card padding="none">
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-base font-medium text-foreground">Contributing Factors</h3>
            </div>
            {(result.factors ?? []).length === 0 ? (
              <p className="px-6 pb-6 text-sm text-foreground-muted">
                No contributing factors identified.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-surface-raised">
                      <th
                        scope="col"
                        className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
                      >
                        Factor
                      </th>
                      <th
                        scope="col"
                        className="text-left text-xs font-medium text-foreground-muted uppercase tracking-wider py-3 px-6"
                      >
                        Impact
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
                    {result.factors.map((factor, i) => (
                      <tr
                        key={i}
                        className="border-b border-border"
                      >
                        <td className="py-3 px-6 text-sm text-foreground">
                          {factor.factor}
                        </td>
                        <td className={`py-3 px-6 text-sm font-medium ${impactColor(factor.impact)}`}>
                          {factor.impact}
                        </td>
                        <td className="py-3 px-6 text-sm text-foreground-muted font-mono tabular-nums">
                          {factor.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Data sources */}
            {(result.data_sources ?? []).length > 0 && (
              <div className="px-6 py-4 border-t border-border">
                <p className="text-xs text-foreground-muted">
                  Sources: {result.data_sources.join(', ')}
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {!loading && !result && !error && (
        <EmptyState
          icon={TrendingUp}
          title="AI Predictions"
          description="Select a prediction type and entity to get AI-powered risk analysis and recommendations."
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIInsightsPage
// ---------------------------------------------------------------------------

export default function AIInsightsPage() {
  const [activeTab, setActiveTab] = useState<string>('search');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'AI Insights' }]}
        />
        <h1 className="text-2xl font-semibold text-foreground mt-4">AI Insights</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Search, ask questions, and get AI-powered predictions across your quality data.
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={[...AI_TABS]} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab panels */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'search' && <SearchTab />}
        {activeTab === 'ask' && <AskTab />}
        {activeTab === 'predictions' && <PredictionsTab />}
      </div>
    </div>
  );
}
