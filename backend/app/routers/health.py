"""Health router — liveness and readiness probes.

These endpoints live at ``/api/health`` (NOT under ``/api/v1``).  The
router declares no prefix; the full paths are set in the decorators so
``main.py`` can include it with ``prefix=""``.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_client

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


# ── Response models ──────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    """Liveness probe response."""

    status: str
    service: str
    timestamp: str


class ReadinessResponse(BaseModel):
    """Readiness probe response."""

    status: str
    service: str
    database: str
    timestamp: str


# ── Liveness ─────────────────────────────────────────────────────────────


@router.get(
    "/api/health",
    response_model=HealthResponse,
    status_code=200,
    summary="Liveness probe — no external dependencies",
)
async def health() -> HealthResponse:
    """Return a simple heartbeat.  No DB or secret access so it reflects
    pure process liveness."""
    return HealthResponse(
        status="healthy",
        service="eqip-api",
        timestamp=datetime.now(tz=timezone.utc).isoformat(),
    )


# ── Readiness ────────────────────────────────────────────────────────────


@router.get(
    "/api/health/ready",
    response_model=ReadinessResponse,
    status_code=200,
    summary="Readiness probe — checks database connectivity",
)
async def health_ready() -> JSONResponse:
    """Ping MongoDB and report readiness.  Returns ``503`` when the
    database is unreachable so load-balancers can route traffic away."""
    now = datetime.now(tz=timezone.utc).isoformat()
    try:
        client = get_client()
        await client.admin.command("ping")
        return JSONResponse(
            status_code=200,
            content={
                "status": "ready",
                "service": "eqip-api",
                "database": "connected",
                "timestamp": now,
            },
        )
    except Exception:
        logger.exception("Readiness check failed — database unreachable")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "service": "eqip-api",
                "database": "disconnected",
                "timestamp": now,
            },
        )
