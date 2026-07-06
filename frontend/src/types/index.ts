// ---------------------------------------------------------------------------
// EQIP — Shared TypeScript types & enums
// Single source of truth for the frontend; mirrors the API contract exactly.
// ---------------------------------------------------------------------------

// ========================== Enums ==========================

export type RoleEnum =
  | 'admin'
  | 'qa_manager'
  | 'qa_lead'
  | 'qa_engineer'
  | 'developer'
  | 'release_manager'
  | 'compliance_officer'
  | 'auditor'
  | 'viewer'
  | 'api_consumer';

export type UserStatus = 'active' | 'inactive' | 'locked';

export type TestCaseStatus = 'draft' | 'active' | 'deprecated' | 'archived';

export type AutomationStatus = 'manual' | 'automated' | 'hybrid' | 'planned';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type ExecutionStatus =
  | 'pending'
  | 'in_progress'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'skipped'
  | 'error';

export type QualityGateResult =
  | 'pass'
  | 'warning'
  | 'fail'
  | 'waived'
  | 'not_applicable';

export type IntegrationStatus = 'active' | 'inactive' | 'error';

export type GovernanceStatus = 'draft' | 'active' | 'deprecated';

export type EvidenceType = 'log' | 'screenshot' | 'video' | 'document' | 'report';

export type ReportType =
  | 'quality_summary'
  | 'test_coverage'
  | 'release_readiness'
  | 'compliance'
  | 'trend_analysis';

export type MetricCategory =
  | 'quality'
  | 'performance'
  | 'coverage'
  | 'compliance'
  | 'adoption';

// ========================== Generic wrappers ==========================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
}

// ========================== Auth ==========================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LogoutRequest {
  refresh_token: string;
}

// ========================== Users ==========================

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: RoleEnum;
  permissions: string[];
  status: UserStatus;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserDetail extends User {
  auth_source: string;
  vendor: boolean;
  manager: string | null;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  version: number;
}

export interface CreateUserRequest {
  first_name: string;
  last_name: string;
  email: string;
  role: RoleEnum;
  password: string;
  permissions?: string[];
  status?: UserStatus;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  role?: RoleEnum;
  permissions?: string[];
  status?: UserStatus;
  version: number;
}

// ========================== Roles ==========================

export interface RoleScope {
  segments: string[];
  applications: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  scope: RoleScope;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  version: number;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
  permissions: string[];
  scope: RoleScope;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: string[];
  scope?: RoleScope;
  version: number;
}

// ========================== Permissions ==========================

export interface Permission {
  id: string;
  name: string;
  description: string;
}

// ========================== Audit Logs ==========================

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string;
}

// ========================== Test Cases ==========================

export interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}

export interface TestCase {
  id: string;
  name: string;
  type: string;
  application_id: string;
  segment_id: string;
  owner: string;
  priority: Priority;
  status: TestCaseStatus;
  automation_status: AutomationStatus;
  framework: string | null;
  tags: string[];
  last_execution_date: string | null;
  last_execution_result: ExecutionStatus | null;
  created_at: string;
  updated_at: string;
}

export interface TestCaseDetail extends TestCase {
  version_label: string;
  linked_requirement: string | null;
  linked_release: string | null;
  evidence_requirements: string[];
  description: string | null;
  steps: TestStep[];
  created_by: string;
  updated_by: string;
  version: number;
}

export interface CreateTestCaseRequest {
  name: string;
  type: string;
  application_id: string;
  segment_id: string;
  owner: string;
  priority: Priority;
  status?: TestCaseStatus;
  automation_status?: AutomationStatus;
  framework?: string | null;
  version_label?: string;
  linked_requirement?: string | null;
  linked_release?: string | null;
  tags: string[];
  evidence_requirements: string[];
  description?: string | null;
  steps: TestStep[];
}

export interface UpdateTestCaseRequest {
  name?: string;
  type?: string;
  application_id?: string;
  segment_id?: string;
  owner?: string;
  priority?: Priority;
  status?: TestCaseStatus;
  automation_status?: AutomationStatus;
  framework?: string | null;
  version_label?: string;
  linked_requirement?: string | null;
  linked_release?: string | null;
  tags?: string[];
  evidence_requirements?: string[];
  description?: string | null;
  steps?: TestStep[];
  version: number;
}

export interface CloneTestCaseRequest {
  name?: string;
}

// ========================== Test Suites ==========================

export interface TestSuite {
  id: string;
  name: string;
  application_id: string;
  segment_id: string;
  owner: string;
  test_case_count: number;
  automation_coverage: number;
  last_execution_result: ExecutionStatus | null;
  pass_rate: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTestSuiteRequest {
  name: string;
  application_id: string;
  segment_id: string;
  owner: string;
  test_case_ids: string[];
  description?: string | null;
  execution_frequency?: string | null;
  environment_requirements: string[];
  test_data_requirements: string[];
}

export interface UpdateTestSuiteRequest {
  name?: string;
  application_id?: string;
  segment_id?: string;
  owner?: string;
  test_case_ids?: string[];
  description?: string | null;
  execution_frequency?: string | null;
  environment_requirements?: string[];
  test_data_requirements?: string[];
  version: number;
}

// ========================== Test Executions ==========================

export interface TestExecution {
  id: string;
  test_suite_id: string;
  test_suite_name: string;
  application_id: string;
  release_id: string | null;
  environment_id: string;
  trigger_type: string;
  start_time: string;
  end_time: string | null;
  duration: number;
  status: ExecutionStatus;
  executed_by: string;
  pass_count: number;
  fail_count: number;
  total_count: number;
  created_at: string;
}

export interface TestExecutionDetail extends TestExecution {
  pipeline_reference: string | null;
  build_number: string | null;
  commit_id: string | null;
  logs_url: string | null;
  screenshots_url: string[];
  video_url: string | null;
  defects_created: string[];
  failure_reason: string | null;
  ai_failure_analysis: string | null;
  recommended_remediation: string | null;
  blocked_count: number;
  skipped_count: number;
  evidence_ids: string[];
  created_by: string;
  updated_by: string;
  updated_at: string;
  version: number;
}

export interface CreateTestExecutionRequest {
  test_suite_id: string;
  application_id: string;
  release_id?: string | null;
  environment_id: string;
  trigger_type: string;
}

export interface UpdateTestExecutionRequest {
  status?: ExecutionStatus;
  end_time?: string | null;
  failure_reason?: string | null;
  defects_created?: string[];
  pass_count?: number;
  fail_count?: number;
  blocked_count?: number;
  skipped_count?: number;
  version: number;
}

// ========================== Releases ==========================

export interface Release {
  id: string;
  name: string;
  application_id: string;
  version: string;
  status: string;
  planned_date: string;
  release_type: string;
  tier: number;
  created_at: string;
  updated_at: string;
}

export interface ReleaseReadiness {
  release_id: string;
  release_name: string;
  application_id: string;
  overall_readiness_score: number;
  quality_gate_status: QualityGateResult;
  test_completion_percent: number;
  automation_execution_percent: number;
  open_critical_defects: number;
  risk_rating: Priority;
  recommendation: string;
  computed_at: string;
}

export interface GateResult {
  gate_id: string;
  gate_name: string;
  result: QualityGateResult;
  threshold: number;
  actual_value: number;
  evaluated_at: string;
  waiver_justification: string | null;
  waiver_approved_by: string | null;
}

export interface ReleaseGateResults {
  release_id: string;
  gates: GateResult[];
  overall_result: QualityGateResult;
  computed_at: string;
}

export interface UpdateGateResultRequest {
  gate_id: string;
  result: QualityGateResult;
  waiver_justification?: string | null;
}

export interface UpdateGateResultsRequest {
  gates: UpdateGateResultRequest[];
}

// ========================== Quality Gates ==========================

export interface QualityGateApplicability {
  tier: number[];
  release_type: string[];
}

export interface QualityGate {
  id: string;
  name: string;
  description: string;
  applicability: QualityGateApplicability;
  threshold: number;
  status: GovernanceStatus;
  owner: string;
  created_at: string;
  updated_at: string;
}

// ========================== Governance Procedures ==========================

export interface GovernanceProcedure {
  id: string;
  name: string;
  description: string;
  status: GovernanceStatus;
  owner: string;
  applicability: QualityGateApplicability;
  required_evidence: EvidenceType[];
  compliance_rule: string;
  created_at: string;
  updated_at: string;
}

export interface GovernanceAuditEntry {
  timestamp: string;
  user_id: string;
  action: string;
  changes: Record<string, unknown>;
}

export interface GovernanceProcedureDetail extends GovernanceProcedure {
  required_approval: string[];
  applicable_test_types: string[];
  audit_history: GovernanceAuditEntry[];
  created_by: string;
  updated_by: string;
  version: number;
}

export interface CreateGovernanceProcedureRequest {
  name: string;
  description: string;
  status?: GovernanceStatus;
  applicability: QualityGateApplicability;
  required_evidence: EvidenceType[];
  required_approval: string[];
  applicable_test_types: string[];
  compliance_rule: string;
  owner: string;
}

export interface UpdateGovernanceProcedureRequest {
  name?: string;
  description?: string;
  status?: GovernanceStatus;
  applicability?: QualityGateApplicability;
  required_evidence?: EvidenceType[];
  required_approval?: string[];
  applicable_test_types?: string[];
  compliance_rule?: string;
  owner?: string;
  version: number;
}

// ========================== Evidence ==========================

export interface Evidence {
  id: string;
  test_execution_id: string;
  evidence_type: EvidenceType;
  file_name: string;
  file_size: number;
  file_url: string;
  description: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

// ========================== Integrations ==========================

export interface RetryRules {
  max_retries: number;
  backoff: number;
}

export interface Integration {
  id: string;
  name: string;
  system_type: string;
  owner: string;
  connection_status: IntegrationStatus;
  last_sync: string | null;
  sync_frequency: string;
  error_count: number;
  authentication_method: string;
  data_objects_synced: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateIntegrationRequest {
  name: string;
  system_type: string;
  owner: string;
  sync_frequency: string;
  authentication_method: string;
  connection_config: Record<string, unknown>;
  data_objects_synced: string[];
  retry_rules: RetryRules;
}

export interface UpdateIntegrationRequest {
  name?: string;
  system_type?: string;
  owner?: string;
  sync_frequency?: string;
  authentication_method?: string;
  connection_config?: Record<string, unknown>;
  data_objects_synced?: string[];
  retry_rules?: RetryRules;
  version: number;
}

export interface SyncRequest {
  sync_type: 'full' | 'incremental';
}

export interface SyncResponse {
  integration_id: string;
  status: string;
  timestamp: string;
}

// ========================== Metrics ==========================

export interface MetricEntry {
  metric_name: string;
  value: number;
  trend: number[];
  inputs: Record<string, unknown>;
  computed_at: string;
}

export interface Metric {
  category: MetricCategory;
  metrics: MetricEntry[];
  filters_applied: Record<string, unknown>;
  cached: boolean;
}

// ========================== AI ==========================

export interface AISearchRequest {
  query: string;
  filters?: {
    application_id?: string | null;
    segment_id?: string | null;
  };
  limit?: number;
}

export interface AISearchResult {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet: string;
  relevance_score: number;
}

export interface AISearchResponse {
  results: AISearchResult[];
  total: number;
  cached: boolean;
  timestamp: string;
}

export interface AIAskRequest {
  question: string;
  filters?: {
    application_id?: string | null;
    segment_id?: string | null;
  };
}

export interface AIAskResponse {
  answer: string;
  confidence: number;
  data_sources: string[];
  cached: boolean;
  timestamp: string;
}

export interface AIPredictionRequest {
  entity_id: string;
  filters?: Record<string, unknown>;
}

export interface PredictionFactor {
  factor: string;
  impact: string;
  value: string;
}

export interface AIPredictionResponse {
  prediction_type: string;
  entity_id: string;
  risk_score: number;
  confidence: number;
  factors: PredictionFactor[];
  recommendations: string[];
  data_sources: string[];
  cached: boolean;
  timestamp: string;
}

// ========================== Reports ==========================

export interface ReportChart {
  chart_type: string;
  title: string;
  data: unknown[];
}

export interface ReportSection {
  title: string;
  data: Record<string, unknown>;
  charts: ReportChart[];
}

export interface Report {
  report_type: ReportType;
  title: string;
  generated_at: string;
  filters_applied: Record<string, unknown>;
  sections: ReportSection[];
  summary: string;
}

export interface ReportExportRequest {
  format: 'xlsx' | 'csv' | 'pdf' | 'pptx';
  filters: {
    application_id?: string | null;
    segment_id?: string | null;
    release_id?: string | null;
    from_date?: string | null;
    to_date?: string | null;
  };
}

export interface ReportExportResponse {
  export_id: string;
  status: string;
  report_type: ReportType;
  format: string;
  estimated_completion: string;
}

// ========================== Adoption & Impact ==========================

export interface FeatureUsage {
  test_repository: number;
  test_execution: number;
  ai_insights: number;
  reporting: number;
  governance: number;
}

export interface AdoptionImpact {
  active_users: number;
  active_users_trend: number[];
  segment_adoption_percent: number;
  application_adoption_percent: number;
  feature_usage: FeatureUsage;
  execution_volume: number;
  execution_volume_trend: number[];
  automation_growth: number;
  ai_copilot_usage: number;
  ai_generated_tests: number;
  ai_recommendation_adoption_percent: number;
  manual_effort_reduction_hours: number;
  testing_cycle_time_improvement_percent: number;
  defect_reduction_percent: number;
  cost_avoidance_dollars: number;
  productivity_gain_percent: number;
  business_value_score: number;
  computed_at: string;
}
