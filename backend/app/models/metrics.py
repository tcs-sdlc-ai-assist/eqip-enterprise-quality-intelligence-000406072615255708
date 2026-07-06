"""Metric document model — core metrics engine entities."""

from datetime import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, utcnow


class FormulaConfig(MongoModel):
    """Embedded formula definition for a metric."""

    type: str = Field(description="simple | composite | weighted | ratio")
    expression: str = Field(description="Formula expression string")
    variables: list[str] = Field(default_factory=list, description="Variable names used in the expression")


class MetricDocument(MongoModel):
    """Represents a metric definition and its current state in MongoDB."""

    name: str
    category: str = Field(
        description="MetricCategory: quality | performance | coverage | compliance | adoption",
    )
    description: str
    formula: FormulaConfig
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    trend: Optional[str] = Field(
        default=None,
        description="up | down | stable",
    )
    weights: dict[str, float] = Field(default_factory=dict)
    unit: str = Field(default="", description="Unit of measurement (e.g. %, count, score)")
    last_calculated: Optional[datetime] = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
