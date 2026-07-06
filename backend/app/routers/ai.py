"""AI router — search, ask, and prediction endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.dependencies import CurrentUser, get_db
from app.exceptions import AppException
from app.schemas.ai import (
    AIAskRequest,
    AIAskResponse,
    AIPredictionRequest,
    AIPredictionResponse,
    AISearchRequest,
    AISearchResponse,
    AISearchResultItem,
    PredictionFactor,
)
from app.services.ai_insights import AIInsightsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Insights"])


# ── Exception handler ────────────────────────────────────────────────────


@router.exception_handler(AppException)
async def app_exception_handler(_request, exc: AppException) -> JSONResponse:
    """Translate AppException subclasses into RFC 7807 JSON responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response(),
    )


# ── Endpoints ────────────────────────────────────────────────────────────


@router.post(
    "/search",
    response_model=AISearchResponse,
    status_code=200,
    summary="Natural language search across platform data",
)
async def ai_search(
    body: AISearchRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> AISearchResponse:
    """Search across collections and return ranked results."""
    service = AIInsightsService(db)
    result = await service.search(query=body.query, filters=body.filters)
    # Map service result items to the schema shape
    items = [
        AISearchResultItem(
            title=r.get("summary", ""),
            snippet=f"Collection: {r.get('collection', '')}",
            relevance_score=min(r.get("relevance_score", 0.0), 1.0),
            source=r.get("collection", ""),
        )
        for r in result.get("results", [])
    ]
    return AISearchResponse(results=items)


@router.post(
    "/ask",
    response_model=AIAskResponse,
    status_code=200,
    summary="Ask EQIP a quality-related question",
)
async def ai_ask(
    body: AIAskRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> AIAskResponse:
    """Answer a question using rule-based analysis of DB data."""
    service = AIInsightsService(db)
    result = await service.ask(question=body.question, context=body.context)
    return AIAskResponse(
        answer=result.get("answer", ""),
        confidence=result.get("confidence", 0.0),
        data_sources=result.get("data_sources", []),
        follow_up_questions=result.get("follow_up_questions", []),
    )


@router.post(
    "/predictions/{prediction_type}",
    response_model=AIPredictionResponse,
    status_code=200,
    summary="Get AI-powered predictions",
)
async def ai_predict(
    prediction_type: str,
    body: AIPredictionRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> AIPredictionResponse:
    """Generate trend-based predictions from historical data."""
    service = AIInsightsService(db)
    result = await service.predict(
        prediction_type=prediction_type,
        parameters=body.parameters,
    )
    # Build factors from the basis string
    factors: list[PredictionFactor] = []
    basis = result.get("basis", "")
    if basis:
        factors.append(PredictionFactor(name="basis", weight=1.0, value=basis))

    return AIPredictionResponse(
        prediction={
            "prediction_type": result.get("prediction_type", prediction_type),
            "value": result.get("prediction"),
            "basis": basis,
        },
        confidence=result.get("confidence", 0.0),
        factors=factors,
    )
