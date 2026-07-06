"""AI insights service — search, ask, and predict over platform data."""

import logging
import re
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError, ValidationError
from app.repositories.ai_recommendation import AIRecommendationRepository

logger = logging.getLogger(__name__)

# Collections that the search / ask / predict features query
_SEARCHABLE_COLLECTIONS = [
    "metrics",
    "test_executions",
    "integrations",
    "ai_recommendations",
    "adoption_impact",
    "reports",
]


class AIInsightsService:
    """Rule-based AI insights: search, Q&A, and trend predictions."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = AIRecommendationRepository(db)
        self._metrics = db["metrics"]
        self._test_executions = db["test_executions"]

    # ── search ───────────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        filters: dict[str, Any] | None = None,
    ) -> dict:
        """Search across collections and return ranked results with relevance scores.

        Uses a simple text-matching heuristic (case-insensitive substring)
        across searchable string fields.  Results are ranked by the number
        of field hits.
        """
        if not query or not query.strip():
            raise ValidationError(detail="Search query must not be empty")

        pattern = re.compile(re.escape(query.strip()), re.IGNORECASE)
        results: list[dict[str, Any]] = []

        for coll_name in _SEARCHABLE_COLLECTIONS:
            try:
                coll = self._db[coll_name]
                mongo_filter: dict[str, Any] = dict(filters) if filters else {}
                cursor = coll.find(mongo_filter).limit(50)
                async for doc in cursor:
                    score = self._score_document(doc, pattern)
                    if score > 0:
                        results.append({
                            "id": str(doc["_id"]),
                            "collection": coll_name,
                            "relevance_score": score,
                            "summary": self._summarise_doc(doc, coll_name),
                        })
            except Exception:
                logger.exception("Search error in collection %s", coll_name)

        # Sort by relevance descending
        results.sort(key=lambda r: r["relevance_score"], reverse=True)

        return {
            "query": query,
            "total": len(results),
            "results": results[:20],
        }

    # ── ask ───────────────────────────────────────────────────────────────

    async def ask(
        self,
        question: str,
        context: dict[str, Any] | None = None,
    ) -> dict:
        """Answer a question using rule-based analysis of DB data.

        Falls back through a chain:
        1. Try to match the question to a known pattern and answer from data.
        2. Return a generic answer with pointers to relevant data sources.

        Returns ``answer``, ``confidence``, ``data_sources``, and
        ``follow_up_questions``.
        """
        if not question or not question.strip():
            raise ValidationError(detail="Question must not be empty")

        question_lower = question.strip().lower()

        # ── pattern-based answers ────────────────────────────────────────
        if any(kw in question_lower for kw in ("test", "coverage", "pass rate")):
            return await self._answer_test_stats(question)

        if any(kw in question_lower for kw in ("metric", "quality", "performance")):
            return await self._answer_metric_stats(question)

        if any(kw in question_lower for kw in ("integration", "sync", "connect")):
            return await self._answer_integration_stats(question)

        # ── generic fallback ─────────────────────────────────────────────
        return {
            "question": question,
            "answer": (
                "I don't have a specific rule for that question. "
                "Try asking about test coverage, metrics, or integrations."
            ),
            "confidence": 0.3,
            "data_sources": [],
            "follow_up_questions": [
                "What is the current test pass rate?",
                "How are quality metrics trending?",
                "Which integrations are active?",
            ],
        }

    # ── predict ──────────────────────────────────────────────────────────

    async def predict(
        self,
        prediction_type: str,
        parameters: dict[str, Any],
    ) -> dict:
        """Generate simple trend-based predictions from historical data.

        Supported *prediction_type* values:
        - ``metric_trend`` — predict next value for a metric based on
          recent adoption-impact snapshots.
        - ``defect_forecast`` — estimate upcoming defect count from
          recent test execution failure rates.

        Returns ``prediction``, ``confidence``, ``basis``, and
        ``prediction_type``.
        """
        if prediction_type == "metric_trend":
            return await self._predict_metric_trend(parameters)

        if prediction_type == "defect_forecast":
            return await self._predict_defect_forecast(parameters)

        raise ValidationError(
            detail=(
                f"Unknown prediction_type '{prediction_type}'. "
                "Supported: metric_trend, defect_forecast."
            ),
        )

    # ── internal: search helpers ─────────────────────────────────────────

    @staticmethod
    def _score_document(doc: dict, pattern: re.Pattern[str]) -> float:
        """Return a relevance score based on how many string fields match."""
        hits = 0
        for value in doc.values():
            if isinstance(value, str) and pattern.search(value):
                hits += 1
        return float(hits)

    @staticmethod
    def _summarise_doc(doc: dict, collection: str) -> str:
        """Build a short human-readable summary of a document."""
        name = doc.get("name") or doc.get("query") or doc.get("metric_name") or ""
        status = doc.get("status") or doc.get("category") or ""
        return f"[{collection}] {name} ({status})".strip()

    # ── internal: ask helpers ────────────────────────────────────────────

    async def _answer_test_stats(self, question: str) -> dict:
        """Answer questions about test execution statistics."""
        total = await self._test_executions.count_documents({})
        passed = await self._test_executions.count_documents({"status": "passed"})
        failed = await self._test_executions.count_documents({"status": "failed"})
        pass_rate = (passed / total * 100) if total > 0 else 0.0

        answer = (
            f"There are {total} test executions in total. "
            f"{passed} passed and {failed} failed, "
            f"giving a pass rate of {pass_rate:.1f}%."
        )
        return {
            "question": question,
            "answer": answer,
            "confidence": 0.85,
            "data_sources": ["test_executions"],
            "follow_up_questions": [
                "Which test suites have the lowest pass rate?",
                "What are the most common failure reasons?",
            ],
        }

    async def _answer_metric_stats(self, question: str) -> dict:
        """Answer questions about metrics."""
        total = await self._metrics.count_documents({})
        cursor = self._metrics.find({}).sort("current_value", -1).limit(5)
        top_metrics: list[str] = []
        async for doc in cursor:
            name = doc.get("name", "unknown")
            value = doc.get("current_value")
            if value is not None:
                top_metrics.append(f"{name}: {value:.2f}")
            else:
                top_metrics.append(f"{name}: not yet calculated")

        top_str = "; ".join(top_metrics) if top_metrics else "none calculated yet"
        answer = (
            f"There are {total} metrics defined. "
            f"Top metrics by value: {top_str}."
        )
        return {
            "question": question,
            "answer": answer,
            "confidence": 0.80,
            "data_sources": ["metrics"],
            "follow_up_questions": [
                "How are quality metrics trending?",
                "Which metrics are below target?",
            ],
        }

    async def _answer_integration_stats(self, question: str) -> dict:
        """Answer questions about integrations."""
        integrations_coll = self._db["integrations"]
        total = await integrations_coll.count_documents({})
        active = await integrations_coll.count_documents({"status": "active"})
        errored = await integrations_coll.count_documents({"status": "error"})

        answer = (
            f"There are {total} integrations configured. "
            f"{active} are active and {errored} are in error state."
        )
        return {
            "question": question,
            "answer": answer,
            "confidence": 0.85,
            "data_sources": ["integrations"],
            "follow_up_questions": [
                "Which integrations are failing?",
                "When was the last successful sync?",
            ],
        }

    # ── internal: predict helpers ────────────────────────────────────────

    async def _predict_metric_trend(self, parameters: dict[str, Any]) -> dict:
        """Predict the next value for a metric from adoption-impact history."""
        metric_name = parameters.get("metric_name", "")
        if not metric_name:
            raise ValidationError(
                detail="metric_name is required for metric_trend prediction"
            )

        adoption_coll = self._db["adoption_impact"]
        cursor = (
            adoption_coll.find({"metric_name": metric_name})
            .sort("created_at", -1)
            .limit(5)
        )
        snapshots: list[dict] = []
        async for doc in cursor:
            snapshots.append(doc)

        if not snapshots:
            return {
                "prediction_type": "metric_trend",
                "prediction": None,
                "confidence": 0.0,
                "basis": "No historical data available",
            }

        # Simple linear extrapolation from recent change percentages
        changes = [s.get("change_percentage", 0.0) for s in snapshots]
        avg_change = sum(changes) / len(changes)
        latest_value = snapshots[0].get("current_value", 0.0)
        predicted_value = latest_value * (1 + avg_change / 100)

        confidence = min(0.7, 0.3 + 0.1 * len(snapshots))

        return {
            "prediction_type": "metric_trend",
            "prediction": round(predicted_value, 4),
            "confidence": confidence,
            "basis": (
                f"Based on {len(snapshots)} recent snapshots with "
                f"average change of {avg_change:.2f}%"
            ),
        }

    async def _predict_defect_forecast(self, parameters: dict[str, Any]) -> dict:
        """Estimate upcoming defect count from recent failure rates."""
        total = await self._test_executions.count_documents({})
        failed = await self._test_executions.count_documents({"status": "failed"})

        if total == 0:
            return {
                "prediction_type": "defect_forecast",
                "prediction": 0,
                "confidence": 0.0,
                "basis": "No test execution data available",
            }

        failure_rate = failed / total
        window = parameters.get("window_size", total)
        predicted_defects = int(failure_rate * float(window))

        return {
            "prediction_type": "defect_forecast",
            "prediction": predicted_defects,
            "confidence": 0.6,
            "basis": (
                f"Based on {failed}/{total} failure rate "
                f"({failure_rate:.1%}) projected over {window} executions"
            ),
        }
