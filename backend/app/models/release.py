"""Release document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class ReleaseDocument(MongoModel):
    """Represents a release document stored in the ``releases`` collection.

    Enum values (lowercase snake_case strings):
    - status: planned | in_progress | released | cancelled
    """

    name: str
    version_number: str
    application_id: PyObjectId
    description: str = ""
    target_date: datetime.datetime
    status: str = "planned"  # planned | in_progress | released | cancelled
    readiness_score: Optional[float] = None
    owner_id: PyObjectId
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime = Field(default_factory=utcnow)
    updated_at: datetime.datetime = Field(default_factory=utcnow)
    version: int = 1
