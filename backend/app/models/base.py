"""Shared Pydantic v2 base model for MongoDB-backed documents.

Provides ``PyObjectId`` (coerces ``bson.ObjectId`` → ``str`` at validation
time) and ``MongoModel`` (maps ``_id`` → ``id`` with correct aliases so
responses emit ``id``, never ``_id``).
"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

# ObjectId → str coercion applied at validation time
PyObjectId = Annotated[str, BeforeValidator(str)]


class MongoModel(BaseModel):
    """Base for every document-backed Pydantic schema.

    * ``_id`` is read via ``validation_alias`` and emitted as ``id`` via
      ``serialization_alias`` — no BSON leak.
    * ``populate_by_name=True`` lets callers use either ``id`` or ``_id``.
    """

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )

    id: Optional[PyObjectId] = Field(
        default=None,
        validation_alias="_id",
        serialization_alias="id",
    )


def utcnow() -> datetime:
    """Return a timezone-aware UTC datetime."""
    return datetime.now(tz=timezone.utc)
