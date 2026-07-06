"""Role repository — extends BaseRepository with role-specific queries."""

import logging

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class RoleRepository(BaseRepository):
    """Data-access layer for the ``roles`` collection."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "roles")

    async def find_by_name(self, name: str) -> dict | None:
        """Return a role document matching *name*, or ``None``."""
        doc = await self._collection.find_one({"name": name})
        if doc is None:
            return None
        return self._map_id(doc)
