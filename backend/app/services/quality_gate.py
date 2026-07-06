"""Quality gate service — listing and threshold evaluation."""

import logging
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError
from app.repositories.quality_gate import QualityGateRepository

logger = logging.getLogger(__name__)


class QualityGateService:
    """Business logic for quality gate definitions and evaluation."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = QualityGateRepository(db)

    async def list_gates(self) -> list[dict]:
        """Return all active quality gate definitions."""
        result = await self._repo.list(
            filters={"status": {"$ne": "deleted"}},
            page=1,
            page_size=100,
        )
        return result.get("items", [])

    async def evaluate_gate(self, gate_id: str, release_data: dict) -> dict:
        """Evaluate a single quality gate against *release_data*.

        Parameters
        ----------
        gate_id:
            The quality gate document id.
        release_data:
            A dict containing metric values, e.g.
            ``{"test_completion": 85.0, "open_critical_defects": 0}``.

        Returns
        -------
        dict
            ``{gate_id, name, result, details}`` where *result* is one of
            ``pass``, ``warning``, ``fail``, ``waived``, ``not_applicable``.
        """
        gate = await self._repo.get_by_id(gate_id)
        if gate is None:
            raise NotFoundError(detail=f"Quality gate {gate_id} not found")

        threshold = gate.get("threshold", {})
        metric = threshold.get("metric", "")
        operator = threshold.get("operator", ">=")
        value = threshold.get("value", 0)

        actual = release_data.get(metric)
        if actual is None:
            return {
                "gate_id": gate_id,
                "name": gate.get("name", ""),
                "result": "not_applicable",
                "details": f"Metric '{metric}' not available in release data",
            }

        try:
            actual_num = float(actual)
            threshold_num = float(value)
        except (TypeError, ValueError):
            return {
                "gate_id": gate_id,
                "name": gate.get("name", ""),
                "result": "not_applicable",
                "details": f"Cannot compare metric '{metric}' value",
            }

        passed = _compare(actual_num, operator, threshold_num)

        # Determine warning band: within 10% of threshold counts as warning
        warning = False
        if not passed and operator in (">=", ">"):
            warning = actual_num >= threshold_num * 0.9
        elif not passed and operator in ("<=", "<"):
            warning = actual_num <= threshold_num * 1.1

        if passed:
            result = "pass"
        elif warning:
            result = "warning"
        else:
            result = "fail"

        return {
            "gate_id": gate_id,
            "name": gate.get("name", ""),
            "result": result,
            "details": (
                f"{metric}: {actual_num} {operator} {threshold_num} "
                f"→ {result}"
            ),
        }


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
