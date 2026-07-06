"""AI recommendation document model — AI-generated insights and answers."""

from datetime import datetime

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class AIRecommendationDocument(MongoModel):
    """Represents an AI-generated recommendation / answer in MongoDB."""

    query: str
    answer: str
    confidence: float = Field(ge=0.0, le=1.0)
    data_sources: list[str] = Field(default_factory=list)
    recommendation_type: str = Field(
        description="search | ask | prediction | insight",
    )
    context: dict[str, object] = Field(default_factory=dict)
    created_by: PyObjectId
    created_at: datetime = Field(default_factory=utcnow)
