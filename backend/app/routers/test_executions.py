"""Router for EQIP Test Execution endpoints — /api/v1/test-executions."""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import get_current_user, get_db
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.quality import (
    TestExecutionCreate,
    TestExecutionResponse,
    TestExecutionUpdate,
)
from app.services.test_execution import TestExecutionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-executions", tags=["Test Executions"])


@router.get(
    "",
    response_model=PaginatedResponse[TestExecutionResponse],
    summary="List test executions",
)
async def list_test_executions(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by ExecutionStatus"),
    application_id: Optional[str] = Query(None, description="Filter by application"),
    release_id: Optional[str] = Query(None, description="Filter by release"),
) -> PaginatedResponse[TestExecutionResponse]:
    """Return a paginated, optionally filtered list of test executions."""
    try:
        svc = TestExecutionService(db)
        result = await svc.list_executions(
            page=page,
            page_size=page_size,
            status=status_filter,
            application_id=application_id,
            release_id=release_id,
        )
        return PaginatedResponse[TestExecutionResponse](
            items=[TestExecutionResponse.model_validate(doc) for doc in result.get("items", [])],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_test_executions error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.get(
    "/{execution_id}",
    response_model=TestExecutionResponse,
    summary="Get test execution by ID",
)
async def get_test_execution(
    execution_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestExecutionResponse:
    """Return a single test execution by its ID."""
    try:
        svc = TestExecutionService(db)
        doc = await svc.get_execution(execution_id)
        return TestExecutionResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("get_test_execution error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.post(
    "",
    response_model=TestExecutionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a test execution",
)
async def create_test_execution(
    body: TestExecutionCreate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestExecutionResponse:
    """Create (start) a new test execution run."""
    try:
        svc = TestExecutionService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.create_execution(data, user_id=current_user.user_id)
        return TestExecutionResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("create_test_execution error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.put(
    "/{execution_id}",
    response_model=TestExecutionResponse,
    summary="Update a test execution",
)
async def update_test_execution(
    execution_id: str,
    body: TestExecutionUpdate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestExecutionResponse:
    """Update a test execution (status transitions, results, evidence links)."""
    try:
        svc = TestExecutionService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.update_execution(execution_id, data)
        return TestExecutionResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("update_test_execution error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
