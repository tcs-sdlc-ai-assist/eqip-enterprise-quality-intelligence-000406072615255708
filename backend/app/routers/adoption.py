"""Adoption router — adoption and impact measurement endpoints."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import CurrentUser, get_db
from app.exceptions import AppException
from app.repositories.adoption_impact import AdoptionImpactRepository
from app.schemas.integrations import AdoptionImpactResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/adoption-impact", tags=["Adoption"])


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
    "",
    response_model=list[AdoptionImpactResponse],
    status_code=200,
    summary="Get adoption and impact metrics",
)
async def list_adoption_impact(
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> list[AdoptionImpactResponse]:
    """Return all adoption impact snapshots, newest first."""
    repo = AdoptionImpactRepository(db)
    result = await repo.list(page=1, page_size=100, sort_by="created_at", sort_order=-1)
    items: list[dict[str, Any]] = result.get("items", [])
    return [AdoptionImpactResponse.model_validate(item) for item in items]
