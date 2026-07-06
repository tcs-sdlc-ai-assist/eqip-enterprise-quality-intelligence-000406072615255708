"""Security utilities — password hashing and JWT token management."""

import logging
from datetime import datetime, timedelta, timezone

from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.exceptions import AuthenticationError

logger = logging.getLogger(__name__)

# ── Password hashing ────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify *plain* against a bcrypt *hashed* value."""
    return _pwd_context.verify(plain, hashed)


# ── JWT tokens ───────────────────────────────────────────────────────────────

def create_jwt_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """Encode a JWT with the given *data* payload and expiry.

    If *expires_delta* is ``None`` the default access-token lifetime from
    settings is used.
    """
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_jwt_token(token: str) -> dict:
    """Decode and validate a JWT, returning the payload dict.

    Raises :class:`~app.exceptions.AuthenticationError` on expiry or any
    other JWT error.
    """
    try:
        payload: dict = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except ExpiredSignatureError:
        logger.warning("JWT token expired")
        raise AuthenticationError(detail="Token has expired")
    except JWTError as exc:
        logger.warning("Invalid JWT token: %s", exc)
        raise AuthenticationError(detail="Invalid token") from exc
