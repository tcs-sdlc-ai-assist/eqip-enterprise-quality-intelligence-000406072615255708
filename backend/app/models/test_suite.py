"""Test suite document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class TestSuiteDocument(MongoModel):
    """Represents a test suite document stored in the ``test_suites`` collection.

    A test suite groups related test cases for batch execution.
    """

    name: str
    description: str = ""
    application_id: PyObjectId
    test_case_ids: list[PyObjectId] = Field(default_factory=list)
    status: str = "active"  # GovernanceStatus: draft | active | deprecated
    owner_id: PyObjectId
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime = Field(default_factory=utcnow)
    updated_at: datetime.datetime = Field(default_factory=utcnow)
    version: int = 1
