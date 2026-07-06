"""Repository for the ``evidence`` MongoDB collection."""

import logging
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class EvidenceRepository(BaseRepository):
    """CRUD operations for evidence documents."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "evidence")

    async def get_by_execution(self, execution_id: str) -> list[dict]:
        """Return all evidence documents linked to a test execution.

        Parameters
        ----------
        execution_id:
            String representation of the test execution ``ObjectId``.

        Returns
        -------
        list[dict]
            Evidence documents with ``_id`` mapped to ``id``.
        """
        oid = self._to_object_id(execution_id)
        cursor = self._collection.find({"test_execution_id": oid})
        return [self._map_id(doc) async for doc in cursor]
