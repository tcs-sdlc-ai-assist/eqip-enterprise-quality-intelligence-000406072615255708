"""Router for EQIP Audit Log endpoints — /api/v1/audit-logs."""

import logging
from datetime import datetime
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase
from pydantic import BaseModel, ConfigDict, Field

from app.dependencies import get_current_user, get_db, require_role
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.schemas.common import PaginatedResponse
from app.services.audit import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


# ── Response schema ─────────────────────────────────────────────────────


class AuditLogResponse(BaseModel):
    """Public audit-log entry returned by audit-log endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    user_id: str
    user_email: str = ""
    action: str
    entity_type: str = ""
    entity_id: str = ""
    changes: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    previous_hash: Optional[str] = None
    current_hash: Optional[str] = None
    timestamp: Optional[datetime] = None


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=PaginatedResponse[AuditLogResponse],
    summary="List audit log entries with pagination and filters",
    dependencies=[Depends(require_role("admin", "auditor"))],
)
async def list_audit_logs(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user_id: Optional[str] = Query(None, description="Filter by acting user ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    from_date: Optional[datetime] = Query(None, description="ISO 8601 start date"),
    to_date: Optional[datetime] = Query(None, description="ISO 8601 end date"),
) -> PaginatedResponse[AuditLogResponse]:
    """Return a paginated, optionally filtered list of audit-log entries.

    Requires ``admin`` or ``auditor`` role.
    """
    try:
        svc = AuditService(db)
        result = await svc.search_audit_logs(
            page=page,
            page_size=page_size,
            user_id=user_id,
            action=action,
            from_date=from_date,
            to_date=to_date,
        )
        return PaginatedResponse[AuditLogResponse](
            items=[AuditLogResponse.model_validate(doc) for doc in result.get("items", [])],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_audit_logs error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
