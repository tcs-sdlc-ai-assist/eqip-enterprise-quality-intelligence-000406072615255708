"""Authentication service — login, token refresh, JWT creation."""

import logging
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.asynchronous.database import AsyncDatabase

from app.config import settings
from app.exceptions import AuthenticationError
from app.utils.security import (
    create_jwt_token,
    decode_jwt_token,
    verify_password,
)

logger = logging.getLogger(__name__)


class AuthService:
    """Handles credential verification and JWT lifecycle."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._users = db["users"]

    # ── public API ───────────────────────────────────────────────────────

    async def login(self, email: str, password: str) -> dict:
        """Authenticate a user by *email* / *password* and return tokens.

        Returns a dict with ``access_token``, ``refresh_token``,
        ``expires_in`` (seconds) and a safe ``user`` sub-dict.

        Raises :class:`~app.exceptions.AuthenticationError` when the
        credentials are invalid or the account is not active.
        """
        user = await self._users.find_one({"email": email})
        if user is None:
            logger.warning("Login attempt with unknown email: %s", email)
            raise AuthenticationError(detail="Invalid email or password")

        if not verify_password(password, user.get("password_hash", "")):
            logger.warning("Invalid password for email: %s", email)
            raise AuthenticationError(detail="Invalid email or password")

        if user.get("status") != "active":
            logger.warning("Login attempt on inactive account: %s", email)
            raise AuthenticationError(detail="Account is not active")

        # Update last_login timestamp
        await self._users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.now(tz=timezone.utc)}},
        )

        access_token = self._create_access_token(user)
        refresh_token = self._create_refresh_token(str(user["_id"]))

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "user": self._safe_user(user),
        }

    async def refresh_token(self, refresh_token: str) -> dict:
        """Exchange a valid refresh token for a new access token.

        Returns a dict with ``access_token`` and ``expires_in``.

        Raises :class:`~app.exceptions.AuthenticationError` when the
        refresh token is invalid, expired, or the user no longer exists.
        """
        payload = decode_jwt_token(refresh_token)

        if payload.get("type") != "refresh":
            raise AuthenticationError(detail="Invalid token type")

        user_id = payload.get("sub")
        if user_id is None:
            raise AuthenticationError(detail="Invalid token payload")

        try:
            oid = ObjectId(user_id)
        except (InvalidId, TypeError) as exc:
            raise AuthenticationError(detail="Invalid token payload") from exc

        user = await self._users.find_one({"_id": oid})
        if user is None:
            raise AuthenticationError(detail="User not found")

        if user.get("status") != "active":
            raise AuthenticationError(detail="Account is not active")

        access_token = self._create_access_token(user)

        return {
            "access_token": access_token,
            "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

    # ── token helpers ────────────────────────────────────────────────────

    def _create_access_token(self, user_doc: dict) -> str:
        """Build a JWT access token carrying user identity claims."""
        data = {
            "sub": str(user_doc["_id"]),
            "email": user_doc["email"],
            "role": user_doc.get("role", ""),
            "permissions": user_doc.get("permissions", []),
            "type": "access",
        }
        expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        return create_jwt_token(data, expires_delta=expires)

    def _create_refresh_token(self, user_id: str) -> str:
        """Build a JWT refresh token (minimal claims)."""
        data = {
            "sub": user_id,
            "type": "refresh",
        }
        expires = timedelta(minutes=settings.JWT_REFRESH_TOKEN_EXPIRE_MINUTES)
        return create_jwt_token(data, expires_delta=expires)

    # ── projection ───────────────────────────────────────────────────────

    @staticmethod
    def _safe_user(user_doc: dict) -> dict:
        """Return a client-safe subset of the user document."""
        return {
            "id": str(user_doc["_id"]),
            "email": user_doc["email"],
            "first_name": user_doc.get("first_name", ""),
            "last_name": user_doc.get("last_name", ""),
            "role": user_doc.get("role", ""),
            "permissions": user_doc.get("permissions", []),
            "status": user_doc.get("status", "active"),
        }
