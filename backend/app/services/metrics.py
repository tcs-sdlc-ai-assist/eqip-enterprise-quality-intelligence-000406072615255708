"""Metrics service — calculation engine for quality / performance metrics."""

import logging
import re
from datetime import datetime, timezone
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError, ValidationError
from app.repositories.metrics import MetricsRepository

logger = logging.getLogger(__name__)

# Allowed names in formula expressions (simple arithmetic safety)
_SAFE_NAME_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


class MetricsEngine:
    """Evaluates metric formulas and maintains current values / trends."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = MetricsRepository(db)

    # ── public API ───────────────────────────────────────────────────────

    async def get_metrics(self, category: str) -> list[dict]:
        """Return all metrics for *category*."""
        return await self._repo.get_by_category(category)

    async def calculate_metric(self, metric_id: str) -> dict:
        """Evaluate the formula for *metric_id*, update current_value and trend.

        The formula's ``variables`` are resolved from simple DB aggregations
        (counts on the relevant collections).  The ``expression`` is
        evaluated with those variables in scope using only basic arithmetic.

        Returns the updated metric document.
        """
        metric = await self._repo.get_by_id(metric_id)
        if metric is None:
            raise NotFoundError(detail=f"Metric {metric_id} not found")

        formula = metric.get("formula", {})
        expression = formula.get("expression", "0")
        variables = formula.get("variables", [])

        # Resolve variable values from DB aggregations
        var_values = await self._resolve_variables(variables)

        # Evaluate the expression safely
        new_value = self._safe_eval(expression, var_values)

        # Determine trend
        previous_value = metric.get("current_value")
        trend = self._compute_trend(previous_value, new_value)

        now = datetime.now(tz=timezone.utc)
        update_data: dict[str, Any] = {
            "current_value": new_value,
            "trend": trend,
            "last_calculated": now,
        }

        result = await self._repo.update(metric_id, update_data)
        if result is None:
            raise NotFoundError(
                detail=f"Metric {metric_id} not found after calculation"
            )
        logger.info(
            "Metric %s calculated: value=%.4f trend=%s",
            metric_id,
            new_value,
            trend,
        )
        return result

    # ── internal helpers ─────────────────────────────────────────────────

    async def _resolve_variables(self, variables: list[str]) -> dict[str, float]:
        """Map variable names to numeric values from DB aggregations.

        Supported variable names map to collection counts:
        - ``total_tests`` → count of ``test_executions``
        - ``passed_tests`` → count of ``test_executions`` with status=passed
        - ``failed_tests`` → count of ``test_executions`` with status=failed
        - ``total_defects`` → count of ``defects``
        - ``resolved_defects`` → count of ``defects`` with status=resolved
        - ``total_integrations`` → count of ``integrations``
        - ``active_integrations`` → count of ``integrations`` with status=active
        - Any unrecognised variable defaults to ``0.0``.
        """
        mapping: dict[str, float] = {}
        for var in variables:
            mapping[var] = await self._resolve_single(var)
        return mapping

    async def _resolve_single(self, var: str) -> float:
        """Resolve a single variable name to a numeric value."""
        collection_map: dict[str, tuple[str, dict[str, Any] | None]] = {
            "total_tests": ("test_executions", None),
            "passed_tests": ("test_executions", {"status": "passed"}),
            "failed_tests": ("test_executions", {"status": "failed"}),
            "total_defects": ("defects", None),
            "resolved_defects": ("defects", {"status": "resolved"}),
            "total_integrations": ("integrations", None),
            "active_integrations": ("integrations", {"status": "active"}),
        }

        entry = collection_map.get(var)
        if entry is None:
            logger.debug("Unknown metric variable '%s'; defaulting to 0.0", var)
            return 0.0

        coll_name, query = entry
        query = query or {}
        try:
            count = await self._db[coll_name].count_documents(query)
            return float(count)
        except Exception:
            logger.exception("Failed to resolve variable '%s'", var)
            return 0.0

    @staticmethod
    def _safe_eval(expression: str, variables: dict[str, float]) -> float:
        """Evaluate a simple arithmetic expression with the given variables.

        Only allows basic math operators (``+ - * / ( )``) and the
        variable names present in *variables*.  Raises
        :class:`~app.exceptions.ValidationError` on unsafe input.
        """
        # Validate variable names
        for name in variables:
            if not _SAFE_NAME_RE.match(name):
                raise ValidationError(
                    detail=f"Invalid variable name in formula: {name}"
                )

        # Strip the expression to allowed characters + variable names
        allowed_tokens = set("0123456789.+-*/() ")
        sanitised = expression
        for name in sorted(variables, key=len, reverse=True):
            sanitised = sanitised.replace(name, "")
        if not all(ch in allowed_tokens for ch in sanitised):
            raise ValidationError(
                detail=f"Unsafe characters in formula expression: {expression}"
            )

        try:
            result = eval(expression, {"__builtins__": {}}, variables)  # noqa: S307
            return float(result)
        except ZeroDivisionError:
            return 0.0
        except Exception as exc:
            raise ValidationError(
                detail=f"Failed to evaluate formula: {expression}"
            ) from exc

    @staticmethod
    def _compute_trend(
        previous: float | None,
        current: float,
    ) -> str:
        """Return ``'up'``, ``'down'``, or ``'stable'``."""
        if previous is None:
            return "stable"
        if current > previous:
            return "up"
        if current < previous:
            return "down"
        return "stable"
