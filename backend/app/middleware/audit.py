"""Audit-trail middleware — logs state-changing requests with hash chaining.

Intercepts POST / PUT / DELETE requests and, *after* the response is sent,
writes an audit-log document to the ``audit_logs`` collection.  The write is
fire-and-forget so it never blocks the response.
"""

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.database import get_database

logger = logging.getLogger(__name__)

_STATE_CHANGING_METHODS = {"POST", "PUT", "DELETE", "PATCH"}


class AuditMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that writes tamper-evident audit logs.

    * Only fires on state-changing HTTP methods.
    * Extracts user identity from the JWT when present.
    * Computes a SHA-256 hash chain: ``sha256(previous_hash + action +
      user_id + timestamp_iso)`` so any gap or edit is detectable.
    * The audit write is scheduled as a background task so the response
      is never delayed.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if request.method not in _STATE_CHANGING_METHODS:
            return await call_next(request)

        response = await call_next(request)

        # Fire-and-forget: schedule the audit write on the running loop
        asyncio.ensure_future(self._write_audit_log(request, response))

        return response

    # ── internal helpers ─────────────────────────────────────────────────

    async def _write_audit_log(
        self,
        request: Request,
        response: Response,
    ) -> None:
        """Build and persist the audit-log document."""
        try:
            user_id, user_email = self._extract_user(request)
            action = f"{request.method} {request.url.path}"
            entity_type, entity_id = self._extract_entity(request.url.path)
            ip_address = self._client_ip(request)
            timestamp = datetime.now(tz=timezone.utc)

            db = get_database()
            collection = db["audit_logs"]

            previous_hash = await self._get_previous_hash(collection)

            current_hash = self._compute_hash(
                previous_hash=previous_hash,
                action=action,
                user_id=user_id,
                timestamp=timestamp,
            )

            document = {
                "user_id": user_id,
                "user_email": user_email,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "ip_address": ip_address,
                "previous_hash": previous_hash,
                "current_hash": current_hash,
                "timestamp": timestamp,
            }

            await collection.insert_one(document)
        except Exception:
            # Never let an audit failure propagate — log and move on.
            logger.exception("Failed to write audit log entry")

    # ── JWT extraction ───────────────────────────────────────────────────

    @staticmethod
    def _extract_user(request: Request) -> tuple[str, str]:
        """Return ``(user_id, user_email)`` from the JWT, or anonymous."""
        auth_header: Optional[str] = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return ("anonymous", "anonymous")

        token = auth_header[len("Bearer "):]
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            user_id = payload.get("sub", "anonymous")
            user_email = payload.get("email", "anonymous")
            return (user_id, user_email)
        except JWTError:
            return ("anonymous", "anonymous")

    # ── Entity extraction from URL path ──────────────────────────────────

    @staticmethod
    def _extract_entity(path: str) -> tuple[str, str]:
        """Derive ``(entity_type, entity_id)`` from the URL path.

        Assumes REST-style paths like ``/api/v1/users/{id}``.
        """
        parts = [p for p in path.strip("/").split("/") if p]

        # Walk past the api/version prefix (e.g. "api", "v1")
        idx = 0
        for i, part in enumerate(parts):
            if part == "api":
                idx = i + 1
                continue
            if part.startswith("v") and part[1:].isdigit():
                idx = i + 1
                continue
            break

        remaining = parts[idx:]

        entity_type = remaining[0] if remaining else "unknown"
        entity_id = ""

        # The segment after the entity_type is typically the id
        if len(remaining) > 1:
            entity_id = remaining[1]

        return (entity_type, entity_id)

    # ── Hash chaining ────────────────────────────────────────────────────

    @staticmethod
    async def _get_previous_hash(collection) -> str:  # type: ignore[type-arg]
        """Fetch the ``current_hash`` of the most recent audit-log entry."""
        cursor = collection.find().sort("timestamp", -1).limit(1)
        docs = await cursor.to_list(length=1)
        if docs:
            return docs[0].get("current_hash", "")
        return ""

    @staticmethod
    def _compute_hash(
        previous_hash: str,
        action: str,
        user_id: str,
        timestamp: datetime,
    ) -> str:
        """SHA-256 of ``previous_hash + action + user_id + timestamp``."""
        raw = f"{previous_hash}{action}{user_id}{timestamp.isoformat()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    # ── Client IP ────────────────────────────────────────────────────────

    @staticmethod
    def _client_ip(request: Request) -> str:
        """Best-effort client IP — respects ``X-Forwarded-For``."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"
