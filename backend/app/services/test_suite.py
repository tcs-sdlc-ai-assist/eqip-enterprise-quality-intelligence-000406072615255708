"""Service layer for test suite business logic."""

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError
from app.repositories.test_suite import TestSuiteRepository

logger = logging.getLogger(__name__)


class TestSuiteService:
    """Orchestrates test suite CRUD and domain rules."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._repo = TestSuiteRepository(db)

    # ── create ───────────────────────────────────────────────────────────

    async def create_test_suite(self, data: dict, user_id: str) -> dict:
        """Create a new test suite.

        Sets ``owner_id``, ``created_by``, and initial timestamps.
        """
        now = datetime.now(tz=timezone.utc)
        data["owner_id"] = user_id
        data["created_by"] = user_id
        data["created_at"] = now
        data["updated_at"] = now
        data["version"] = 1
        data.setdefault("status", "active")

        result = await self._repo.create(data)
        logger.info("Test suite created: %s", result.get("id"))
        return result

    # ── list ─────────────────────────────────────────────────────────────

    async def list_test_suites(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Return a paginated list of test suites."""
        return await self._repo.list(page=page, page_size=page_size)

    # ── update ───────────────────────────────────────────────────────────

    async def update_test_suite(self, id: str, data: dict) -> dict:
        """Update a test suite with optimistic-concurrency version check."""
        version = data.pop("version", None)
        result = await self._repo.update(id, data, version=version)
        if result is None:
            raise NotFoundError(detail=f"Test suite {id} not found")
        logger.info("Test suite updated: %s", id)
        return result
