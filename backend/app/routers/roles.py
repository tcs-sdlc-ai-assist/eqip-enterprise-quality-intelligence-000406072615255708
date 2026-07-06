"""Router for EQIP Role endpoints — /api/v1/roles."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase
from pydantic import BaseModel, ConfigDict, Field

from app.dependencies import get_current_user, get_db, require_role
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.schemas.common import PaginatedResponse
from app.services.role import RoleService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/roles", tags=["Roles"])


# ── Response schema ─────────────────────────────────────────────────────


class RoleResponse(BaseModel):
    """Public role representation returned by role endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    description: str = ""
    permissions: list[str] = Field(default_factory=list)
    is_system: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    version: int = 1


class RoleCreate(BaseModel):
    """Request body for ``POST /api/v1/roles``."""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    description: str = ""
    permissions: list[str] = Field(default_factory=list)
    is_system: bool = False


class RoleUpdate(BaseModel):
    """Request body for ``PUT /api/v1/roles/{id}``."""

    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None
    is_system: Optional[bool] = None
    version: int


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=PaginatedResponse[RoleResponse],
    summary="List roles with pagination",
)
async def list_roles(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PaginatedResponse[RoleResponse]:
    """Return a paginated list of roles."""
    try:
        svc = RoleService(db)
        result = await svc.list_roles(page=page, page_size=page_size)
        return PaginatedResponse[RoleResponse](
            items=[RoleResponse.model_validate(doc) for doc in result.get("items", [])],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_roles error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.post(
    "",
    response_model=RoleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new role",
    dependencies=[Depends(require_role("admin"))],
)
async def create_role(
    body: RoleCreate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> RoleResponse:
    """Create a new role.

    Requires ``admin`` role.
    """
    try:
        svc = RoleService(db)
        data = body.model_dump()
        doc = await svc.create_role(data)
        return RoleResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("create_role error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.put(
    "/{role_id}",
    response_model=RoleResponse,
    summary="Update an existing role",
    dependencies=[Depends(require_role("admin"))],
)
async def update_role(
    role_id: str,
    body: RoleUpdate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> RoleResponse:
    """Update an existing role (optimistic concurrency via ``version``).

    Requires ``admin`` role.
    """
    try:
        svc = RoleService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.update_role(role_id, data)
        return RoleResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("update_role error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
