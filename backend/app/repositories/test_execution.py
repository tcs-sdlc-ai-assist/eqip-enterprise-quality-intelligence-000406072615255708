"""Repository for the ``test_executions`` MongoDB collection."""

import logging
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class TestExecutionRepository(BaseRepository):
    """Data-access layer for test execution documents."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "test_executions")

    async def get_by_release(self, release_id: str) -> list[dict]:
        """Return all executions linked to a given release.

        Parameters
        ----------
        release_id:
            String representation of the release ``ObjectId``.

        Returns
        -------
        list[dict]:
            Execution documents with ``_id`` mapped to ``id``.
        """
        oid = self._to_object_id(release_id)
        cursor = self._collection.find({"release_id": oid}).sort("created_at", -1)
        return [self._map_id(doc) async for doc in cursor]
