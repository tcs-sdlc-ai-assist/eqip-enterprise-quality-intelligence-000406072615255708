"""Governance procedure document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class GovernanceProcedureDocument(MongoModel):
    """Represents a governance procedure stored in the ``governance_procedures`` collection.

    Enum values (lowercase snake_case strings from ``contract/enums.md``):
    - status: draft | active | deprecated  (GovernanceStatus)
    """

    name: str
    description: str = ""
    applicability: dict = Field(default_factory=dict)  # {tier, release_type}
    required_evidence: list[str] = Field(default_factory=list)  # EvidenceType values
    required_approvals: list[str] = Field(default_factory=list)
    compliance_rule: str = ""  # AND/OR expression
    status: str = "draft"  # GovernanceStatus enum
    owner_id: PyObjectId
    created_by: Optional[PyObjectId] = None
    created_at: datetime.datetime = Field(default_factory=utcnow)
    updated_at: datetime.datetime = Field(default_factory=utcnow)
    version: int = 1
