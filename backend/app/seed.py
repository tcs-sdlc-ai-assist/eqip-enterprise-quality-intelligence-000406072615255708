"""Idempotent database seeder for EQIP.

Called from the FastAPI lifespan when ``SEED_ON_STARTUP`` is ``True``.
Seeds permissions, roles, a default admin user, and sample quality gates.
Skips entirely when the ``users`` collection already contains documents.
"""

import datetime
import logging
from datetime import timezone

from pymongo.asynchronous.database import AsyncDatabase

from app.utils.security import hash_password

logger = logging.getLogger(__name__)


# ── Permission definitions ──────────────────────────────────────────────────

PERMISSIONS: list[dict[str, str]] = [
    {"name": "users.read", "description": "View user accounts", "category": "users"},
    {"name": "users.write", "description": "Create and update user accounts", "category": "users"},
    {"name": "test_cases.read", "description": "View test cases", "category": "test_cases"},
    {"name": "test_cases.write", "description": "Create and update test cases", "category": "test_cases"},
    {"name": "test_cases.execute", "description": "Execute test cases", "category": "test_cases"},
    {"name": "releases.read", "description": "View releases", "category": "releases"},
    {"name": "releases.manage", "description": "Create, update, and manage releases", "category": "releases"},
    {"name": "governance.read", "description": "View governance procedures", "category": "governance"},
    {"name": "governance.write", "description": "Create and update governance procedures", "category": "governance"},
    {"name": "integrations.read", "description": "View integrations", "category": "integrations"},
    {"name": "integrations.manage", "description": "Configure and manage integrations", "category": "integrations"},
    {"name": "reports.read", "description": "View reports", "category": "reports"},
    {"name": "reports.export", "description": "Export reports", "category": "reports"},
    {"name": "ai.access", "description": "Access AI recommendations", "category": "ai"},
    {"name": "audit.read", "description": "View audit logs", "category": "audit"},
    {"name": "metrics.read", "description": "View metrics and dashboards", "category": "metrics"},
    {"name": "evidence.upload", "description": "Upload evidence artifacts", "category": "evidence"},
    {"name": "evidence.download", "description": "Download evidence artifacts", "category": "evidence"},
    {"name": "admin.full", "description": "Full administrative access", "category": "admin"},
    {"name": "quality_gates.read", "description": "View quality gates", "category": "quality_gates"},
    {"name": "quality_gates.manage", "description": "Create and manage quality gates", "category": "quality_gates"},
]

ALL_PERMISSION_NAMES: list[str] = [p["name"] for p in PERMISSIONS]

# ── Role → permission mapping ──────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": ALL_PERMISSION_NAMES,
    "qa_manager": [
        "test_cases.read", "test_cases.write", "test_cases.execute",
        "releases.read", "releases.manage",
        "governance.read",
        "reports.read", "reports.export",
        "metrics.read",
        "evidence.upload", "evidence.download",
        "quality_gates.read", "quality_gates.manage",
    ],
    "qa_lead": [
        "test_cases.read", "test_cases.write", "test_cases.execute",
        "releases.read",
        "reports.read",
        "metrics.read",
        "evidence.upload", "evidence.download",
        "quality_gates.read",
    ],
    "qa_engineer": [
        "test_cases.read", "test_cases.write", "test_cases.execute",
        "evidence.upload", "evidence.download",
        "reports.read",
    ],
    "developer": [
        "test_cases.read",
        "evidence.upload",
        "reports.read",
    ],
    "release_manager": [
        "releases.read", "releases.manage",
        "governance.read",
        "reports.read", "reports.export",
        "quality_gates.read", "quality_gates.manage",
        "metrics.read",
    ],
    "compliance_officer": [
        "governance.read", "governance.write",
        "audit.read",
        "reports.read", "reports.export",
        "evidence.upload", "evidence.download",
    ],
    "auditor": [
        "audit.read",
        "reports.read",
        "governance.read",
    ],
    "viewer": [
        "users.read",
        "test_cases.read",
        "releases.read",
        "governance.read",
        "integrations.read",
        "reports.read",
        "audit.read",
        "metrics.read",
        "evidence.download",
        "quality_gates.read",
    ],
    "api_consumer": [
        "test_cases.read",
        "releases.read",
        "reports.read",
        "metrics.read",
    ],
}

ROLE_DESCRIPTIONS: dict[str, str] = {
    "admin": "Full platform configuration, user management, system health",
    "qa_manager": "Application/team-scoped quality management, approvals",
    "qa_lead": "Cross-segment quality oversight, approval, governance",
    "qa_engineer": "Test asset CRUD, execution, evidence capture, defect linking",
    "developer": "Code quality, unit test focus, application detail access",
    "release_manager": "Release readiness, quality gate management, deployment approval",
    "compliance_officer": "Governance oversight, compliance scoring, procedure management",
    "auditor": "Read-only access to governance, compliance, audit logs, evidence",
    "viewer": "View-only access to permitted dashboards and reports",
    "api_consumer": "Scoped programmatic access for service accounts",
}

# ── Quality gate definitions ───────────────────────────────────────────────

DEFAULT_QUALITY_GATES: list[dict] = [
    {
        "name": "Test Pass Rate",
        "description": "Minimum percentage of test cases that must pass before release",
        "gate_type": "test_pass_rate",
        "threshold": {"metric": "test_pass_rate", "operator": ">=", "value": 95},
        "applicability": {"tier": "all", "release_type": "all"},
        "status": "active",
    },
    {
        "name": "Code Coverage",
        "description": "Minimum code coverage percentage required for release",
        "gate_type": "code_coverage",
        "threshold": {"metric": "code_coverage", "operator": ">=", "value": 80},
        "applicability": {"tier": "all", "release_type": "all"},
        "status": "active",
    },
    {
        "name": "Critical Defects",
        "description": "No critical defects allowed in release scope",
        "gate_type": "critical_defects",
        "threshold": {"metric": "critical_defects", "operator": "==", "value": 0},
        "applicability": {"tier": "all", "release_type": "all"},
        "status": "active",
    },
]


# ── Seed function ───────────────────────────────────────────────────────────

async def seed_database(db: AsyncDatabase) -> None:
    """Populate the database with initial data if it is empty.

    The function is **idempotent**: it checks whether the ``users``
    collection already contains documents and returns immediately if so.
    Individual entity upserts (``$setOnInsert``) provide an extra safety
    net against partial prior runs.
    """
    now = datetime.datetime.now(tz=timezone.utc)

    # ── Guard: skip if data already exists ──────────────────────────────
    user_count = await db["users"].count_documents({}, limit=1)
    if user_count > 0:
        logger.info("Database already seeded — skipping")
        return

    logger.info("Seeding EQIP database …")

    # ── 1. Permissions ──────────────────────────────────────────────────
    permissions_seeded = 0
    for perm in PERMISSIONS:
        result = await db["permissions"].update_one(
            {"name": perm["name"]},
            {"$setOnInsert": {**perm, "created_at": now}},
            upsert=True,
        )
        if result.upserted_id is not None:
            permissions_seeded += 1
    logger.info("Permissions seeded: %d created, %d already existed", permissions_seeded, len(PERMISSIONS) - permissions_seeded)

    # ── 2. Roles ────────────────────────────────────────────────────────
    roles_seeded = 0
    for role_name, perms in ROLE_PERMISSIONS.items():
        result = await db["roles"].update_one(
            {"name": role_name},
            {
                "$setOnInsert": {
                    "name": role_name,
                    "description": ROLE_DESCRIPTIONS[role_name],
                    "permissions": perms,
                    "is_system": True,
                    "created_at": now,
                    "updated_at": now,
                    "version": 1,
                },
            },
            upsert=True,
        )
        if result.upserted_id is not None:
            roles_seeded += 1
    logger.info("Roles seeded: %d created, %d already existed", roles_seeded, len(ROLE_PERMISSIONS) - roles_seeded)

    # ── 3. Default admin user ───────────────────────────────────────────
    admin_result = await db["users"].update_one(
        {"email": "admin@eqip.dev"},
        {
            "$setOnInsert": {
                "email": "admin@eqip.dev",
                "password_hash": hash_password("Admin123!"),
                "first_name": "System",
                "last_name": "Admin",
                "role": "admin",
                "permissions": ALL_PERMISSION_NAMES,
                "status": "active",
                "last_login": None,
                "created_at": now,
                "updated_at": now,
                "version": 1,
            },
        },
        upsert=True,
    )
    if admin_result.upserted_id is not None:
        logger.info("Default admin user created (admin@eqip.dev)")
        admin_id = admin_result.upserted_id
    else:
        logger.info("Default admin user already exists — skipped")
        admin_doc = await db["users"].find_one({"email": "admin@eqip.dev"})
        admin_id = admin_doc["_id"] if admin_doc else None

    # ── 4. Quality gates ────────────────────────────────────────────────
    gates_seeded = 0
    for gate in DEFAULT_QUALITY_GATES:
        result = await db["quality_gates"].update_one(
            {"name": gate["name"]},
            {
                "$setOnInsert": {
                    **gate,
                    "owner_id": admin_id,
                    "created_by": admin_id,
                    "created_at": now,
                    "updated_at": now,
                    "version": 1,
                },
            },
            upsert=True,
        )
        if result.upserted_id is not None:
            gates_seeded += 1
    logger.info("Quality gates seeded: %d created, %d already existed", gates_seeded, len(DEFAULT_QUALITY_GATES) - gates_seeded)

    logger.info("EQIP database seeding complete")
