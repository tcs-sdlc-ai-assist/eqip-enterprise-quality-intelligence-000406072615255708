"""Service layer for test execution business logic."""

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError, ValidationError
from app.repositories.test_execution import TestExecutionRepository

logger = logging.getLogger(__name__)

# Valid status transitions for execution lifecycle
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"in_progress"},
    "in_progress": {"passed", "failed", "blocked", "error"},
    "passed": set(),
    "failed": set(),
    "blocked": set(),
    "skipped": set(),
    "error": set(),
}


class TestExecutionService:
    """Orchestrates test execution CRUD and domain rules."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._repo = TestExecutionRepository(db)

    # ── create ───────────────────────────────────────────────────────────

    async def create_execution(self, data: dict, user_id: str) -> dict:
        """Create a new test execution run.

        Sets ``executed_by``, ``start_time``, and initial ``status`` to
        ``pending``.
        """
        now = datetime.now(tz=timezone.utc)
        data["executed_by"] = user_id
        data["start_time"] = now
        data["status"] = "pending"
        data["created_at"] = now
        data["updated_at"] = now
        data["version"] = 1

        result = await self._repo.create(data)
        logger.info("Test execution created: %s", result.get("id"))
        return result

    # ── read ─────────────────────────────────────────────────────────────

    async def get_execution(self, id: str) -> dict:
        """Return a single execution or raise ``NotFoundError``."""
        doc = await self._repo.get_by_id(id)
        if doc is None:
            raise NotFoundError(detail=f"Test execution {id} not found")
        return doc

    # ── list ─────────────────────────────────────────────────────────────

    async def list_executions(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        application_id: str | None = None,
        release_id: str | None = None,
    ) -> dict:
        """Return a paginated, optionally filtered list of executions."""
        filters: dict[str, Any] = {}
        if status:
            filters["status"] = status
        if application_id:
            filters["application_id"] = application_id
        if release_id:
            filters["release_id"] = release_id

        return await self._repo.list(
            filters=filters,
            page=page,
            page_size=page_size,
        )

    # ── update ───────────────────────────────────────────────────────────

    async def update_execution(self, id: str, data: dict) -> dict:
        """Update an execution, handling status transitions and duration.

        When the status transitions to a terminal state (``passed``,
        ``failed``, ``blocked``, ``error``), ``end_time`` is set and
        ``duration_seconds`` is computed from ``start_time``.

        Raises :class:`~app.exceptions.ValidationError` on an invalid
        status transition.
        """
        existing = await self.get_execution(id)

        new_status = data.get("status")
        current_status = existing.get("status", "pending")

        # Validate status transition if a new status is provided
        if new_status and new_status != current_status:
            allowed = _VALID_TRANSITIONS.get(current_status, set())
            if new_status not in allowed:
                raise ValidationError(
                    detail=(
                        f"Invalid status transition from '{current_status}' "
                        f"to '{new_status}'"
                    ),
                )

            # Compute duration when transitioning to a terminal state
            terminal_statuses = {"passed", "failed", "blocked", "error"}
            if new_status in terminal_statuses:
                now = datetime.now(tz=timezone.utc)
                data["end_time"] = now

                start_time = existing.get("start_time")
                if start_time is not None:
                    if isinstance(start_time, str):
                        start_time = datetime.fromisoformat(start_time)
                    delta = now - start_time
                    data["duration_seconds"] = int(delta.total_seconds())

        version = data.pop("version", existing.get("version"))
        result = await self._repo.update(id, data, version=version)
        if result is None:
            raise NotFoundError(detail=f"Test execution {id} not found")
        logger.info("Test execution updated: %s", id)
        return result
