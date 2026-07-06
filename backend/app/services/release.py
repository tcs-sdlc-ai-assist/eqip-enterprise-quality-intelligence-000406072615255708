"""Release service — readiness scoring and quality-gate evaluation."""

import logging
from typing import Any

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError
from app.repositories.release import ReleaseRepository

logger = logging.getLogger(__name__)


class ReleaseService:
    """Business logic for releases, readiness scoring, and gate results."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = ReleaseRepository(db)
        self._test_executions = db["test_executions"]
        self._quality_gates = db["quality_gates"]

    # ── readiness ────────────────────────────────────────────────────────

    async def get_readiness(self, release_id: str) -> dict:
        """Compute a readiness report for a release.

        Returns a dict with:
        - ``release_id``, ``release_name``
        - ``overall_readiness_score`` (0–100)
        - ``test_completion`` (percentage of passed tests)
        - ``automation_execution`` (percentage of automated tests run)
        - ``open_critical_defects`` count
        - ``quality_gate_results`` list
        - ``recommendation`` string
        """
        release = await self._repo.get_by_id(release_id)
        if release is None:
            raise NotFoundError(detail=f"Release {release_id} not found")

        oid = ObjectId(release_id)

        # ── test completion ──────────────────────────────────────────────
        executions_cursor = self._test_executions.find({"release_id": oid})
        executions: list[dict] = [doc async for doc in executions_cursor]

        total_cases = 0
        passed_cases = 0
        automated_run = 0
        total_automated = 0

        for exe in executions:
            total_cases += exe.get("total_cases", 0)
            passed_cases += exe.get("passed", 0)

            # Count automated test executions from results list
            for result in exe.get("results", []):
                status = result.get("automation_status", "manual")
                if status in ("automated", "hybrid"):
                    total_automated += 1
                    if result.get("status") in ("passed", "failed", "error"):
                        automated_run += 1

        test_completion = (
            round((passed_cases / total_cases) * 100, 1) if total_cases > 0 else 0.0
        )
        automation_execution = (
            round((automated_run / total_automated) * 100, 1)
            if total_automated > 0
            else 0.0
        )

        # ── open critical defects (status != closed/resolved in results) ─
        open_critical_defects = 0
        for exe in executions:
            for result in exe.get("results", []):
                if (
                    result.get("status") == "failed"
                    and result.get("priority", "medium") == "critical"
                ):
                    open_critical_defects += 1

        # ── quality gate results ─────────────────────────────────────────
        gate_results = await self._evaluate_gates_for_release(
            release_id,
            test_completion=test_completion,
            automation_execution=automation_execution,
            open_critical_defects=open_critical_defects,
        )

        # ── overall score ────────────────────────────────────────────────
        overall_readiness_score = self._compute_overall_score(
            test_completion=test_completion,
            automation_execution=automation_execution,
            open_critical_defects=open_critical_defects,
            gate_results=gate_results,
        )

        # ── recommendation ───────────────────────────────────────────────
        recommendation = self._derive_recommendation(
            overall_readiness_score, gate_results, open_critical_defects
        )

        return {
            "release_id": release_id,
            "release_name": release.get("name", ""),
            "overall_readiness_score": overall_readiness_score,
            "test_completion": test_completion,
            "automation_execution": automation_execution,
            "open_critical_defects": open_critical_defects,
            "quality_gate_results": gate_results,
            "recommendation": recommendation,
        }

    # ── gate results ─────────────────────────────────────────────────────

    async def get_gate_results(self, release_id: str) -> dict:
        """Return quality gates and their evaluation results for a release."""
        release = await self._repo.get_by_id(release_id)
        if release is None:
            raise NotFoundError(detail=f"Release {release_id} not found")

        readiness = await self.get_readiness(release_id)

        return {
            "release_id": release_id,
            "release_name": release.get("name", ""),
            "quality_gate_results": readiness["quality_gate_results"],
        }

    async def update_gate_results(self, release_id: str, data: dict) -> dict:
        """Update gate results (pass/fail/waived) for a release.

        ``data`` should contain a ``gate_results`` list of dicts, each with
        ``gate_id`` and ``result`` (pass / fail / waived).
        """
        release = await self._repo.get_by_id(release_id)
        if release is None:
            raise NotFoundError(detail=f"Release {release_id} not found")

        gate_results: list[dict] = data.get("gate_results", [])
        validated_results: list[dict] = []

        for entry in gate_results:
            gate_id = entry.get("gate_id", "")
            result = entry.get("result", "fail")
            if result not in ("pass", "fail", "waived", "warning", "not_applicable"):
                result = "fail"
            validated_results.append(
                {
                    "gate_id": gate_id,
                    "result": result,
                    "details": entry.get("details", ""),
                }
            )

        update_payload: dict[str, Any] = {"gate_results": validated_results}
        updated = await self._repo.update(release_id, update_payload)
        if updated is None:
            raise NotFoundError(detail=f"Release {release_id} not found after update")

        return {
            "release_id": release_id,
            "release_name": updated.get("name", ""),
            "gate_results": validated_results,
        }

    # ── private helpers ──────────────────────────────────────────────────

    async def _evaluate_gates_for_release(
        self,
        release_id: str,
        *,
        test_completion: float,
        automation_execution: float,
        open_critical_defects: int,
    ) -> list[dict]:
        """Evaluate all active quality gates against release data."""
        cursor = self._quality_gates.find({"status": "active"})
        gates: list[dict] = [doc async for doc in cursor]

        release_data: dict[str, Any] = {
            "test_completion": test_completion,
            "automation_execution": automation_execution,
            "open_critical_defects": open_critical_defects,
        }

        results: list[dict] = []
        for gate in gates:
            result = self._evaluate_single_gate(gate, release_data)
            results.append(result)

        return results

    @staticmethod
    def _evaluate_single_gate(gate: dict, release_data: dict) -> dict:
        """Evaluate a single quality gate threshold against release data."""
        gate_id = str(gate.get("_id", gate.get("id", "")))
        name = gate.get("name", "")
        threshold = gate.get("threshold", {})

        metric = threshold.get("metric", "")
        operator = threshold.get("operator", ">=")
        value = threshold.get("value", 0)

        actual = release_data.get(metric)
        if actual is None:
            return {
                "gate_id": gate_id,
                "name": name,
                "result": "not_applicable",
                "details": f"Metric '{metric}' not available",
            }

        try:
            actual_num = float(actual)
            threshold_num = float(value)
        except (TypeError, ValueError):
            return {
                "gate_id": gate_id,
                "name": name,
                "result": "not_applicable",
                "details": f"Cannot compare metric '{metric}' value",
            }

        passed = _compare(actual_num, operator, threshold_num)

        return {
            "gate_id": gate_id,
            "name": name,
            "result": "pass" if passed else "fail",
            "details": (
                f"{metric}: {actual_num} {operator} {threshold_num} "
                f"→ {'pass' if passed else 'fail'}"
            ),
        }

    @staticmethod
    def _compute_overall_score(
        *,
        test_completion: float,
        automation_execution: float,
        open_critical_defects: int,
        gate_results: list[dict],
    ) -> float:
        """Derive a 0–100 readiness score from the component metrics."""
        # Weighted formula:
        #   40% test completion + 20% automation + 20% defect penalty + 20% gates
        defect_score = max(0.0, 100.0 - open_critical_defects * 25.0)

        if gate_results:
            passed_gates = sum(
                1 for g in gate_results if g.get("result") in ("pass", "waived")
            )
            gate_score = (passed_gates / len(gate_results)) * 100.0
        else:
            gate_score = 100.0

        score = (
            test_completion * 0.4
            + automation_execution * 0.2
            + defect_score * 0.2
            + gate_score * 0.2
        )
        return round(min(max(score, 0.0), 100.0), 1)

    @staticmethod
    def _derive_recommendation(
        score: float,
        gate_results: list[dict],
        open_critical_defects: int,
    ) -> str:
        """Return a human-readable recommendation string."""
        failed_gates = [g for g in gate_results if g.get("result") == "fail"]

        if open_critical_defects > 0:
            return (
                f"Not ready — {open_critical_defects} open critical defect(s) "
                "must be resolved before release."
            )

        if failed_gates:
            names = ", ".join(g.get("name", "unknown") for g in failed_gates)
            return f"Not ready — the following quality gates failed: {names}."

        if score >= 80.0:
            return "Ready for release."
        if score >= 60.0:
            return "Conditionally ready — review remaining gaps before release."
        return "Not ready — significant gaps remain."


# ── module-level helpers ─────────────────────────────────────────────────


def _compare(actual: float, operator: str, threshold: float) -> bool:
    """Evaluate *actual* against *threshold* using *operator*."""
    ops: dict[str, Any] = {
        ">=": actual >= threshold,
        ">": actual > threshold,
        "<=": actual <= threshold,
        "<": actual < threshold,
        "==": actual == threshold,
        "!=": actual != threshold,
    }
    return bool(ops.get(operator, actual >= threshold))
