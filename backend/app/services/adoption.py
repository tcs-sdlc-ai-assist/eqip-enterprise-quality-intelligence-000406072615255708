"""Adoption service — adoption impact metrics aggregation."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.adoption_impact import AdoptionImpactRepository

logger = logging.getLogger(__name__)

# Categories and their metric definitions
_CATEGORY_METRICS: dict[str, dict[str, Any]] = {
    "quality": {
        "label": "Quality Improvement",
        "description": "Impact on overall software quality metrics.",
        "collection": "test_executions",
        "current_query": {"status": "passed"},
        "total_query": {},
    },
    "performance": {
        "label": "Performance Gains",
        "description": "Improvements in test execution speed and efficiency.",
        "collection": "test_executions",
        "current_query": {"status": {"$in": ["passed", "failed"]}},
        "total_query": {},
    },
    "coverage": {
        "label": "Test Coverage",
        "description": "Increase in automated test coverage across applications.",
        "collection": "test_cases",
        "current_query": {"automation_status": "automated"},
        "total_query": {},
    },
    "compliance": {
        "label": "Compliance Rate",
        "description": "Governance procedure compliance improvements.",
        "collection": "governance",
        "current_query": {"status": "active"},
        "total_query": {"status": {"$ne": "deleted"}},
    },
    "adoption": {
        "label": "Platform Adoption",
        "description": "Overall platform adoption and active usage metrics.",
        "collection": "integrations",
        "current_query": {"status": "active"},
        "total_query": {},
    },
}


class AdoptionService:
    """Aggregates adoption impact metrics across EQIP categories."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = AdoptionImpactRepository(db)
        self._metrics = db["metrics"]

    # ── public API ───────────────────────────────────────────────────────

    async def get_adoption_impact(self) -> list[dict]:
        """Aggregate adoption metrics across categories.

        For each category computes:
        - ``current_value`` — the current metric value (percentage).
        - ``change_percentage`` — change compared to the previous period.
        - ``trend`` — ``up``, ``down``, or ``stable``.

        Returns a list of category metric dicts.
        """
        results: list[dict] = []

        for category, meta in _CATEGORY_METRICS.items():
            try:
                metric = await self._compute_category_metric(category, meta)
                results.append(metric)
            except Exception:
                logger.exception(
                    "Failed to compute adoption metric for category '%s'",
                    category,
                )
                results.append(
                    {
                        "category": category,
                        "label": meta["label"],
                        "description": meta["description"],
                        "current_value": 0.0,
                        "previous_value": 0.0,
                        "change_percentage": 0.0,
                        "trend": "stable",
                    }
                )

        return results

    # ── private helpers ──────────────────────────────────────────────────

    async def _compute_category_metric(
        self,
        category: str,
        meta: dict[str, Any],
    ) -> dict:
        """Compute a single category's adoption metric."""
        coll = self._db[meta["collection"]]

        now = datetime.now(tz=timezone.utc)
        period_start = now - timedelta(days=30)
        previous_start = now - timedelta(days=60)

        # Current period counts
        current_filter: dict[str, Any] = dict(meta["current_query"])
        current_filter["created_at"] = {"$gte": period_start}
        current_count = await coll.count_documents(current_filter)

        total_filter: dict[str, Any] = dict(meta["total_query"])
        total_filter["created_at"] = {"$gte": period_start}
        total_count = await coll.count_documents(total_filter)

        current_value = (
            round((current_count / total_count) * 100, 2) if total_count > 0 else 0.0
        )

        # Previous period counts
        prev_current_filter: dict[str, Any] = dict(meta["current_query"])
        prev_current_filter["created_at"] = {"$gte": previous_start, "$lt": period_start}
        prev_current_count = await coll.count_documents(prev_current_filter)

        prev_total_filter: dict[str, Any] = dict(meta["total_query"])
        prev_total_filter["created_at"] = {"$gte": previous_start, "$lt": period_start}
        prev_total_count = await coll.count_documents(prev_total_filter)

        previous_value = (
            round((prev_current_count / prev_total_count) * 100, 2)
            if prev_total_count > 0
            else 0.0
        )

        # Change and trend
        change_percentage = round(current_value - previous_value, 2)
        if change_percentage > 0:
            trend = "up"
        elif change_percentage < 0:
            trend = "down"
        else:
            trend = "stable"

        return {
            "category": category,
            "label": meta["label"],
            "description": meta["description"],
            "current_value": current_value,
            "previous_value": previous_value,
            "change_percentage": change_percentage,
            "trend": trend,
        }
