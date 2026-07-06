"""Auth-related request / response schemas."""

import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Request schemas ──────────────────────────────────────────────────────


class LoginRequest(BaseModel):
    """POST /api/v1/auth/login request body."""

    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """POST /api/v1/auth/refresh request body."""

    model_config = ConfigDict(populate_by_name=True)

    refresh_token: str


# ── Token payload ────────────────────────────────────────────────────────


class TokenPayload(BaseModel):
    """Decoded JWT payload structure."""

    model_config = ConfigDict(populate_by_name=True)

    user_id: str
    email: str
    role: str
    permissions: list[str] = Field(default_factory=list)
    exp: int


# ── User schemas ─────────────────────────────────────────────────────────


class UserResponse(BaseModel):
    """Public user representation returned in auth and user endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    permissions: list[str] = Field(default_factory=list)
    status: str
    last_login: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class UserCreate(BaseModel):
    """POST /api/v1/users request body."""

    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: str
    permissions: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    """PUT /api/v1/users/{id} request body (partial update)."""

    model_config = ConfigDict(populate_by_name=True)

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[list[str]] = None
    status: Optional[str] = None
    version: int


# ── Auth response schemas ────────────────────────────────────────────────


class LoginResponse(BaseModel):
    """POST /api/v1/auth/login response body."""

    model_config = ConfigDict(populate_by_name=True)

    access_token: str
    refresh_token: str
    expires_in: int
    user: UserResponse
