"""Metrics router — quality and performance metrics by category."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import CurrentUser, get_db
from app.exceptions import AppException
from app.schemas.integrations import MetricsResponse
from app.services.metrics import MetricsEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metrics", tags=["Metrics"])


# ── Exception handler ────────────────────────────────────────────────────


@router.exception_handler(AppException)
async def app_exception_handler(_request, exc: AppException) -> JSONResponse:
    """Translate AppException subclasses into RFC 7807 JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response(),
    )


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get(
    "/{category}",
    response_model=list[MetricsResponse],
    status_code=200,
    summary="Get metrics for a given category",
)
async def get_metrics(
    category: str,
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> list[MetricsResponse]:
    """Return all metrics matching the requested category."""
    engine = MetricsEngine(db)
    items = await engine.get_metrics(category)
    return [MetricsResponse.model_validate(item) for item in items]
