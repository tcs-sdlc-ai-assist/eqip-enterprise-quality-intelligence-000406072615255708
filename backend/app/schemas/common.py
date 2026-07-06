"""Shared response schemas used across multiple routers."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Wrapper for paginated list endpoints (§1.4 of the API contract)."""

    model_config = ConfigDict(populate_by_name=True)

    items: list[T]
    total: int
    page: int
    page_size: int


class ErrorResponse(BaseModel):
    """RFC 7807 Problem Details error shape (§1.6 of the API contract)."""

    model_config = ConfigDict(populate_by_name=True)

    type: str
    title: str
    status: int
    detail: str


class SuccessResponse(BaseModel):
    """Generic success message response."""

    model_config = ConfigDict(populate_by_name=True)

    message: str
