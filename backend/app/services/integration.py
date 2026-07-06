"""Integration service — business logic for external-system integrations."""

import logging
from datetime import datetime, timezone

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import ConflictError, NotFoundError
from app.repositories.integration import IntegrationRepository

logger = logging.getLogger(__name__)

# Circuit-breaker defaults
_CB_FAILURE_THRESHOLD = 5
_CB_RESET_TIMEOUT_SECONDS = 60


class IntegrationManager:
    """Manages integration lifecycle, sync triggers, and circuit-breaker state."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = IntegrationRepository(db)

    # ── public API ───────────────────────────────────────────────────────

    async def create_integration(self, data: dict, user_id: str) -> dict:
        """Create a new integration with initial circuit-breaker state.

        Sets *owner_id*, timestamps, and a closed circuit breaker.
        """
        now = datetime.now(tz=timezone.utc)
        data["owner_id"] = user_id
        data.setdefault("status", "inactive")
        data.setdefault("error_count", 0)
        data.setdefault("last_error", None)
        data.setdefault("last_sync", None)
        data["circuit_breaker"] = {
            "state": "closed",
            "failure_count": 0,
            "threshold": data.get("circuit_breaker", {}).get(
                "threshold", _CB_FAILURE_THRESHOLD
            ),
            "reset_timeout": data.get("circuit_breaker", {}).get(
                "reset_timeout", _CB_RESET_TIMEOUT_SECONDS
            ),
        }
        data.setdefault("retry_rules", {
            "max_retries": 3,
            "backoff_strategy": "exponential",
            "initial_delay": 1,
        })
        data["created_at"] = now
        data["updated_at"] = now
        data.setdefault("version", 1)

        result = await self._repo.create(data)
        logger.info("Integration created: %s", result.get("id"))
        return result

    async def list_integrations(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Return a paginated list of integrations."""
        return await self._repo.list(page=page, page_size=page_size)

    async def update_integration(self, id: str, data: dict) -> dict:
        """Update an integration with optimistic-concurrency version check.

        Raises :class:`~app.exceptions.NotFoundError` when the integration
        does not exist and :class:`~app.exceptions.ConflictError` on a
        version mismatch.
        """
        existing = await self._repo.get_by_id(id)
        if existing is None:
            raise NotFoundError(detail=f"Integration {id} not found")

        current_version = existing.get("version", 1)
        result = await self._repo.update(id, data, version=current_version)
        if result is None:
            raise ConflictError(
                detail=f"Version conflict updating integration {id}"
            )
        logger.info("Integration updated: %s", id)
        return result

    async def sync_integration(self, id: str) -> dict:
        """Trigger a sync for the integration, respecting circuit-breaker state.

        * **closed** — attempt the sync; on failure increment
          ``failure_count`` and open the circuit if the threshold is reached.
        * **open** — check whether ``reset_timeout`` has elapsed; if so
          transition to *half_open* and retry, otherwise reject immediately.
        * **half_open** — attempt the sync; on success close the circuit,
          on failure re-open it.

        Returns the updated integration document.
        """
        existing = await self._repo.get_by_id(id)
        if existing is None:
            raise NotFoundError(detail=f"Integration {id} not found")

        cb = existing.get("circuit_breaker", {})
        cb_state = cb.get("state", "closed")
        now = datetime.now(tz=timezone.utc)

        # ── open: check reset timeout ────────────────────────────────────
        if cb_state == "open":
            last_sync = existing.get("last_sync")
            reset_timeout = cb.get("reset_timeout", _CB_RESET_TIMEOUT_SECONDS)
            if last_sync is not None:
                elapsed = (now - last_sync).total_seconds()
                if elapsed < reset_timeout:
                    raise ConflictError(
                        detail=(
                            f"Circuit breaker is open for integration {id}. "
                            f"Retry after {int(reset_timeout - elapsed)}s."
                        ),
                    )
            # Transition to half_open and fall through to attempt sync
            cb_state = "half_open"

        # ── attempt sync (simulated) ─────────────────────────────────────
        try:
            sync_success = await self._perform_sync(existing)
        except Exception:
            sync_success = False
            logger.exception("Sync failed for integration %s", id)

        # ── update circuit-breaker state based on result ──────────────────
        update_data: dict = {"last_sync": now}

        if sync_success:
            update_data["circuit_breaker"] = {
                "state": "closed",
                "failure_count": 0,
                "threshold": cb.get("threshold", _CB_FAILURE_THRESHOLD),
                "reset_timeout": cb.get("reset_timeout", _CB_RESET_TIMEOUT_SECONDS),
            }
            update_data["status"] = "active"
            update_data["last_error"] = None
            logger.info("Sync succeeded for integration %s", id)
        else:
            failure_count = cb.get("failure_count", 0) + 1
            threshold = cb.get("threshold", _CB_FAILURE_THRESHOLD)
            new_state = "open" if failure_count >= threshold else cb_state
            if new_state == "open" and cb_state != "open":
                logger.warning(
                    "Circuit breaker opened for integration %s "
                    "(failures=%d, threshold=%d)",
                    id,
                    failure_count,
                    threshold,
                )
            update_data["circuit_breaker"] = {
                "state": new_state,
                "failure_count": failure_count,
                "threshold": threshold,
                "reset_timeout": cb.get("reset_timeout", _CB_RESET_TIMEOUT_SECONDS),
            }
            update_data["error_count"] = existing.get("error_count", 0) + 1
            update_data["last_error"] = "Sync operation failed"
            update_data["status"] = "error"

        result = await self._repo.update(id, update_data)
        if result is None:
            raise NotFoundError(detail=f"Integration {id} not found after sync")
        return result

    # ── internal helpers ─────────────────────────────────────────────────

    async def _perform_sync(self, integration: dict) -> bool:
        """Simulate an external sync operation.

        In a real implementation this would call the external system's API.
        Returns ``True`` on success.
        """
        # Simulate: integrations with status "error" fail, others succeed
        return integration.get("status") != "error"
