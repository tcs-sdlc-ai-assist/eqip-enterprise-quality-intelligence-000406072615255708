"""Repository for the ``test_cases`` MongoDB collection."""

import logging
import re
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class TestCaseRepository(BaseRepository):
    """Data-access layer for test case documents."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "test_cases")

    async def search(
        self,
        query: str,
        filters: dict | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Full-text / regex search across name and description with filters.

        Returns a paginated dict ``{items, total, page, page_size}``.
        """
        mongo_filter: dict[str, Any] = dict(filters) if filters else {}

        if query:
            # Escape special regex chars so user input is treated literally
            escaped = re.escape(query)
            mongo_filter["$or"] = [
                {"name": {"$regex": escaped, "$options": "i"}},
                {"description": {"$regex": escaped, "$options": "i"}},
            ]

        total = await self._collection.count_documents(mongo_filter)

        skip = (page - 1) * page_size
        cursor = (
            self._collection.find(mongo_filter)
            .sort("created_at", -1)
            .skip(skip)
            .limit(page_size)
        )
        items = [self._map_id(doc) async for doc in cursor]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
