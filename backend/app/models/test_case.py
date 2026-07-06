"""Test case document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class TestStepDocument(MongoModel):
    """Embedded sub-document representing a single test step."""

    step_number: int
    action: str
    expected_result: str


class TestCaseDocument(MongoModel):
    """Represents a test case document stored in the ``test_cases`` collection.

    Enum values (lowercase snake_case strings from ``contract/enums.md``):
    - type: functional | integration | regression | performance | security
            | accessibility | usability
    - priority: critical | high | medium | low
    - status: draft | active | deprecated | archived
    - automation_status: manual | automated | hybrid | planned
    """

    name: str
    description: str
    type: str  # functional / integration / regression / performance / security / accessibility / usability
    application_id: PyObjectId
    module: Optional[str] = None
    priority: str = "medium"  # Priority enum
    status: str = "draft"  # TestCaseStatus enum
    automation_status: str = "manual"  # AutomationStatus enum
    preconditions: Optional[str] = None
    steps: list[dict] = Field(default_factory=list)
    expected_result: str = ""
    tags: list[str] = Field(default_factory=list)
    owner_id: PyObjectId
    created_by: PyObjectId
    created_at: datetime.datetime = Field(default_factory=utcnow)
    updated_at: datetime.datetime = Field(default_factory=utcnow)
    version: int = 1
