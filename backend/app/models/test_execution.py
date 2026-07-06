"""Test execution document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class TestExecutionResultDocument(MongoModel):
    """Embedded sub-document for an individual test case result within an execution."""

    test_case_id: PyObjectId
    status: str  # ExecutionStatus: pending | in_progress | passed | failed | blocked | skipped | error
    actual_result: str = ""
    evidence_ids: list[PyObjectId] = Field(default_factory=list)
    notes: str = ""


class TestExecutionDocument(MongoModel):
    """Represents a test execution run stored in the ``test_executions`` collection.

    Enum values (lowercase snake_case strings from ``contract/enums.md``):
    - status: pending | in_progress | passed | failed | blocked | skipped | error
    """

    test_suite_id: PyObjectId
    application_id: PyObjectId
    release_id: Optional[PyObjectId] = None
    environment: str
    status: str = "pending"  # ExecutionStatus enum
    executed_by: PyObjectId
    start_time: datetime.datetime = Field(default_factory=utcnow)
    end_time: Optional[datetime.datetime] = None
    duration_seconds: Optional[int] = None
    results: list[dict] = Field(default_factory=list)
    total_cases: int = 0
    passed: int = 0
    failed: int = 0
    blocked: int = 0
    skipped: int = 0
    created_at: datetime.datetime = Field(default_factory=utcnow)
    updated_at: datetime.datetime = Field(default_factory=utcnow)
    version: int = 1
