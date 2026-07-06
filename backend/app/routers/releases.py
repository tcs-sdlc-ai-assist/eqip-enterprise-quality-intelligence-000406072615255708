"""Router for EQIP Release endpoints — /api/v1/releases."""

import logging
import re
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase
from pydantic import BaseModel, ConfigDict, Field

from app.dependencies import get_current_user, get_db, require_role
from app.exceptions import AppException
from app.repositories.release import ReleaseRepository
from app.schemas.auth import TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.quality import ReleaseResponse
from app.services.release import ReleaseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/releases", tags=["Releases"])


# ── Request schemas (route-specific) ────────────────────────────────────


class _GateResultUpdateItem(BaseModel):
    """A single gate result update entry."""

    model_config = ConfigDict(populate_by_name=True)

    gate_id: str
    result: str
    waiver_justification: Optional[str] = None


class GateResultsUpdateRequest(BaseModel):
    """PUT /releases/{id}/gate-results request body."""

    model_config = ConfigDict(populate_by_name=True)

    gates: list[_GateResultUpdateItem] = Field(default_factory=list)


# ── Endpoints ───────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=PaginatedResponse[ReleaseResponse],
    summary="List releases",
    status_code=200,
)
async def list_releases(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by release name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by release status"),
) -> PaginatedResponse[ReleaseResponse]:
    """Return a paginated, optionally filtered list of releases."""
    try:
        repo = ReleaseRepository(db)
        filters: dict = {}
        if search:
            filters["name"] = re.compile(re.escape(search), re.IGNORECASE)
        if status_filter:
            filters["status"] = status_filter
        result = await repo.list(
            filters=filters,
            page=page,
            page_size=page_size,
        )
        return PaginatedResponse[ReleaseResponse](
            items=[ReleaseResponse.model_validate(doc) for doc in result.get("items", [])],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_releases error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.get(
    "/{release_id}/readiness",
    summary="Get release readiness assessment",
)
async def get_release_readiness(
    release_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Return computed readiness data for a release."""
    try:
        svc = ReleaseService(db)
        result = await svc.get_readiness(release_id)
        return result
    except AppException as exc:
        logger.warning("get_release_readiness error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.get(
    "/{release_id}/gate-results",
    summary="Get quality gate results for a release",
)
async def get_gate_results(
    release_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Return quality gate evaluation results for a release."""
    try:
        svc = ReleaseService(db)
        result = await svc.get_gate_results(release_id)
        return result
    except AppException as exc:
        logger.warning("get_gate_results error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.put(
    "/{release_id}/gate-results",
    summary="Update quality gate results for a release",
    dependencies=[Depends(require_role("release_manager", "admin"))],
)
async def update_gate_results(
    release_id: str,
    body: GateResultsUpdateRequest,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Update gate results (pass/fail/waived) for a release.

    Requires ``release_manager`` or ``admin`` role.
    """
    try:
        svc = ReleaseService(db)
        # Map API contract shape to service expectation
        data = {
            "gate_results": [
                {
                    "gate_id": g.gate_id,
                    "result": g.result,
                    "details": g.waiver_justification or "",
                }
                for g in body.gates
            ]
        }
        result = await svc.update_gate_results(release_id, data)
        return result
    except AppException as exc:
        logger.warning("update_gate_results error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
