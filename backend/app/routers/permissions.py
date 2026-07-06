"""Router for EQIP Permission endpoints — /api/v1/permissions."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase
from pydantic import BaseModel, ConfigDict

from app.dependencies import get_current_user, get_db
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.services.permission import PermissionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/permissions", tags=["Permissions"])


# ── Response schema ─────────────────────────────────────────────────────


class PermissionResponse(BaseModel):
    """Public permission representation returned by permission endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    description: str = ""


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=list[PermissionResponse],
    summary="List all available permissions",
)
async def list_permissions(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> list[PermissionResponse]:
    """Return the full list of available permission types.

    Permissions are a small, bounded set — returned as a plain array, not
    paginated.
    """
    try:
        svc = PermissionService(db)
        items = await svc.list_permissions()
        return [PermissionResponse.model_validate(doc) for doc in items]
    except AppException as exc:
        logger.warning("list_permissions error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
