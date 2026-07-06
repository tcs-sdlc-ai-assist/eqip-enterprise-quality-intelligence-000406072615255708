"""Router for EQIP Test Case endpoints — /api/v1/test-cases."""

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
    TestCaseCreate,
    TestCaseResponse,
    TestCaseUpdate,
)
from app.services.test_case import TestCaseService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-cases", tags=["Test Cases"])


@router.get(
    "",
    response_model=PaginatedResponse[TestCaseResponse],
    summary="List test cases",
)
async def list_test_cases(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by TestCaseStatus"),
    priority: Optional[str] = Query(None, description="Filter by Priority"),
    automation_status: Optional[str] = Query(None, description="Filter by AutomationStatus"),
    application_id: Optional[str] = Query(None, description="Filter by application"),
    owner: Optional[str] = Query(None, description="Filter by owner user ID"),
    search: Optional[str] = Query(None, description="Full-text search on name/tags"),
) -> PaginatedResponse[TestCaseResponse]:
    """Return a paginated, optionally filtered list of test cases."""
    try:
        svc = TestCaseService(db)
        result = await svc.list_test_cases(
            page=page,
            page_size=page_size,
            status=status_filter,
            priority=priority,
            automation_status=automation_status,
            application_id=application_id,
            owner_id=owner,
            search=search,
        )
        return PaginatedResponse[TestCaseResponse](
            items=[TestCaseResponse.model_validate(doc) for doc in result.get("items", [])],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_test_cases error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.get(
    "/{test_case_id}",
    response_model=TestCaseResponse,
    summary="Get test case by ID",
)
async def get_test_case(
    test_case_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestCaseResponse:
    """Return a single test case by its ID."""
    try:
        svc = TestCaseService(db)
        doc = await svc.get_test_case(test_case_id)
        return TestCaseResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("get_test_case error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.post(
    "",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a test case",
)
async def create_test_case(
    body: TestCaseCreate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestCaseResponse:
    """Create a new test case."""
    try:
        svc = TestCaseService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.create_test_case(data, user_id=current_user.user_id)
        return TestCaseResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("create_test_case error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.put(
    "/{test_case_id}",
    response_model=TestCaseResponse,
    summary="Update a test case",
)
async def update_test_case(
    test_case_id: str,
    body: TestCaseUpdate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestCaseResponse:
    """Update an existing test case (optimistic concurrency via ``version``)."""
    try:
        svc = TestCaseService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.update_test_case(test_case_id, data)
        return TestCaseResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("update_test_case error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.post(
    "/{test_case_id}/clone",
    response_model=TestCaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Clone a test case",
)
async def clone_test_case(
    test_case_id: str,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestCaseResponse:
    """Clone an existing test case, creating a new copy in ``draft`` status."""
    try:
        svc = TestCaseService(db)
        doc = await svc.clone_test_case(test_case_id, user_id=current_user.user_id)
        return TestCaseResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("clone_test_case error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
