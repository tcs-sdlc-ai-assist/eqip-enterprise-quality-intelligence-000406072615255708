"""Audit log document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId


class AuditLogDocument(MongoModel):
    """Represents an audit-log entry stored in the ``audit_logs`` collection."""

    user_id: PyObjectId
    user_email: str
    action: str
    entity_type: str
    entity_id: str
    changes: Optional[dict] = None
    ip_address: Optional[str] = None
    previous_hash: Optional[str] = None
    current_hash: str
    timestamp: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
