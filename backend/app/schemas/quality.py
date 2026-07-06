"""Request / response schemas for EQIP Quality & Execution entities.

All response schemas inherit ``MongoModel`` so ``_id`` is coerced to ``id``
automatically.  Every ObjectId reference field uses ``PyObjectId`` to avoid
``ValidationError`` ("input_type=ObjectId") at request time.
"""

import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.base import MongoModel, PyObjectId


# ── Embedded sub-schemas ────────────────────────────────────────────────


class TestStepSchema(BaseModel):
    """A single test step (embedded in test case create/update/response)."""

    model_config = ConfigDict(populate_by_name=True)

    step_number: int
    action: str
    expected_result: str


class TestExecutionResultSchema(BaseModel):
    """Individual test-case result within an execution response."""

    model_config = ConfigDict(populate_by_name=True)

    test_case_id: str
    status: str  # ExecutionStatus
    actual_result: str = ""
    evidence_ids: list[str] = Field(default_factory=list)
    notes: str = ""


class QualityGateThresholdSchema(BaseModel):
    """Threshold definition embedded in a quality gate."""

    model_config = ConfigDict(populate_by_name=True)

    metric: str
    operator: str
    value: float


class ApplicabilitySchema(BaseModel):
    """Applicability scope for quality gates and governance procedures."""

    model_config = ConfigDict(populate_by_name=True)

    tier: list[int] = Field(default_factory=list)
    release_type: list[str] = Field(default_factory=list)


class GateResultItemSchema(BaseModel):
    """A single gate evaluation result within a release gate-results response."""

    model_config = ConfigDict(populate_by_name=True)

    gate_id: str
    gate_name: str
    result: str  # QualityGateResult
    threshold: float = 0
    actual_value: float = 0
    evaluated_at: Optional[str] = None
    waiver_justification: Optional[str] = None
    waiver_approved_by: Optional[str] = None


class AuditHistoryEntrySchema(BaseModel):
    """Audit history entry embedded in governance procedure responses."""

    model_config = ConfigDict(populate_by_name=True)

    timestamp: str
    user_id: str
    action: str
    changes: dict = Field(default_factory=dict)


# ═══════════════════════════════════════════════════════════════════════
# Test Case schemas
# ═══════════════════════════════════════════════════════════════════════


class TestCaseCreate(BaseModel):
    """Request body for ``POST /api/v1/test-cases``."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    type: str
    application_id: str
    segment_id: Optional[str] = None
    owner: Optional[str] = None
    priority: str = "medium"  # Priority
    status: str = "draft"  # TestCaseStatus
    automation_status: str = "manual"  # AutomationStatus
    framework: Optional[str] = None
    version_label: str = "1.0"
    linked_requirement: Optional[str] = None
    linked_release: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    evidence_requirements: list[str] = Field(default_factory=list)
    description: Optional[str] = None
    steps: list[TestStepSchema] = Field(default_factory=list)
    module: Optional[str] = None
    preconditions: Optional[str] = None
    expected_result: str = ""


class TestCaseUpdate(BaseModel):
    """Request body for ``PUT /api/v1/test-cases/{id}``."""

    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    type: Optional[str] = None
    application_id: Optional[str] = None
    segment_id: Optional[str] = None
    owner: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    automation_status: Optional[str] = None
    framework: Optional[str] = None
    version_label: Optional[str] = None
    linked_requirement: Optional[str] = None
    linked_release: Optional[str] = None
    tags: Optional[list[str]] = None
    evidence_requirements: Optional[list[str]] = None
    description: Optional[str] = None
    steps: Optional[list[TestStepSchema]] = None
    module: Optional[str] = None
    preconditions: Optional[str] = None
    expected_result: Optional[str] = None
    version: int  # optimistic concurrency


class TestCaseResponse(MongoModel):
    """Full test case detail returned by GET / POST / PUT."""

    name: str
    type: str
    application_id: PyObjectId
    segment_id: Optional[str] = None
    owner: Optional[str] = None
    priority: str
    status: str
    automation_status: str
    framework: Optional[str] = None
    version_label: Optional[str] = None
    linked_requirement: Optional[str] = None
    linked_release: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    evidence_requirements: list[str] = Field(default_factory=list)
    description: Optional[str] = None
    module: Optional[str] = None
    preconditions: Optional[str] = None
    expected_result: str = ""
    steps: list[TestStepSchema] = Field(default_factory=list)
    last_execution_date: Optional[str] = None
    last_execution_result: Optional[str] = None
    owner_id: Optional[PyObjectId] = None
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime
    updated_by: Optional[str] = None
    updated_at: datetime.datetime
    version: int = 1


# ═══════════════════════════════════════════════════════════════════════
# Test Suite schemas
# ═══════════════════════════════════════════════════════════════════════


class TestSuiteCreate(BaseModel):
    """Request body for ``POST /api/v1/test-suites``."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    application_id: str
    segment_id: Optional[str] = None
    owner: Optional[str] = None
    test_case_ids: list[str] = Field(default_factory=list)
    description: Optional[str] = None
    execution_frequency: Optional[str] = None
    environment_requirements: list[str] = Field(default_factory=list)
    test_data_requirements: list[str] = Field(default_factory=list)


class TestSuiteUpdate(BaseModel):
    """Request body for ``PUT /api/v1/test-suites/{id}``."""

    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    application_id: Optional[str] = None
    segment_id: Optional[str] = None
    owner: Optional[str] = None
    test_case_ids: Optional[list[str]] = None
    description: Optional[str] = None
    execution_frequency: Optional[str] = None
    environment_requirements: Optional[list[str]] = None
    test_data_requirements: Optional[list[str]] = None
    version: int  # optimistic concurrency


class TestSuiteResponse(MongoModel):
    """Full test suite detail returned by GET / POST / PUT."""

    name: str
    application_id: PyObjectId
    segment_id: Optional[str] = None
    owner: Optional[str] = None
    test_case_ids: list[PyObjectId] = Field(default_factory=list)
    test_case_count: int = 0
    automation_coverage: float = 0.0
    last_execution_result: Optional[str] = None
    pass_rate: float = 0.0
    description: Optional[str] = None
    execution_frequency: Optional[str] = None
    environment_requirements: list[str] = Field(default_factory=list)
    test_data_requirements: list[str] = Field(default_factory=list)
    status: str = "active"
    owner_id: Optional[PyObjectId] = None
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime
    updated_by: Optional[str] = None
    updated_at: datetime.datetime
    version: int = 1


# ═══════════════════════════════════════════════════════════════════════
# Test Execution schemas
# ═══════════════════════════════════════════════════════════════════════


class TestExecutionCreate(BaseModel):
    """Request body for ``POST /api/v1/test-executions``."""

    model_config = ConfigDict(populate_by_name=True)

    test_suite_id: str
    application_id: str
    release_id: Optional[str] = None
    environment_id: str
    trigger_type: str


class TestExecutionUpdate(BaseModel):
    """Request body for ``PUT /api/v1/test-executions/{id}``."""

    model_config = ConfigDict(populate_by_name=True)

    status: Optional[str] = None
    end_time: Optional[str] = None
    failure_reason: Optional[str] = None
    defects_created: Optional[list[str]] = None
    pass_count: Optional[int] = None
    fail_count: Optional[int] = None
    blocked_count: Optional[int] = None
    skipped_count: Optional[int] = None
    version: int  # optimistic concurrency


class TestExecutionResponse(MongoModel):
    """Full test execution detail returned by GET / POST / PUT."""

    test_suite_id: PyObjectId
    test_suite_name: Optional[str] = None
    application_id: PyObjectId
    release_id: Optional[PyObjectId] = None
    environment_id: Optional[str] = None
    environment: Optional[str] = None
    trigger_type: Optional[str] = None
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None
    duration: Optional[int] = None
    duration_seconds: Optional[int] = None
    status: str
    executed_by: PyObjectId
    pipeline_reference: Optional[str] = None
    build_number: Optional[str] = None
    commit_id: Optional[str] = None
    logs_url: Optional[str] = None
    screenshots_url: list[str] = Field(default_factory=list)
    video_url: Optional[str] = None
    defects_created: list[str] = Field(default_factory=list)
    failure_reason: Optional[str] = None
    ai_failure_analysis: Optional[str] = None
    recommended_remediation: Optional[str] = None
    pass_count: int = 0
    fail_count: int = 0
    blocked_count: int = 0
    skipped_count: int = 0
    total_count: int = 0
    total_cases: int = 0
    passed: int = 0
    failed: int = 0
    blocked: int = 0
    skipped: int = 0
    results: list[TestExecutionResultSchema] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime
    updated_by: Optional[str] = None
    updated_at: datetime.datetime
    version: int = 1


# ═══════════════════════════════════════════════════════════════════════
# Release schemas
# ═══════════════════════════════════════════════════════════════════════


class ReleaseResponse(MongoModel):
    """Release detail returned by GET endpoints."""

    name: str
    version_number: str
    application_id: PyObjectId
    description: str = ""
    target_date: datetime.datetime
    status: str
    readiness_score: Optional[float] = None
    owner_id: Optional[PyObjectId] = None
    owner: Optional[str] = None
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime
    updated_by: Optional[str] = None
    updated_at: datetime.datetime
    version: int = 1


# ═══════════════════════════════════════════════════════════════════════
# Quality Gate schemas
# ═══════════════════════════════════════════════════════════════════════


class QualityGateResponse(MongoModel):
    """Quality gate definition returned by GET endpoints."""

    name: str
    description: str = ""
    gate_type: Optional[str] = None
    applicability: ApplicabilitySchema = Field(default_factory=ApplicabilitySchema)
    threshold: float = 0
    status: str
    owner: Optional[str] = None
    owner_id: Optional[PyObjectId] = None
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime
    updated_by: Optional[str] = None
    updated_at: datetime.datetime
    version: int = 1


class QualityGateResultResponse(BaseModel):
    """Gate evaluation results for a release (``GET /releases/{id}/gate-results``)."""

    model_config = ConfigDict(populate_by_name=True)

    release_id: str
    gates: list[GateResultItemSchema] = Field(default_factory=list)
    overall_result: str  # QualityGateResult
    computed_at: str


# ═══════════════════════════════════════════════════════════════════════
# Governance Procedure schemas
# ═══════════════════════════════════════════════════════════════════════


class GovernanceProcedureCreate(BaseModel):
    """Request body for ``POST /api/v1/governance-procedures``."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str = ""
    status: str = "draft"  # GovernanceStatus
    applicability: ApplicabilitySchema = Field(default_factory=ApplicabilitySchema)
    required_evidence: list[str] = Field(default_factory=list)
    required_approval: list[str] = Field(default_factory=list)
    applicable_test_types: list[str] = Field(default_factory=list)
    compliance_rule: str = ""
    owner: Optional[str] = None


class GovernanceProcedureUpdate(BaseModel):
    """Request body for ``PUT /api/v1/governance-procedures/{id}``."""

    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    applicability: Optional[ApplicabilitySchema] = None
    required_evidence: Optional[list[str]] = None
    required_approval: Optional[list[str]] = None
    applicable_test_types: Optional[list[str]] = None
    compliance_rule: Optional[str] = None
    owner: Optional[str] = None
    version: int  # optimistic concurrency


class GovernanceProcedureResponse(MongoModel):
    """Full governance procedure detail returned by GET / POST / PUT."""

    name: str
    description: str = ""
    status: str
    owner: Optional[str] = None
    owner_id: Optional[PyObjectId] = None
    applicability: ApplicabilitySchema = Field(default_factory=ApplicabilitySchema)
    required_evidence: list[str] = Field(default_factory=list)
    required_approval: list[str] = Field(default_factory=list)
    required_approvals: list[str] = Field(default_factory=list)
    applicable_test_types: list[str] = Field(default_factory=list)
    compliance_rule: str = ""
    audit_history: list[AuditHistoryEntrySchema] = Field(default_factory=list)
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime
    updated_by: Optional[str] = None
    updated_at: datetime.datetime
    version: int = 1


# ═══════════════════════════════════════════════════════════════════════
# Evidence schemas
# ═══════════════════════════════════════════════════════════════════════


class EvidenceResponse(MongoModel):
    """Evidence artifact detail returned by POST / GET endpoints."""

    test_execution_id: PyObjectId
    test_case_id: Optional[PyObjectId] = None
    evidence_type: str  # EvidenceType
    file_name: str
    file_size: int
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    storage_path: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: PyObjectId
    uploaded_at: Optional[datetime.datetime] = None
    created_at: Optional[datetime.datetime] = None
