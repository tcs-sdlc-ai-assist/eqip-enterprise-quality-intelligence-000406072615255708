"""Router for EQIP User endpoints — /api/v1/users."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import get_current_user, get_db, require_role
from app.exceptions import AppException
from app.schemas.auth import TokenPayload, UserCreate, UserResponse, UserUpdate
from app.schemas.common import PaginatedResponse
from app.services.user import UserService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    response_model=PaginatedResponse[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="List users with pagination and filters",
    dependencies=[Depends(require_role("admin"))],
)
async def list_users(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by UserStatus"),
    role: Optional[str] = Query(None, description="Filter by RoleEnum"),
    search: Optional[str] = Query(None, description="Full-text search on name/email"),
) -> PaginatedResponse[UserResponse]:
    """Return a paginated, optionally filtered list of users.

    Requires ``admin`` role.
    """
    try:
        svc = UserService(db)
        result = await svc.list_users(
            page=page,
            page_size=page_size,
            status=status_filter,
            role=role,
            search=search,
        )
        return PaginatedResponse[UserResponse](
            items=[UserResponse.model_validate(doc) for doc in result.get("items", [])],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_users error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get user by ID",
)
async def get_user(
    user_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> UserResponse:
    """Return a single user by their ID."""
    try:
        svc = UserService(db)
        doc = await svc.get_user(user_id)
        return UserResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("get_user error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    dependencies=[Depends(require_role("admin"))],
)
async def create_user(
    body: UserCreate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> UserResponse:
    """Create a new user.

    Requires ``admin`` role.
    """
    try:
        svc = UserService(db)
        data = body.model_dump()
        doc = await svc.create_user(data)
        return UserResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("create_user error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing user",
    dependencies=[Depends(require_role("admin"))],
)
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> UserResponse:
    """Update an existing user (optimistic concurrency via ``version``).

    Requires ``admin`` role.
    """
    try:
        svc = UserService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.update_user(user_id, data)
        return UserResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("update_user error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
