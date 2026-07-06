"""User service — business logic for user management."""

import logging
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import ConflictError, NotFoundError
from app.repositories.user import UserRepository
from app.utils.security import hash_password

logger = logging.getLogger(__name__)

# Fields that must never appear in API responses
_SENSITIVE_FIELDS = ("password_hash",)


def _exclude_sensitive(doc: dict) -> dict:
    """Return a shallow copy of *doc* without sensitive fields."""
    return {k: v for k, v in doc.items() if k not in _SENSITIVE_FIELDS}


class UserService:
    """Orchestrates user CRUD operations and enforces business rules."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._repo = UserRepository(db)

    async def create_user(self, data: dict) -> dict:
        """Create a new user.

        * Hashes the plain-text ``password`` field.
        * Checks for duplicate email before inserting.
        * Returns the created user **without** ``password_hash``.
        """
        email = data.get("email", "").strip().lower()

        existing = await self._repo.find_by_email(email)
        if existing is not None:
            raise ConflictError(detail=f"A user with email '{email}' already exists")

        now = datetime.now(tz=timezone.utc)

        insert_data: dict[str, Any] = {
            "email": email,
            "password_hash": hash_password(data["password"]),
            "first_name": data.get("first_name", ""),
            "last_name": data.get("last_name", ""),
            "role": data.get("role", "viewer"),
            "permissions": data.get("permissions", []),
            "status": data.get("status", "active"),
            "last_login": None,
            "created_at": now,
            "updated_at": now,
            "version": 1,
        }

        created = await self._repo.create(insert_data)
        logger.info("User created: %s", created.get("id"))
        return _exclude_sensitive(created)

    async def get_user(self, user_id: str) -> dict:
        """Fetch a single user by ID.

        Raises :class:`~app.exceptions.NotFoundError` when the user does not
        exist.
        """
        doc = await self._repo.get_by_id(user_id)
        if doc is None:
            raise NotFoundError(detail=f"User {user_id} not found")
        return _exclude_sensitive(doc)

    async def list_users(
        self,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
        role: str | None = None,
        search: str | None = None,
    ) -> dict:
        """Return a paginated, optionally filtered list of users.

        When *search* is provided a regex match is performed on name/email
        fields via the repository's ``search`` method; otherwise standard
        filters are applied.
        """
        if search:
            return await self._repo.search(
                query=search,
                page=page,
                page_size=page_size,
            )

        filters: dict[str, Any] = {}
        if status is not None:
            filters["status"] = status
        if role is not None:
            filters["role"] = role

        result = await self._repo.list(
            filters=filters,
            page=page,
            page_size=page_size,
        )

        # Strip sensitive fields from every item
        result["items"] = [_exclude_sensitive(item) for item in result["items"]]
        return result

    async def update_user(self, user_id: str, data: dict) -> dict:
        """Update an existing user with optimistic-concurrency control.

        The caller should include the current ``version`` in *data* so the
        repository can perform a version check.  Returns the updated user
        **without** ``password_hash``.
        """
        # Ensure the user exists first
        existing = await self._repo.get_by_id(user_id)
        if existing is None:
            raise NotFoundError(detail=f"User {user_id} not found")

        version = data.pop("version", existing.get("version"))

        # If a new password is supplied, hash it
        if "password" in data:
            data["password_hash"] = hash_password(data.pop("password"))

        updated = await self._repo.update(user_id, data, version=version)
        if updated is None:
            raise NotFoundError(detail=f"User {user_id} not found")

        logger.info("User updated: %s", user_id)
        return _exclude_sensitive(updated)
