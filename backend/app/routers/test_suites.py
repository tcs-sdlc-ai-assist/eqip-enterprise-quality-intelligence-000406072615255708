"""Router for EQIP Test Suite endpoints — /api/v1/test-suites."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import get_current_user, get_db
from app.exceptions import AppException
from app.schemas.auth import TokenPayload
from app.schemas.common import PaginatedResponse
from app.schemas.quality import (
    TestSuiteCreate,
    TestSuiteResponse,
    TestSuiteUpdate,
)
from app.services.test_suite import TestSuiteService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test-suites", tags=["Test Suites"])


@router.get(
    "",
    response_model=PaginatedResponse[TestSuiteResponse],
    summary="List test suites",
)
async def list_test_suites(
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PaginatedResponse[TestSuiteResponse]:
    """Return a paginated list of test suites."""
    try:
        svc = TestSuiteService(db)
        result = await svc.list_test_suites(page=page, page_size=page_size)
        return PaginatedResponse[TestSuiteResponse](
            items=[TestSuiteResponse.model_validate(doc) for doc in result.get("items", [])],
            total=result.get("total", 0),
            page=result.get("page", page),
            page_size=result.get("page_size", page_size),
        )
    except AppException as exc:
        logger.warning("list_test_suites error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.post(
    "",
    response_model=TestSuiteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a test suite",
)
async def create_test_suite(
    body: TestSuiteCreate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestSuiteResponse:
    """Create a new test suite."""
    try:
        svc = TestSuiteService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.create_test_suite(data, user_id=current_user.user_id)
        return TestSuiteResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("create_test_suite error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]


@router.put(
    "/{test_suite_id}",
    response_model=TestSuiteResponse,
    summary="Update a test suite",
)
async def update_test_suite(
    test_suite_id: str,
    body: TestSuiteUpdate,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TestSuiteResponse:
    """Update an existing test suite (optimistic concurrency via ``version``)."""
    try:
        svc = TestSuiteService(db)
        data = body.model_dump(exclude_none=True)
        doc = await svc.update_test_suite(test_suite_id, data)
        return TestSuiteResponse.model_validate(doc)
    except AppException as exc:
        logger.warning("update_test_suite error: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content=exc.to_response())  # type: ignore[return-value]
