"""Router for EQIP Quality Gate endpoints — /api/v1/quality-gates."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import get_current_user, get_db
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.schemas.quality import QualityGateResponse
from app.services.quality_gate import QualityGateService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quality-gates", tags=["Quality Gates"])


@router.get(
    "",
    response_model=list[QualityGateResponse],
    summary="List all quality gate definitions",
)
async def list_quality_gates(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> list[QualityGateResponse]:
    """Return all active quality gate definitions.

    Quality gates are a bounded set — returned as a plain array, not paginated.
    """
    try:
        svc = QualityGateService(db)
        docs = await svc.list_gates()
        return [QualityGateResponse.model_validate(doc) for doc in docs]
    except AppException as exc:
        logger.warning("list_quality_gates error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
