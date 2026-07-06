"""EQIP API — FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import Annotated, Any, AsyncGenerator

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase

from app.config import settings
from app.database import close_client, get_database, init_client
from app.dependencies import CurrentUser, get_db
from app.exceptions import AppException
from app.middleware.audit import AuditMiddleware
from app.routers.adoption import router as adoption_router
from app.routers.ai import router as ai_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.auth import router as auth_router
from app.routers.evidence import router as evidence_router
from app.routers.governance import router as governance_router
from app.routers.health import router as health_router
from app.routers.integrations import router as integrations_router
from app.routers.metrics import router as metrics_router
from app.routers.permissions import router as permissions_router
from app.routers.quality_gates import router as quality_gates_router
from app.routers.releases import router as releases_router
from app.routers.reports import router as reports_router
from app.routers.roles import router as roles_router
from app.routers.test_cases import router as test_cases_router
from app.routers.test_executions import router as test_executions_router
from app.routers.test_suites import router as test_suites_router
from app.routers.users import router as users_router
from app.seed import seed_database
from app.services.dashboard import DashboardService

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle for the EQIP API."""
    # ── startup ──
    init_client()
    db = get_database()

    # Create indexes for core collections
    from pymongo import ASCENDING
    from pymongo.errors import OperationFailure

    async def _ensure_index(collection: str, key: str, **kwargs: object) -> None:
        try:
            await db[collection].create_index(key, **kwargs)
        except OperationFailure as exc:
            if exc.code in (85, 86):
                await db[collection].drop_index(f"{key}_1")
                await db[collection].create_index(key, **kwargs)
            else:
                raise

    await _ensure_index("users", "email", unique=True)
    await _ensure_index("roles", "name", unique=True)
    await _ensure_index("permissions", "name", unique=True)
    await _ensure_index("quality_gates", "name", unique=True)
    await db["test_cases"].create_index([("status", ASCENDING), ("priority", ASCENDING)])
    await db["test_executions"].create_index([("test_case_id", ASCENDING), ("executed_at", ASCENDING)])
    await db["audit_logs"].create_index([("timestamp", ASCENDING)])

    # Seed database if enabled
    if settings.SEED_ON_STARTUP:
        try:
            await seed_database(db)
        except Exception:
            logger.exception("Database seeding failed — continuing startup")

    logger.info("EQIP API started — MongoDB connected")
    yield
    # ── shutdown ──
    await close_client()
    logger.info("EQIP API shut down — MongoDB disconnected")


# ── App ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="EQIP API",
    version="1.0.0",
    description="Enterprise Quality Intelligence Platform API",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Audit middleware ─────────────────────────────────────────────────────
app.add_middleware(AuditMiddleware)

# ── Exception handler ────────────────────────────────────────────────────


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Map AppException subclasses to RFC 7807 problem-detail responses."""
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_response(),
    )


# ── Health router (no /api/v1 prefix — probed at /api/health) ────────────
app.include_router(health_router, prefix="")

# ── Business routers (all under /api/v1) ─────────────────────────────────
_V1_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=_V1_PREFIX)
app.include_router(users_router, prefix=_V1_PREFIX)
app.include_router(roles_router, prefix=_V1_PREFIX)
app.include_router(permissions_router, prefix=_V1_PREFIX)
app.include_router(audit_logs_router, prefix=_V1_PREFIX)
app.include_router(test_cases_router, prefix=_V1_PREFIX)
app.include_router(test_suites_router, prefix=_V1_PREFIX)
app.include_router(test_executions_router, prefix=_V1_PREFIX)
app.include_router(releases_router, prefix=_V1_PREFIX)
app.include_router(quality_gates_router, prefix=_V1_PREFIX)
app.include_router(governance_router, prefix=_V1_PREFIX)
app.include_router(evidence_router, prefix=_V1_PREFIX)
app.include_router(integrations_router, prefix=_V1_PREFIX)
app.include_router(metrics_router, prefix=_V1_PREFIX)
app.include_router(ai_router, prefix=_V1_PREFIX)
app.include_router(reports_router, prefix=_V1_PREFIX)
app.include_router(adoption_router, prefix=_V1_PREFIX)


# ── Dashboard endpoint ───────────────────────────────────────────────────


@app.get(
    f"{_V1_PREFIX}/dashboard",
    response_model=dict,
    tags=["Dashboard"],
    summary="Aggregated dashboard metrics",
    status_code=status.HTTP_200_OK,
)
async def get_dashboard(
    current_user: CurrentUser,
    db: Annotated[AsyncDatabase, Depends(get_db)],
) -> dict[str, Any]:
    """Return aggregated KPI data for the main dashboard view."""
    service = DashboardService(db)
    return await service.get_dashboard_data()
