"""Service layer for test case business logic."""

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError
from app.repositories.test_case import TestCaseRepository

logger = logging.getLogger(__name__)


class TestCaseService:
    """Orchestrates test case CRUD and domain rules."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._repo = TestCaseRepository(db)

    # ── create ───────────────────────────────────────────────────────────

    async def create_test_case(self, data: dict, user_id: str) -> dict:
        """Create a new test case.

        Sets ``owner_id``, ``created_by``, and initial timestamps.
        """
        now = datetime.now(tz=timezone.utc)
        data["owner_id"] = user_id
        data["created_by"] = user_id
        data["created_at"] = now
        data["updated_at"] = now
        data["version"] = 1
        data.setdefault("status", "draft")

        result = await self._repo.create(data)
        logger.info("Test case created: %s", result.get("id"))
        return result

    # ── read ─────────────────────────────────────────────────────────────

    async def get_test_case(self, id: str) -> dict:
        """Return a single test case or raise ``NotFoundError``."""
        doc = await self._repo.get_by_id(id)
        if doc is None:
            raise NotFoundError(detail=f"Test case {id} not found")
        return doc

    # ── list / search ────────────────────────────────────────────────────

    async def list_test_cases(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        priority: str | None = None,
        automation_status: str | None = None,
        application_id: str | None = None,
        owner_id: str | None = None,
        search: str | None = None,
    ) -> dict:
        """Return a paginated, optionally filtered list of test cases.

        When *search* is provided the query is delegated to the repository's
        text-search method; otherwise a standard filtered list is returned.
        """
        filters: dict[str, Any] = {}
        if status:
            filters["status"] = status
        if priority:
            filters["priority"] = priority
        if automation_status:
            filters["automation_status"] = automation_status
        if application_id:
            filters["application_id"] = application_id
        if owner_id:
            filters["owner_id"] = owner_id

        if search:
            return await self._repo.search(
                query=search,
                filters=filters,
                page=page,
                page_size=page_size,
            )

        return await self._repo.list(
            filters=filters,
            page=page,
            page_size=page_size,
        )

    # ── update ───────────────────────────────────────────────────────────

    async def update_test_case(self, id: str, data: dict) -> dict:
        """Update a test case with optimistic-concurrency version check.

        The caller must include ``version`` in *data* so the repository can
        perform the conflict check.
        """
        version = data.pop("version", None)
        result = await self._repo.update(id, data, version=version)
        if result is None:
            raise NotFoundError(detail=f"Test case {id} not found")
        logger.info("Test case updated: %s", id)
        return result

    # ── clone ────────────────────────────────────────────────────────────

    async def clone_test_case(self, id: str, user_id: str) -> dict:
        """Clone an existing test case.

        Creates a copy with a new id, resets timestamps, and sets
        ``created_by`` to the requesting user.
        """
        original = await self.get_test_case(id)

        now = datetime.now(tz=timezone.utc)

        clone_data: dict[str, Any] = dict(original)
        # Remove fields that belong to the original
        clone_data.pop("id", None)
        clone_data.pop("_id", None)

        clone_data["name"] = f"{original['name']} (Copy)"
        clone_data["created_by"] = user_id
        clone_data["owner_id"] = user_id
        clone_data["created_at"] = now
        clone_data["updated_at"] = now
        clone_data["version"] = 1
        clone_data["status"] = "draft"

        result = await self._repo.create(clone_data)
        logger.info("Test case cloned: %s -> %s", id, result.get("id"))
        return result
