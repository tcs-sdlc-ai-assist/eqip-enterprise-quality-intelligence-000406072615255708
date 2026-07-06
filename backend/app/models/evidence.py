"""Evidence document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class EvidenceDocument(MongoModel):
    """Represents an evidence artifact stored in the ``evidence`` collection.

    Evidence files are attached to test executions and optionally linked to
    individual test cases.

    Enum values (lowercase snake_case strings from ``contract/enums.md``):
    - type: log | screenshot | video | document | report  (EvidenceType)
    """

    test_execution_id: PyObjectId
    test_case_id: Optional[PyObjectId] = None
    type: str  # EvidenceType enum
    filename: str
    file_size: int
    mime_type: str
    storage_path: str
    uploaded_by: PyObjectId
    description: Optional[str] = None
    created_at: datetime.datetime = Field(default_factory=utcnow)
