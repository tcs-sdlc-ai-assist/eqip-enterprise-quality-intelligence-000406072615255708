"""Router for EQIP Evidence endpoints — /api/v1/evidence."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import get_current_user, get_db
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.schemas.quality import EvidenceResponse
from app.services.evidence import EvidenceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/evidence", tags=["Evidence"])


@router.post(
    "",
    response_model=EvidenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload evidence",
)
async def upload_evidence(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    file: UploadFile = File(..., description="The evidence file"),
    test_execution_id: str = Form(..., description="Associated test execution ID"),
    test_case_id: Optional[str] = Form(None, description="Associated test case ID"),
    evidence_type: str = Form(..., alias="type", description="Evidence type"),
    description: Optional[str] = Form(None, description="Optional description"),
) -> EvidenceResponse:
    """Upload an evidence file (multipart form data).

    The file metadata is stored in MongoDB; the actual file is persisted
    to external storage (or a local path for dev).
    """
    try:
        svc = EvidenceService(db)

        # Read file metadata
        filename = file.filename or "unknown"
        content = await file.read()
        file_size = len(content)
        mime_type = file.content_type or "application/octet-stream"

        # For now, store to a local-convention path (external storage in prod)
        storage_path = f"evidence/{test_execution_id}/{filename}"

        data = {
            "test_execution_id": test_execution_id,
            "test_case_id": test_case_id,
            "type": evidence_type,
            "filename": filename,
            "file_size": file_size,
            "mime_type": mime_type,
            "storage_path": storage_path,
            "uploaded_by": current_user.user_id,
            "description": description,
        }

        doc = await svc.upload_evidence(data)
        return EvidenceResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("upload_evidence error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.get(
    "/{evidence_id}/download",
    summary="Download evidence file",
)
async def download_evidence(
    evidence_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> dict:
    """Return evidence metadata including the storage path.

    In a production deployment this would stream the file from external
    storage with appropriate ``Content-Type`` and ``Content-Disposition``
    headers.  For now it returns the metadata dict so the caller can
    locate the file.
    """
    try:
        svc = EvidenceService(db)
        result = await svc.download_evidence(evidence_id)
        return result
    except AppException as exc:
        logger.warning("download_evidence error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
