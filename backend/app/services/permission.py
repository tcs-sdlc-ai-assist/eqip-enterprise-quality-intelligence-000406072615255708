"""Permission service — permission listing and authorization checks."""

import logging

from pymongo.asynchronous.database import AsyncDatabase

logger = logging.getLogger(__name__)


class PermissionService:
    """Provides permission enumeration and authorization helpers.

    Operates directly on the ``permissions`` collection rather than going
    through a dedicated repository, since the access pattern is simple
    read-only lookups.
    """

    def __init__(self, db: AsyncDatabase) -> None:
        self._collection = db["permissions"]

    async def list_permissions(self) -> list[dict]:
        """Return every permission document in the collection."""
        cursor = self._collection.find()
        results: list[dict] = []
        async for doc in cursor:
            mapped = dict(doc)
            mapped["id"] = str(mapped.pop("_id"))
            results.append(mapped)
        return results

    async def check_permission(
        self,
        user_permissions: list[str],
        required: str,
    ) -> bool:
        """Return ``True`` when *required* is present in *user_permissions*.

        This is a pure in-memory check — no database call is needed because
        the caller already supplies the user's granted permission list.
        """
        if not required:
            return True
        return required in user_permissions
