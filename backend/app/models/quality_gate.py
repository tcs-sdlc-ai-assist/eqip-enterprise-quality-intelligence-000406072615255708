"""Quality gate document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class QualityGateDocument(MongoModel):
    """Represents a quality gate definition stored in the ``quality_gates`` collection.

    A quality gate defines a threshold that must be met before a release
    can proceed.

    Enum values (lowercase snake_case strings from ``contract/enums.md``):
    - status: draft | active | deprecated  (GovernanceStatus)
    """

    name: str
    description: str = ""
    gate_type: str
    threshold: dict = Field(default_factory=dict)  # {metric, operator, value}
    applicability: dict = Field(default_factory=dict)  # {tier, release_type}
    owner_id: PyObjectId
    status: str = "draft"  # GovernanceStatus enum
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime = Field(default_factory=utcnow)
    updated_at: datetime.datetime = Field(default_factory=utcnow)
    version: int = 1
