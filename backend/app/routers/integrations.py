"""Integrations router — CRUD and sync for external-system integrations."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import CurrentUser, get_db, require_role
from app.exceptions import AppException
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.integrations import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationUpdate,
)
from app.services.integration import IntegrationManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["Integrations"])


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
    response_model=PaginatedResponse[IntegrationResponse],
    status_code=200,
    summary="List integrations with pagination",
)
async def list_integrations(
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PaginatedResponse[IntegrationResponse]:
    """Return a paginated list of integrations."""
    manager = IntegrationManager(db)
    result = await manager.list_integrations(page=page, page_size=page_size)
    return PaginatedResponse[IntegrationResponse](
        items=[IntegrationResponse.model_validate(item) for item in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.post(
    "",
    response_model=IntegrationResponse,
    status_code=201,
    summary="Create a new integration",
)
async def create_integration(
    body: IntegrationCreate,
    current_user: Annotated[object, Depends(require_role("admin"))],
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> IntegrationResponse:
    """Create a new integration configuration (admin only)."""
    manager = IntegrationManager(db)
    data = body.model_dump()
    # Flatten connection_config for storage
    if "connection_config" in data and isinstance(data["connection_config"], dict):
        pass  # keep as nested dict
    result = await manager.create_integration(data, user_id=current_user.user_id)
    return IntegrationResponse.model_validate(result)


@router.put(
    "/{integration_id}",
    response_model=IntegrationResponse,
    status_code=200,
    summary="Update an existing integration",
)
async def update_integration(
    integration_id: str,
    body: IntegrationUpdate,
    current_user: Annotated[object, Depends(require_role("admin"))],
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> IntegrationResponse:
    """Update an integration (admin only)."""
    manager = IntegrationManager(db)
    data = body.model_dump(exclude_unset=True)
    result = await manager.update_integration(integration_id, data)
    return IntegrationResponse.model_validate(result)


@router.post(
    "/{integration_id}/sync",
    response_model=SuccessResponse,
    status_code=200,
    summary="Trigger a sync for an integration",
)
async def sync_integration(
    integration_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> SuccessResponse:
    """Trigger a manual sync, respecting circuit-breaker state."""
    manager = IntegrationManager(db)
    result = await manager.sync_integration(integration_id)
    sync_status = result.get("status", "unknown")
    return SuccessResponse(
        message=f"Sync completed for integration {integration_id} — status: {sync_status}",
    )
