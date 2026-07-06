"""Permission document model for MongoDB persistence."""

import datetime

from pydantic import Field

from app.models.base import MongoModel


class PermissionDocument(MongoModel):
    """Represents a permission document stored in the ``permissions`` collection."""

    name: str  # unique
    description: str
    category: str
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
