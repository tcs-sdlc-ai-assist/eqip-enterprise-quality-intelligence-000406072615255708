"""Metrics repository — CRUD for the ``metrics`` collection."""

import logging

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class MetricsRepository(BaseRepository):
    """Data-access layer for metric definitions and values."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "metrics")

    async def get_by_category(self, category: str) -> list[dict]:
        """Return all metrics matching *category*, newest first."""
        cursor = self._collection.find({"category": category}).sort("created_at", -1)
        return [self._map_id(doc) async for doc in cursor]
