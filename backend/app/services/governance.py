"""Governance service — procedure management and compliance evaluation."""

import logging
from datetime import datetime, timezone

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError
from app.repositories.governance import GovernanceRepository

logger = logging.getLogger(__name__)


class GovernanceService:
    """Business logic for governance procedures and compliance checks."""

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = GovernanceRepository(db)
        self._evidence = db["evidence"]

    # ── CRUD ─────────────────────────────────────────────────────────────

    async def create_procedure(self, data: dict, user_id: str) -> dict:
        """Create a new governance procedure.

        Parameters
        ----------
        data:
            Procedure fields (``name``, ``description``, ``required_evidence``,
            ``required_approvals``, ``compliance_rule``, ``applicability``, etc.).
        user_id:
            The id of the user creating the procedure.

        Returns
        -------
        dict
            The created procedure document with a string ``id``.
        """
        now = datetime.now(tz=timezone.utc)
        doc = {
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "applicability": data.get("applicability", {}),
            "required_evidence": data.get("required_evidence", []),
            "required_approvals": data.get("required_approvals", []),
            "compliance_rule": data.get("compliance_rule", "AND"),
            "status": data.get("status", "draft"),
            "owner_id": user_id,
            "created_by": user_id,
            "created_at": now,
            "updated_at": now,
            "version": 1,
        }
        return await self._repo.create(doc)

    async def get_procedure(self, id: str) -> dict:
        """Return a single governance procedure by id.

        Raises :class:`~app.exceptions.NotFoundError` when not found.
        """
        procedure = await self._repo.get_by_id(id)
        if procedure is None:
            raise NotFoundError(detail=f"Governance procedure {id} not found")
        return procedure

    async def list_procedures(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """Return a paginated list of governance procedures.

        Returns ``{items, total, page, page_size}``.
        """
        return await self._repo.list(
            filters={"status": {"$ne": "deleted"}},
            page=page,
            page_size=page_size,
        )

    async def update_procedure(self, id: str, data: dict) -> dict:
        """Update an existing governance procedure.

        Raises :class:`~app.exceptions.NotFoundError` when not found.
        """
        existing = await self._repo.get_by_id(id)
        if existing is None:
            raise NotFoundError(detail=f"Governance procedure {id} not found")

        update_fields: dict = {}
        for key in (
            "name",
            "description",
            "applicability",
            "required_evidence",
            "required_approvals",
            "compliance_rule",
            "status",
        ):
            if key in data:
                update_fields[key] = data[key]

        if not update_fields:
            return existing

        updated = await self._repo.update(id, update_fields)
        if updated is None:
            raise NotFoundError(
                detail=f"Governance procedure {id} not found after update"
            )
        return updated

    # ── compliance evaluation ────────────────────────────────────────────

    async def evaluate_compliance(self, procedure_id: str) -> dict:
        """Evaluate compliance for a governance procedure.

        Checks ``required_evidence`` and ``required_approvals`` against
        existing evidence documents and applies the ``compliance_rule``
        (AND / OR logic) to determine overall compliance.

        Returns
        -------
        dict
            ``{procedure_id, procedure_name, compliance_rule,
            evidence_results, approval_results, overall_compliant}``
        """
        procedure = await self._repo.get_by_id(procedure_id)
        if procedure is None:
            raise NotFoundError(
                detail=f"Governance procedure {procedure_id} not found"
            )

        required_evidence: list[str] = procedure.get("required_evidence", [])
        required_approvals: list[str] = procedure.get("required_approvals", [])
        compliance_rule: str = procedure.get("compliance_rule", "AND").upper()

        # ── evidence check ───────────────────────────────────────────────
        evidence_results: list[dict] = []
        for evidence_type in required_evidence:
            count = await self._evidence.count_documents({"type": evidence_type})
            met = count > 0
            evidence_results.append(
                {
                    "type": evidence_type,
                    "required": True,
                    "met": met,
                    "count": count,
                }
            )

        # ── approval check ───────────────────────────────────────────────
        # Approvals are stored as role names; for now we check if at least
        # one user with that role exists in the users collection.
        approval_results: list[dict] = []
        users_coll = self._db["users"]
        for role in required_approvals:
            count = await users_coll.count_documents(
                {"role": role, "status": "active"}
            )
            met = count > 0
            approval_results.append(
                {
                    "role": role,
                    "required": True,
                    "met": met,
                    "available_approvers": count,
                }
            )

        # ── overall compliance ───────────────────────────────────────────
        all_checks: list[bool] = [e["met"] for e in evidence_results] + [
            a["met"] for a in approval_results
        ]

        if not all_checks:
            overall_compliant = True
        elif compliance_rule == "OR":
            overall_compliant = any(all_checks)
        else:
            # Default to AND
            overall_compliant = all(all_checks)

        return {
            "procedure_id": procedure_id,
            "procedure_name": procedure.get("name", ""),
            "compliance_rule": compliance_rule,
            "evidence_results": evidence_results,
            "approval_results": approval_results,
            "overall_compliant": overall_compliant,
        }
