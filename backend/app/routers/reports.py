"""Reports router — report data retrieval and export."""

import logging
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import CurrentUser, get_db
from app.exceptions import AppException
from app.repositories.report import ReportRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Reports"])


# ── Exception handler ────────────────────────────────────────────────────


@router.exception_handler(AppException)
async def app_exception_handler(_request, exc: AppException) -> JSONResponse:
    """Translate AppException subclasses into RFC 7807 JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response(),
    )


# ── Helpers ──────────────────────────────────────────────────────────────


async def _build_report(
    db: AsyncDatabase,
    report_type: str,
    filters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a report data structure from the reports collection.

    Falls back to a generated stub when no stored report matches.
    """
    repo = ReportRepository(db)
    query: dict[str, Any] = {"report_type": report_type}
    if filters:
        query.update(filters)

    result = await repo.list(filters=query, page=1, page_size=1)
    items = result.get("items", [])

    if items:
        report = items[0]
        return {
            "report_type": report_type,
            "title": report.get("title", report_type.replace("_", " ").title()),
            "generated_at": report.get(
                "generated_at",
                datetime.now(tz=timezone.utc).isoformat(),
            ),
            "filters_applied": filters or {},
            "sections": report.get("sections", []),
            "summary": report.get("summary", ""),
        }

    # No stored report — return a minimal stub
    return {
        "report_type": report_type,
        "title": report_type.replace("_", " ").title(),
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "filters_applied": filters or {},
        "sections": [],
        "summary": f"No data available for report type '{report_type}'.",
    }


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get(
    "/{report_type}",
    status_code=200,
    summary="Get report data for a given report type",
)
async def get_report(
    report_type: str,
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    application_id: str | None = Query(None, description="Filter by application"),
    segment_id: str | None = Query(None, description="Filter by segment"),
    release_id: str | None = Query(None, description="Filter by release"),
    from_date: str | None = Query(None, description="ISO 8601 start date"),
    to_date: str | None = Query(None, description="ISO 8601 end date"),
) -> dict[str, Any]:
    """Return report data matching the requested type and optional filters."""
    filters: dict[str, Any] = {}
    if application_id:
        filters["application_id"] = application_id
    if segment_id:
        filters["segment_id"] = segment_id
    if release_id:
        filters["release_id"] = release_id
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date

    return await _build_report(db, report_type, filters or None)


@router.post(
    "/{report_type}/export",
    status_code=200,
    summary="Export a report to a file format",
)
async def export_report(
    report_type: str,
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
    format: str = Query("json", description="Export format: json, csv, xlsx, pdf"),
) -> dict[str, Any]:
    """Export report data in the requested format.

    Currently returns JSON; other formats can be added with streaming
    responses when the export pipeline is implemented.
    """
    report_data = await _build_report(db, report_type)

    if format == "json":
        return report_data

    # For non-JSON formats, return an export-accepted response
    return {
        "export_id": f"export-{report_type}-{datetime.now(tz=timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "status": "processing",
        "report_type": report_type,
        "format": format,
        "estimated_completion": datetime.now(tz=timezone.utc).isoformat(),
    }
