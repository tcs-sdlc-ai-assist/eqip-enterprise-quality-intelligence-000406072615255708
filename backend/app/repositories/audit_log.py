"""Audit-log repository — extends BaseRepository with audit-specific queries."""

import logging

from pymongo.asynchronous.database import AsyncDatabase
from pymongo import DESCENDING

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class AuditLogRepository(BaseRepository):
    """Data-access layer for the ``audit_logs`` collection."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "audit_logs")

    async def get_latest(self) -> dict | None:
        """Return the most recent audit-log entry by ``timestamp``, or ``None``."""
        doc = await self._collection.find_one(
            sort=[("timestamp", DESCENDING)],
        )
        if doc is None:
            return None
        return self._map_id(doc)
