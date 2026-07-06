"""User repository — extends BaseRepository with user-specific queries."""

import logging
import re
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class UserRepository(BaseRepository):
    """Data-access layer for the ``users`` collection."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "users")

    async def find_by_email(self, email: str) -> dict | None:
        """Return a user document matching *email*, or ``None``."""
        doc = await self._collection.find_one({"email": email})
        if doc is None:
            return None
        return self._map_id(doc)

    async def search(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Full-text search on ``first_name``, ``last_name``, and ``email``.

        Uses a case-insensitive regex match against each field and returns a
        paginated result dict ``{items, total, page, page_size}``.
        """
        escaped = re.escape(query)
        pattern = re.compile(escaped, re.IGNORECASE)

        search_filter: dict[str, Any] = {
            "$or": [
                {"first_name": {"$regex": pattern}},
                {"last_name": {"$regex": pattern}},
                {"email": {"$regex": pattern}},
            ],
        }

        return await self.list(
            filters=search_filter,
            page=page,
            page_size=page_size,
        )
