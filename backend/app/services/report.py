"""Report service — generation and export of EQIP reports."""

import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import ValidationError
from app.repositories.report import ReportRepository

logger = logging.getLogger(__name__)

# Supported report types and their metadata
_REPORT_META: dict[str, dict[str, str]] = {
    "quality_summary": {
        "name": "Quality Summary Report",
        "description": "Aggregate test execution pass/fail rates and coverage statistics.",
    },
    "test_coverage": {
        "name": "Test Coverage Report",
        "description": "Test cases aggregated by status, automation status, and application.",
    },
    "release_readiness": {
        "name": "Release Readiness Report",
        "description": "Release data with quality-gate evaluation results.",
    },
    "compliance": {
        "name": "Compliance Report",
        "description": "Governance procedure compliance status overview.",
    },
    "trend_analysis": {
        "name": "Trend Analysis Report",
        "description": "Metrics aggregated over time periods for trend analysis.",
    },
}

_VALID_EXPORT_FORMATS = {"json", "csv"}


class ReportService:
    """Orchestrates report generation and export for EQIP."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = ReportRepository(db)
        self._test_executions = db["test_executions"]
        self._test_cases = db["test_cases"]
        self._releases = db["releases"]

    # ── public API ───────────────────────────────────────────────────────

    async def get_report(
        self,
        report_type: str,
        filters: dict | None = None,
    ) -> dict:
        """Generate a report based on *report_type*.

        Parameters
        ----------
        report_type:
            One of ``quality_summary``, ``test_coverage``,
            ``release_readiness``, ``compliance``, ``trend_analysis``.
        filters:
            Optional query filters forwarded to the aggregation.

        Returns
        -------
        dict
            ``{id, name, type, description, data, generated_at}``
        """
        meta = _REPORT_META.get(report_type)
        if meta is None:
            raise ValidationError(
                detail=(
                    f"Unknown report type '{report_type}'. "
                    f"Valid types: {', '.join(sorted(_REPORT_META))}"
                ),
            )

        generator = _GENERATORS.get(report_type)
        if generator is None:
            raise ValidationError(detail=f"No generator for report type '{report_type}'")

        data: dict = await generator(self, filters or {})

        now = datetime.now(tz=timezone.utc)
        report_id = str(ObjectId())

        return {
            "id": report_id,
            "name": meta["name"],
            "type": report_type,
            "description": meta["description"],
            "data": data,
            "generated_at": now.isoformat(),
        }

    async def export_report(
        self,
        report_type: str,
        format: str,
    ) -> dict:
        """Generate a report and serialise it for download.

        Parameters
        ----------
        report_type:
            Same as :meth:`get_report`.
        format:
            ``json`` or ``csv``.

        Returns
        -------
        dict
            ``{content, content_type, filename}``
        """
        fmt = format.lower()
        if fmt not in _VALID_EXPORT_FORMATS:
            raise ValidationError(
                detail=(
                    f"Unsupported export format '{format}'. "
                    f"Valid formats: {', '.join(sorted(_VALID_EXPORT_FORMATS))}"
                ),
            )

        report = await self.get_report(report_type)
        now_str = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
        base_name = f"eqip_{report_type}_{now_str}"

        if fmt == "json":
            content = json.dumps(report, indent=2, default=str)
            return {
                "content": content,
                "content_type": "application/json",
                "filename": f"{base_name}.json",
            }

        # CSV — flatten the details list
        details: list[dict] = report.get("data", {}).get("details", [])
        if not details:
            details = [report.get("data", {}).get("summary", {})]

        buf = io.StringIO()
        if details:
            writer = csv.DictWriter(buf, fieldnames=list(details[0].keys()))
            writer.writeheader()
            writer.writerows(details)

        return {
            "content": buf.getvalue(),
            "content_type": "text/csv",
            "filename": f"{base_name}.csv",
        }

    # ── private generators ───────────────────────────────────────────────

    async def _quality_summary(self, filters: dict) -> dict:
        """Aggregate test execution pass/fail rates and coverage stats."""
        match_stage: dict[str, Any] = {}
        if filters.get("application_id"):
            match_stage["application_id"] = filters["application_id"]

        pipeline: list[dict[str, Any]] = []
        if match_stage:
            pipeline.append({"$match": match_stage})

        pipeline.append(
            {
                "$group": {
                    "_id": "$status",
                    "count": {"$sum": 1},
                },
            }
        )

        cursor = self._test_executions.aggregate(pipeline)
        status_counts: dict[str, int] = {}
        async for doc in cursor:
            status_counts[doc["_id"] or "unknown"] = doc["count"]

        total = sum(status_counts.values())
        passed = status_counts.get("passed", 0)
        failed = status_counts.get("failed", 0)
        pass_rate = round((passed / total) * 100, 2) if total > 0 else 0.0
        fail_rate = round((failed / total) * 100, 2) if total > 0 else 0.0

        # Coverage from test_cases
        total_cases = await self._test_cases.count_documents({})
        automated_cases = await self._test_cases.count_documents(
            {"automation_status": "automated"}
        )
        automation_coverage = (
            round((automated_cases / total_cases) * 100, 2) if total_cases > 0 else 0.0
        )

        summary: dict[str, Any] = {
            "total_executions": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": pass_rate,
            "fail_rate": fail_rate,
            "total_test_cases": total_cases,
            "automated_test_cases": automated_cases,
            "automation_coverage": automation_coverage,
        }

        details: list[dict[str, Any]] = [
            {"status": status, "count": count}
            for status, count in sorted(status_counts.items())
        ]

        charts_data: dict[str, Any] = {
            "pass_fail_pie": {"passed": passed, "failed": failed, "other": total - passed - failed},
            "automation_bar": {"automated": automated_cases, "manual": total_cases - automated_cases},
        }

        return {"summary": summary, "details": details, "charts_data": charts_data}

    async def _test_coverage(self, filters: dict) -> dict:
        """Aggregate test cases by status, automation_status, and application."""
        match_stage: dict[str, Any] = {}
        if filters.get("application_id"):
            match_stage["application_id"] = filters["application_id"]

        # By status
        status_pipeline: list[dict[str, Any]] = []
        if match_stage:
            status_pipeline.append({"$match": match_stage})
        status_pipeline.append({"$group": {"_id": "$status", "count": {"$sum": 1}}})

        cursor = self._test_cases.aggregate(status_pipeline)
        by_status: dict[str, int] = {}
        async for doc in cursor:
            by_status[doc["_id"] or "unknown"] = doc["count"]

        # By automation_status
        auto_pipeline: list[dict[str, Any]] = []
        if match_stage:
            auto_pipeline.append({"$match": match_stage})
        auto_pipeline.append({"$group": {"_id": "$automation_status", "count": {"$sum": 1}}})

        cursor = self._test_cases.aggregate(auto_pipeline)
        by_automation: dict[str, int] = {}
        async for doc in cursor:
            by_automation[doc["_id"] or "unknown"] = doc["count"]

        # By application
        app_pipeline: list[dict[str, Any]] = []
        if match_stage:
            app_pipeline.append({"$match": match_stage})
        app_pipeline.append({"$group": {"_id": "$application_id", "count": {"$sum": 1}}})

        cursor = self._test_cases.aggregate(app_pipeline)
        by_application: dict[str, int] = {}
        async for doc in cursor:
            app_key = str(doc["_id"]) if doc["_id"] else "unassigned"
            by_application[app_key] = doc["count"]

        total_cases = sum(by_status.values())
        automated = by_automation.get("automated", 0)
        coverage_pct = round((automated / total_cases) * 100, 2) if total_cases > 0 else 0.0

        summary: dict[str, Any] = {
            "total_test_cases": total_cases,
            "coverage_percentage": coverage_pct,
            "by_status": by_status,
            "by_automation_status": by_automation,
        }

        details: list[dict[str, Any]] = [
            {"application_id": app_id, "test_case_count": count}
            for app_id, count in sorted(by_application.items())
        ]

        charts_data: dict[str, Any] = {
            "status_distribution": by_status,
            "automation_distribution": by_automation,
            "application_distribution": by_application,
        }

        return {"summary": summary, "details": details, "charts_data": charts_data}

    async def _release_readiness(self, filters: dict) -> dict:
        """Aggregate release data with gate results."""
        match_stage: dict[str, Any] = {"status": {"$ne": "deleted"}}
        if filters.get("status"):
            match_stage["status"] = filters["status"]

        cursor = self._releases.find(match_stage).sort("target_date", -1).limit(20)
        releases: list[dict[str, Any]] = []
        async for doc in cursor:
            release_id = str(doc["_id"])
            gate_results: list[dict] = doc.get("gate_results", [])
            total_gates = len(gate_results)
            passed_gates = sum(
                1 for g in gate_results if g.get("result") in ("pass", "waived")
            )
            gate_pass_rate = (
                round((passed_gates / total_gates) * 100, 2) if total_gates > 0 else 0.0
            )

            releases.append(
                {
                    "release_id": release_id,
                    "name": doc.get("name", ""),
                    "version": doc.get("version", ""),
                    "status": doc.get("status", ""),
                    "target_date": str(doc.get("target_date", "")),
                    "total_gates": total_gates,
                    "passed_gates": passed_gates,
                    "gate_pass_rate": gate_pass_rate,
                }
            )

        total_releases = len(releases)
        ready_count = sum(1 for r in releases if r["gate_pass_rate"] == 100.0)

        summary: dict[str, Any] = {
            "total_releases": total_releases,
            "ready_releases": ready_count,
            "not_ready_releases": total_releases - ready_count,
        }

        charts_data: dict[str, Any] = {
            "readiness_pie": {"ready": ready_count, "not_ready": total_releases - ready_count},
        }

        return {"summary": summary, "details": releases, "charts_data": charts_data}

    async def _compliance(self, filters: dict) -> dict:
        """Aggregate governance procedure compliance status."""
        governance = self._db["governance"]
        evidence = self._db["evidence"]

        match_stage: dict[str, Any] = {"status": {"$ne": "deleted"}}
        cursor = governance.find(match_stage)

        procedures: list[dict[str, Any]] = []
        compliant_count = 0
        total_count = 0

        async for doc in cursor:
            total_count += 1
            proc_id = str(doc["_id"])
            required_evidence: list[str] = doc.get("required_evidence", [])

            evidence_met = 0
            for ev_type in required_evidence:
                count = await evidence.count_documents({"type": ev_type})
                if count > 0:
                    evidence_met += 1

            total_required = len(required_evidence)
            is_compliant = evidence_met >= total_required if total_required > 0 else True
            if is_compliant:
                compliant_count += 1

            procedures.append(
                {
                    "procedure_id": proc_id,
                    "name": doc.get("name", ""),
                    "status": doc.get("status", ""),
                    "required_evidence_count": total_required,
                    "evidence_met": evidence_met,
                    "compliant": is_compliant,
                }
            )

        compliance_rate = (
            round((compliant_count / total_count) * 100, 2) if total_count > 0 else 0.0
        )

        summary: dict[str, Any] = {
            "total_procedures": total_count,
            "compliant": compliant_count,
            "non_compliant": total_count - compliant_count,
            "compliance_rate": compliance_rate,
        }

        charts_data: dict[str, Any] = {
            "compliance_pie": {
                "compliant": compliant_count,
                "non_compliant": total_count - compliant_count,
            },
        }

        return {"summary": summary, "details": procedures, "charts_data": charts_data}

    async def _trend_analysis(self, filters: dict) -> dict:
        """Aggregate metrics over time periods (last 30 days by day)."""
        from datetime import timedelta

        days = int(filters.get("days", 30))
        now = datetime.now(tz=timezone.utc)
        start = now - timedelta(days=days)

        pipeline: list[dict[str, Any]] = [
            {"$match": {"created_at": {"$gte": start}}},
            {
                "$group": {
                    "_id": {
                        "date": {
                            "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                        },
                        "status": "$status",
                    },
                    "count": {"$sum": 1},
                },
            },
            {"$sort": {"_id.date": 1}},
        ]

        cursor = self._test_executions.aggregate(pipeline)
        daily_data: dict[str, dict[str, int]] = {}
        async for doc in cursor:
            date_str = doc["_id"]["date"]
            status = doc["_id"]["status"] or "unknown"
            daily_data.setdefault(date_str, {})
            daily_data[date_str][status] = doc["count"]

        details: list[dict[str, Any]] = []
        for date_str in sorted(daily_data):
            entry = {"date": date_str, **daily_data[date_str]}
            total = sum(daily_data[date_str].values())
            passed = daily_data[date_str].get("passed", 0)
            entry["total"] = total
            entry["pass_rate"] = round((passed / total) * 100, 2) if total > 0 else 0.0
            details.append(entry)

        total_executions = sum(d.get("total", 0) for d in details)
        total_passed = sum(d.get("passed", 0) for d in details)
        overall_pass_rate = (
            round((total_passed / total_executions) * 100, 2)
            if total_executions > 0
            else 0.0
        )

        summary: dict[str, Any] = {
            "period_days": days,
            "total_executions": total_executions,
            "overall_pass_rate": overall_pass_rate,
            "data_points": len(details),
        }

        charts_data: dict[str, Any] = {
            "trend_line": [
                {"date": d["date"], "pass_rate": d["pass_rate"]} for d in details
            ],
            "volume_bar": [
                {"date": d["date"], "total": d["total"]} for d in details
            ],
        }

        return {"summary": summary, "details": details, "charts_data": charts_data}


# ── generator dispatch table ────────────────────────────────────────────

_GENERATORS: dict[str, Any] = {
    "quality_summary": ReportService._quality_summary,
    "test_coverage": ReportService._test_coverage,
    "release_readiness": ReportService._release_readiness,
    "compliance": ReportService._compliance,
    "trend_analysis": ReportService._trend_analysis,
}
