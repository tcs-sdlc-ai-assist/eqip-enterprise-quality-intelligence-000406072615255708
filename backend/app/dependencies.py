"""FastAPI dependencies — database access, authentication, and authorization."""

import logging
from datetime import datetime, timezone
from typing import Annotated, Callable

from fastapi import Depends, Request
from jose import JWTError, jwt
from pymongo.asynchronous.database import AsyncDatabase

from app.config import settings
from app.database import get_database
from app.exceptions import AuthenticationError, AuthorizationError
from app.schemas.auth import TokenPayload

logger = logging.getLogger(__name__)


# ── Database dependency ──────────────────────────────────────────────────


async def get_db() -> AsyncDatabase:
    """Return the application MongoDB database handle."""
    return get_database()


# ── Authentication dependency ────────────────────────────────────────────


async def get_current_user(request: Request) -> TokenPayload:
    """Extract and validate the JWT from the ``Authorization: Bearer`` header.

    Returns a ``TokenPayload`` on success.  Raises ``AuthenticationError``
    when the header is missing, the token is malformed, or it has expired.
    """
    auth_header: str | None = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthenticationError(detail="Missing or invalid Authorization header")

    token = auth_header[len("Bearer "):]

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        logger.debug("JWT decode failed: %s", exc)
        raise AuthenticationError(detail="Invalid or expired token") from exc

    # Validate expiry explicitly (python-jose checks it, but be defensive)
    exp: int | None = payload.get("exp")
    if exp is None or datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
        raise AuthenticationError(detail="Token has expired")

    try:
        token_data = TokenPayload(
            user_id=payload.get("sub", ""),
            email=payload.get("email", ""),
            role=payload.get("role", ""),
            permissions=payload.get("permissions", []),
            exp=exp,
        )
    except Exception as exc:
        raise AuthenticationError(detail="Invalid token payload") from exc

    return token_data


# ── Authorization dependency factories ───────────────────────────────────

CurrentUser = Annotated[TokenPayload, Depends(get_current_user)]


def require_role(*roles: str) -> Callable:
    """Return a dependency that checks the current user has one of *roles*.

    Usage::

        @router.get("/admin", dependencies=[Depends(require_role("admin", "manager"))])
        async def admin_only(): ...
    """

    async def _check_role(current_user: CurrentUser) -> TokenPayload:
        if current_user.role not in roles:
            raise AuthorizationError(
                detail=f"Role '{current_user.role}' is not permitted. Required: {', '.join(roles)}",
            )
        return current_user

    return _check_role


def require_permission(permission: str) -> Callable:
    """Return a dependency that checks the current user has *permission*.

    Usage::

        @router.post("/reports", dependencies=[Depends(require_permission("reports:create"))])
        async def create_report(): ...
    """

    async def _check_permission(current_user: CurrentUser) -> TokenPayload:
        if permission not in current_user.permissions:
            raise AuthorizationError(
                detail=f"Missing required permission: {permission}",
            )
        return current_user

    return _check_permission
