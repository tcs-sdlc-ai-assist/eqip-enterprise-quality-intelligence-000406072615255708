"""User document model for MongoDB persistence."""

import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel


class UserDocument(MongoModel):
    """Represents a user document stored in the ``users`` collection."""

    email: str
    password_hash: str
    first_name: str
    last_name: str
    role: str  # RoleEnum value
    permissions: list[str] = Field(default_factory=list)
    status: str = "active"  # UserStatus value
    last_login: Optional[datetime.datetime] = None
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
    updated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
    )
    version: int = 1
