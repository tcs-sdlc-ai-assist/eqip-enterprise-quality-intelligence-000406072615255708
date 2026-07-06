"""Audit service — tamper-evident audit-log management."""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.audit_log import AuditLogRepository

logger = logging.getLogger(__name__)


def _compute_hash(
    previous_hash: str,
    action: str,
    user_id: str,
    timestamp: str,
) -> str:
    """Compute a SHA-256 hash for the audit chain.

    The hash is derived from the concatenation of the previous entry's hash,
    the action, the acting user's ID, and the ISO-formatted timestamp.
    """
    payload = f"{previous_hash}{action}{user_id}{timestamp}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AuditService:
    """Records and queries tamper-evident audit-log entries."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._repo = AuditLogRepository(db)
        self._collection = db["audit_logs"]

    async def log_action(
        self,
        user_id: str,
        user_email: str,
        action: str,
        entity_type: str,
        entity_id: str,
        changes: dict | None = None,
        ip_address: str | None = None,
    ) -> dict:
        """Create a new audit-log entry with a SHA-256 hash chain.

        The ``current_hash`` is computed from the previous entry's hash (or
        an empty string for the first entry), the *action*, *user_id*, and
        the current UTC timestamp.
        """
        now = datetime.now(tz=timezone.utc)
        timestamp_iso = now.isoformat()

        # Retrieve the hash of the most recent entry for chaining
        latest = await self._repo.get_latest()
        previous_hash = latest["current_hash"] if latest else ""

        current_hash = _compute_hash(
            previous_hash=previous_hash,
            action=action,
            user_id=user_id,
            timestamp=timestamp_iso,
        )

        entry: dict[str, Any] = {
            "user_id": user_id,
            "user_email": user_email,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "changes": changes,
            "ip_address": ip_address,
            "previous_hash": previous_hash if previous_hash else None,
            "current_hash": current_hash,
            "timestamp": now,
        }

        created = await self._repo.create(entry)
        logger.info(
            "Audit log recorded: action=%s entity=%s/%s user=%s",
            action,
            entity_type,
            entity_id,
            user_id,
        )
        return created

    async def search_audit_logs(
        self,
        page: int = 1,
        page_size: int = 20,
        user_id: str | None = None,
        action: str | None = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
    ) -> dict:
        """Return a paginated, optionally filtered list of audit-log entries.

        Filters are combined with AND semantics.  Date filters use
        ``$gte`` / ``$lte`` on the ``timestamp`` field.
        """
        filters: dict[str, Any] = {}

        if user_id is not None:
            filters["user_id"] = user_id
        if action is not None:
            filters["action"] = action

        if from_date is not None or to_date is not None:
            ts_filter: dict[str, Any] = {}
            if from_date is not None:
                ts_filter["$gte"] = from_date
            if to_date is not None:
                ts_filter["$lte"] = to_date
            filters["timestamp"] = ts_filter

        return await self._repo.list(
            filters=filters,
            page=page,
            page_size=page_size,
            sort_by="timestamp",
            sort_order=-1,
        )
