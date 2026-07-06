"""Generic base repository for MongoDB collections (PyMongo async driver)."""

import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.asynchronous.database import AsyncDatabase
from pymongo import ReturnDocument

from app.exceptions import ConflictError, NotFoundError, ValidationError

logger = logging.getLogger(__name__)


class BaseRepository:
    """Thin async CRUD wrapper around a single MongoDB collection.

    Subclass and set ``collection_name`` or pass it to ``__init__``.
    """

    def __init__(self, db: AsyncDatabase, collection_name: str) -> None:
        self._db = db
        self._collection_name = collection_name
        self._collection = db[collection_name]

    # ── helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _to_object_id(id_str: str) -> ObjectId:
        """Convert a string to ``ObjectId``; raise 422 on bad format."""
        try:
            return ObjectId(id_str)
        except (InvalidId, TypeError) as exc:
            raise ValidationError(
                detail=f"Invalid ID format: {id_str}",
            ) from exc

    @staticmethod
    def _map_id(doc: dict) -> dict:
        """Replace ``_id`` (ObjectId) with a string ``id`` field."""
        if doc is None:
            return doc  # type: ignore[return-value]
        doc = dict(doc)  # shallow copy so we don't mutate the cursor row
        doc["id"] = str(doc.pop("_id"))
        return doc

    # ── CRUD ─────────────────────────────────────────────────────────────

    async def create(self, data: dict) -> dict:
        """Insert a document and return it with a string ``id``."""
        now = datetime.now(tz=timezone.utc)
        data.setdefault("created_at", now)
        data.setdefault("updated_at", now)
        data.setdefault("version", 1)
        data.setdefault("status", "active")

        result = await self._collection.insert_one(data)
        data["id"] = str(result.inserted_id)
        data.pop("_id", None)
        return data

    async def get_by_id(self, id: str) -> dict | None:
        """Return a single document by its ``_id``, or ``None``."""
        oid = self._to_object_id(id)
        doc = await self._collection.find_one({"_id": oid})
        if doc is None:
            return None
        return self._map_id(doc)

    async def list(
        self,
        filters: dict | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: int = -1,
        projection: dict | None = None,
    ) -> dict:
        """Return a paginated dict ``{items, total, page, page_size}``."""
        query: dict[str, Any] = dict(filters) if filters else {}

        total = await self._collection.count_documents(query)

        skip = (page - 1) * page_size
        cursor = (
            self._collection.find(query, projection)
            .sort(sort_by, sort_order)
            .skip(skip)
            .limit(page_size)
        )
        items = [self._map_id(doc) async for doc in cursor]

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def update(
        self,
        id: str,
        data: dict,
        version: int | None = None,
    ) -> dict | None:
        """Update a document by ``_id``.

        When *version* is supplied an optimistic-concurrency check is
        performed: the update only succeeds if the stored ``version``
        matches, and the stored version is incremented atomically.
        Raises :class:`~app.exceptions.ConflictError` on a mismatch.
        """
        oid = self._to_object_id(id)
        query: dict[str, Any] = {"_id": oid}

        update_data = dict(data)
        update_data["updated_at"] = datetime.now(tz=timezone.utc)

        update_ops: dict[str, Any] = {"$set": update_data}

        if version is not None:
            query["version"] = version
            update_ops["$inc"] = {"version": 1}

        doc = await self._collection.find_one_and_update(
            query,
            update_ops,
            return_document=ReturnDocument.AFTER,
        )

        if doc is None:
            # Distinguish "not found" from "version mismatch"
            if version is not None:
                existing = await self._collection.find_one({"_id": oid})
                if existing is not None:
                    raise ConflictError(
                        detail=(
                            f"Version conflict on {self._collection_name} "
                            f"{id}: expected {version}, "
                            f"found {existing.get('version')}"
                        ),
                    )
            return None

        return self._map_id(doc)

    async def soft_delete(self, id: str) -> bool:
        """Mark a document as deleted (soft-delete)."""
        oid = self._to_object_id(id)
        result = await self._collection.update_one(
            {"_id": oid},
            {
                "$set": {
                    "status": "deleted",
                    "deleted_at": datetime.now(tz=timezone.utc),
                    "updated_at": datetime.now(tz=timezone.utc),
                },
            },
        )
        return result.modified_count > 0

    async def count(self, filters: dict | None = None) -> int:
        """Return the number of documents matching *filters*."""
        query: dict[str, Any] = dict(filters) if filters else {}
        return await self._collection.count_documents(query)
