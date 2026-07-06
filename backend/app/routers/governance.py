"""Router for EQIP Governance Procedure endpoints — /api/v1/governance-procedures."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import get_current_user, get_db, require_role
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.quality import (
    GovernanceProcedureCreate,
    GovernanceProcedureResponse,
    GovernanceProcedureUpdate,
)
from app.services.governance import GovernanceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/governance-procedures", tags=["Governance"])


@router.get(
    "",
    response_model=PaginatedResponse[GovernanceProcedureResponse],
    summary="List governance procedures",
)
async def list_governance_procedures(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PaginatedResponse[GovernanceProcedureResponse]:
    """Return a paginated list of governance procedures."""
    try:
        svc = GovernanceService(db)
        result = await svc.list_procedures(page=page, page_size=page_size)
        return PaginatedResponse[GovernanceProcedureResponse](
            items=[
                GovernanceProcedureResponse.model_validate(doc)
                for doc in result.get("items", [])
            ],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_governance_procedures error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.get(
    "/{procedure_id}",
    response_model=GovernanceProcedureResponse,
    summary="Get governance procedure by ID",
)
async def get_governance_procedure(
    procedure_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> GovernanceProcedureResponse:
    """Return a single governance procedure by its ID."""
    try:
        svc = GovernanceService(db)
        doc = await svc.get_procedure(procedure_id)
        return GovernanceProcedureResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("get_governance_procedure error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.post(
    "",
    response_model=GovernanceProcedureResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a governance procedure",
    dependencies=[Depends(require_role("compliance_officer", "admin"))],
)
async def create_governance_procedure(
    body: GovernanceProcedureCreate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> GovernanceProcedureResponse:
    """Create a new governance procedure.

    Requires ``compliance_officer`` or ``admin`` role.
    """
    try:
        svc = GovernanceService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.create_procedure(data, user_id=current_user.user_id)
        return GovernanceProcedureResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("create_governance_procedure error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.put(
    "/{procedure_id}",
    response_model=GovernanceProcedureResponse,
    summary="Update a governance procedure",
    dependencies=[Depends(require_role("compliance_officer", "admin"))],
)
async def update_governance_procedure(
    procedure_id: str,
    body: GovernanceProcedureUpdate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> GovernanceProcedureResponse:
    """Update an existing governance procedure.

    Requires ``compliance_officer`` or ``admin`` role.
    """
    try:
        svc = GovernanceService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.update_procedure(procedure_id, data)
        return GovernanceProcedureResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("update_governance_procedure error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
