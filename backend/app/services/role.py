"""Role service — business logic for role management."""

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import ConflictError, NotFoundError
from app.repositories.role import RoleRepository

logger = logging.getLogger(__name__)


class RoleService:
    """Orchestrates role CRUD operations and enforces business rules."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._repo = RoleRepository(db)

    async def create_role(self, data: dict) -> dict:
        """Create a new role.

        Raises :class:`~app.exceptions.ConflictError` when a role with the
        same ``name`` already exists.
        """
        name = data.get("name", "").strip()

        existing = await self._repo.find_by_name(name)
        if existing is not None:
            raise ConflictError(detail=f"A role named '{name}' already exists")

        now = datetime.now(tz=timezone.utc)

        insert_data: dict[str, Any] = {
            "name": name,
            "description": data.get("description", ""),
            "permissions": data.get("permissions", []),
            "is_system": data.get("is_system", False),
            "created_at": now,
            "updated_at": now,
            "version": 1,
        }

        created = await self._repo.create(insert_data)
        logger.info("Role created: %s (id=%s)", name, created.get("id"))
        return created

    async def get_role(self, role_id: str) -> dict:
        """Fetch a single role by ID.

        Raises :class:`~app.exceptions.NotFoundError` when the role does not
        exist.
        """
        doc = await self._repo.get_by_id(role_id)
        if doc is None:
            raise NotFoundError(detail=f"Role {role_id} not found")
        return doc

    async def list_roles(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Return a paginated list of roles."""
        return await self._repo.list(
            page=page,
            page_size=page_size,
        )

    async def update_role(self, role_id: str, data: dict) -> dict:
        """Update an existing role with optimistic-concurrency control.

        The caller should include the current ``version`` in *data* so the
        repository can perform a version check.
        """
        existing = await self._repo.get_by_id(role_id)
        if existing is None:
            raise NotFoundError(detail=f"Role {role_id} not found")

        version = data.pop("version", existing.get("version"))

        updated = await self._repo.update(role_id, data, version=version)
        if updated is None:
            raise NotFoundError(detail=f"Role {role_id} not found")

        logger.info("Role updated: %s", role_id)
        return updated
