"""Request / response schemas for AI-powered features (search, ask, predict)."""

from typing import Optional

from pydantic import BaseModel, Field


# ── Search ───────────────────────────────────────────────────────────────


class AISearchRequest(BaseModel):
    """Payload for an AI-powered search query."""

    query: str = Field(min_length=1)
    filters: Optional[dict[str, object]] = None


class AISearchResultItem(BaseModel):
    """Single result returned by an AI search."""

    title: str
    snippet: str
    relevance_score: float = Field(ge=0.0, le=1.0)
    source: str


class AISearchResponse(BaseModel):
    """Response wrapper for AI search results."""

    results: list[AISearchResultItem]


# ── Ask ──────────────────────────────────────────────────────────────────


class AIAskRequest(BaseModel):
    """Payload for an AI question-answering request."""

    question: str = Field(min_length=1)
    context: Optional[dict[str, object]] = None


class AIAskResponse(BaseModel):
    """Response from the AI question-answering engine."""

    answer: str
    confidence: float = Field(ge=0.0, le=1.0)
    data_sources: list[str]
    follow_up_questions: list[str]


# ── Prediction ───────────────────────────────────────────────────────────


class PredictionFactor(BaseModel):
    """A single factor contributing to a prediction."""

    name: str
    weight: float
    value: object


class AIPredictionRequest(BaseModel):
    """Payload for an AI prediction request."""

    parameters: dict[str, object]


class AIPredictionResponse(BaseModel):
    """Response from the AI prediction engine."""

    prediction: dict[str, object]
    confidence: float = Field(ge=0.0, le=1.0)
    factors: list[PredictionFactor]
