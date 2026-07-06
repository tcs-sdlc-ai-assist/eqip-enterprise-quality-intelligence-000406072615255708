"""Adoption impact document model — platform adoption and value metrics."""

from datetime import datetime

from pydantic import Field

from app.models.base import MongoModel, utcnow


class AdoptionImpactDocument(MongoModel):
    """Represents an adoption / impact measurement snapshot in MongoDB."""

    metric_name: str
    category: str = Field(
        description="MetricCategory: quality | performance | coverage | compliance | adoption",
    )
    current_value: float
    previous_value: float
    change_percentage: float
    trend: str = Field(description="up | down | stable")
    period: str = Field(description="Time period label, e.g. 'Q1 2026', '2026-06'")
    details: dict[str, object] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)
