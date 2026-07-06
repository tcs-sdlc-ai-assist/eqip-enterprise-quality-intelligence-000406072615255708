"""Auth router — login, logout, and token refresh endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import get_current_user, get_db
from app.exceptions import AppException
from app.schemas.auth import LoginRequest, LoginResponse, RefreshRequest, TokenPayload
from app.schemas.common import SuccessResponse
from app.services.auth import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── Exception handler ────────────────────────────────────────────────────


@router.exception_handler(AppException)
async def app_exception_handler(_request, exc: AppException) -> JSONResponse:
    """Translate AppException subclasses into RFC 7807 JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response(),
    )


# ── Endpoints ────────────────────────────────────────────────────────────


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=200,
    summary="Authenticate with email and password",
)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> LoginResponse:
    """Verify credentials and return access + refresh tokens."""
    service = AuthService(db)
    data = await service.login(body.email, body.password)
    return LoginResponse(**data)


@router.post(
    "/logout",
    response_model=SuccessResponse,
    status_code=200,
    summary="Invalidate the current session",
)
async def logout(
    _current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> SuccessResponse:
    """Log out the authenticated user.

    In a stateless JWT setup this is a client-side operation (discard the
    token).  The endpoint exists so the frontend has a concrete call to
    make and the audit trail records the event.
    """
    return SuccessResponse(message="Successfully logged out")


@router.post(
    "/refresh",
    response_model=LoginResponse,
    status_code=200,
    summary="Exchange a refresh token for a new access token",
)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> LoginResponse:
    """Return a fresh access token given a valid refresh token."""
    service = AuthService(db)
    data = await service.refresh_token(body.refresh_token)
    return data
