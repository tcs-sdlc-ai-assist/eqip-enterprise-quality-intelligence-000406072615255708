"""Report document model — generated reports and exports."""

from datetime import datetime

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class ReportDocument(MongoModel):
    """Represents a generated report in MongoDB."""

    name: str
    type: str = Field(
        description=(
            "ReportType: quality_summary | test_coverage | release_readiness "
            "| compliance | trend_analysis"
        ),
    )
    description: str = Field(default="")
    filters: dict[str, object] = Field(default_factory=dict)
    data: dict[str, object] = Field(default_factory=dict)
    format: str = Field(
        default="json",
        description="json | csv | pdf",
    )
    generated_by: PyObjectId
    created_at: datetime = Field(default_factory=utcnow)
