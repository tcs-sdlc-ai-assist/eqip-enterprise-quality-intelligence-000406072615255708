"""Role document model for MongoDB persistence."""

import datetime

from pydantic import Field

from app.models.base import MongoModel


class RoleDocument(MongoModel):
    """Represents a role document stored in the ``roles`` collection."""

    name: str  # unique
    description: str
    permissions: list[str] = Field(default_factory=list)
    is_system: bool = False
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
    updated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
    version: int = 1
