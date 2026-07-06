"""Dashboard service — aggregated key metrics for the EQIP dashboard."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

logger = logging.getLogger(__name__)


class DashboardService:
    """Aggregates cross-collection metrics for the main dashboard view."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._test_cases = db["test_cases"]
        self._test_suites = db["test_suites"]
        self._test_executions = db["test_executions"]
        self._integrations = db["integrations"]
        self._releases = db["releases"]
        self._governance = db["governance"]
        self._evidence = db["evidence"]

    # ── public API ───────────────────────────────────────────────────────

    async def get_dashboard_data(self) -> dict:
        """Aggregate key metrics for the dashboard.

        Returns
        -------
        dict
            ``{total_test_cases, total_test_suites, total_executions,
            recent_executions, pass_rate, active_integrations,
            quality_score, upcoming_releases, compliance_status,
            trend_data}``
        """
        total_test_cases = await self._test_cases.count_documents({})
        total_test_suites = await self._test_suites.count_documents({})
        total_executions = await self._test_executions.count_documents({})

        recent_executions = await self._get_recent_executions()
        pass_rate = await self._compute_pass_rate()
        active_integrations = await self._integrations.count_documents(
            {"status": "active"}
        )
        quality_score = await self._compute_quality_score()
        upcoming_releases = await self._get_upcoming_releases()
        compliance_status = await self._compute_compliance_status()
        trend_data = await self._compute_trend_data()

        return {
            "total_test_cases": total_test_cases,
            "total_test_suites": total_test_suites,
            "total_executions": total_executions,
            "recent_executions": recent_executions,
            "pass_rate": pass_rate,
            "active_integrations": active_integrations,
            "quality_score": quality_score,
            "upcoming_releases": upcoming_releases,
            "compliance_status": compliance_status,
            "trend_data": trend_data,
        }

    # ── private helpers ──────────────────────────────────────────────────

    async def _get_recent_executions(self) -> list[dict]:
        """Return the 10 most recent test executions."""
        cursor = (
            self._test_executions.find()
            .sort("created_at", -1)
            .limit(10)
        )
        results: list[dict] = []
        async for doc in cursor:
            results.append(
                {
                    "id": str(doc["_id"]),
                    "name": doc.get("name", ""),
                    "status": doc.get("status", ""),
                    "executed_by": doc.get("executed_by", ""),
                    "start_time": str(doc.get("start_time", "")),
                    "end_time": str(doc.get("end_time", "")),
                    "duration_seconds": doc.get("duration_seconds"),
                    "created_at": str(doc.get("created_at", "")),
                }
            )
        return results

    async def _compute_pass_rate(self) -> float:
        """Compute the percentage of passed executions."""
        total = await self._test_executions.count_documents({})
        if total == 0:
            return 0.0
        passed = await self._test_executions.count_documents({"status": "passed"})
        return round((passed / total) * 100, 2)

    async def _compute_quality_score(self) -> float:
        """Compute a weighted composite quality score (0–100).

        Weights:
        - 40 %  pass rate
        - 25 %  automation coverage
        - 20 %  compliance rate
        - 15 %  integration health
        """
        pass_rate = await self._compute_pass_rate()

        # Automation coverage
        total_cases = await self._test_cases.count_documents({})
        automated_cases = await self._test_cases.count_documents(
            {"automation_status": "automated"}
        )
        automation_coverage = (
            round((automated_cases / total_cases) * 100, 2) if total_cases > 0 else 0.0
        )

        # Compliance rate
        compliance = await self._compute_compliance_status()
        compliance_rate = compliance.get("compliance_rate", 0.0)

        # Integration health
        total_integrations = await self._integrations.count_documents({})
        active_integrations = await self._integrations.count_documents(
            {"status": "active"}
        )
        integration_health = (
            round((active_integrations / total_integrations) * 100, 2)
            if total_integrations > 0
            else 0.0
        )

        score = (
            pass_rate * 0.40
            + automation_coverage * 0.25
            + compliance_rate * 0.20
            + integration_health * 0.15
        )
        return round(min(max(score, 0.0), 100.0), 2)

    async def _get_upcoming_releases(self) -> list[dict]:
        """Return the next 5 releases by target_date."""
        now = datetime.now(tz=timezone.utc)
        cursor = (
            self._releases.find(
                {
                    "target_date": {"$gte": now},
                    "status": {"$ne": "deleted"},
                }
            )
            .sort("target_date", 1)
            .limit(5)
        )
        results: list[dict] = []
        async for doc in cursor:
            results.append(
                {
                    "id": str(doc["_id"]),
                    "name": doc.get("name", ""),
                    "version": doc.get("version", ""),
                    "status": doc.get("status", ""),
                    "target_date": str(doc.get("target_date", "")),
                }
            )
        return results

    async def _compute_compliance_status(self) -> dict:
        """Compute the percentage of governance procedures that are met."""
        cursor = self._governance.find({"status": {"$ne": "deleted"}})
        total = 0
        compliant = 0

        async for doc in cursor:
            total += 1
            required_evidence: list[str] = doc.get("required_evidence", [])
            if not required_evidence:
                compliant += 1
                continue

            evidence_met = 0
            for ev_type in required_evidence:
                count = await self._evidence.count_documents({"type": ev_type})
                if count > 0:
                    evidence_met += 1

            if evidence_met >= len(required_evidence):
                compliant += 1

        compliance_rate = round((compliant / total) * 100, 2) if total > 0 else 0.0

        return {
            "total_procedures": total,
            "compliant": compliant,
            "non_compliant": total - compliant,
            "compliance_rate": compliance_rate,
        }

    async def _compute_trend_data(self) -> list[dict]:
        """Aggregate execution results by day for the last 30 days."""
        now = datetime.now(tz=timezone.utc)
        start = now - timedelta(days=30)

        pipeline: list[dict[str, Any]] = [
            {"$match": {"created_at": {"$gte": start}}},
            {
                "$group": {
                    "_id": {
                        "date": {
                            "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                        },
                    },
                    "total": {"$sum": 1},
                    "passed": {
                        "$sum": {"$cond": [{"$eq": ["$status", "passed"]}, 1, 0]}
                    },
                    "failed": {
                        "$sum": {"$cond": [{"$eq": ["$status", "failed"]}, 1, 0]}
                    },
                },
            },
            {"$sort": {"_id.date": 1}},
        ]

        cursor = self._test_executions.aggregate(pipeline)
        results: list[dict] = []
        async for doc in cursor:
            total = doc.get("total", 0)
            passed = doc.get("passed", 0)
            failed = doc.get("failed", 0)
            pass_rate = round((passed / total) * 100, 2) if total > 0 else 0.0
            results.append(
                {
                    "date": doc["_id"]["date"],
                    "total": total,
                    "passed": passed,
                    "failed": failed,
                    "pass_rate": pass_rate,
                }
            )

        return results
