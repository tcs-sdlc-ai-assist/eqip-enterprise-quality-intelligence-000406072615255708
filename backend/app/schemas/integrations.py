"""Request / response schemas for Integrations, Metrics, and Adoption Impact."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


# ── Integration schemas ──────────────────────────────────────────────────


class ConnectionConfigCreate(BaseModel):
    """Connection config supplied when creating / updating an integration."""

    url: str
    auth_type: str = Field(description="bearer | basic | api_key | oauth2")
    credentials_ref: str = Field(description="Reference to stored credentials (vault key)")


class ConnectionConfigResponse(BaseModel):
    """Connection config returned in responses — credentials_ref is excluded."""

    url: str
    auth_type: str


class CircuitBreakerResponse(BaseModel):
    """Circuit-breaker state returned in responses."""

    state: str = Field(description="closed | open | half_open")
    failure_count: int
    threshold: int
    reset_timeout: int


class RetryRulesResponse(BaseModel):
    """Retry rules returned in responses."""

    max_retries: int
    backoff_strategy: str
    initial_delay: int


class IntegrationCreate(BaseModel):
    """Payload for creating a new integration."""

    name: str
    system_type: str = Field(
        description="jira | azure_devops | jenkins | github | gitlab | sonarqube | selenium | custom",
    )
    connection_config: ConnectionConfigCreate
    sync_frequency: str = Field(
        default="daily",
        description="manual | hourly | daily | weekly",
    )


class IntegrationUpdate(BaseModel):
    """Payload for updating an existing integration (all fields optional except version)."""

    name: Optional[str] = None
    connection_config: Optional[ConnectionConfigCreate] = None
    sync_frequency: Optional[str] = Field(
        default=None,
        description="manual | hourly | daily | weekly",
    )
    status: Optional[str] = Field(
        default=None,
        description="IntegrationStatus: active | inactive | error",
    )
    version: int = Field(
        ge=1,
        description="Optimistic-lock version — must match the current document version",
    )


class IntegrationResponse(MongoModel):
    """Public representation of an integration — credentials_ref is stripped."""

    name: str
    system_type: str
    connection_config: ConnectionConfigResponse
    sync_frequency: str
    status: str
    last_sync: Optional[datetime] = None
    error_count: int
    last_error: Optional[str] = None
    circuit_breaker: CircuitBreakerResponse
    retry_rules: RetryRulesResponse
    owner_id: PyObjectId
    created_at: datetime
    updated_at: datetime
    version: int


# ── Metrics schemas ──────────────────────────────────────────────────────


class MetricsResponse(MongoModel):
    """Public representation of a metric for dashboard / list views."""

    name: str
    category: str
    description: str
    current_value: Optional[float] = None
    target_value: Optional[float] = None
    trend: Optional[str] = None
    unit: str


# ── Adoption Impact schemas ─────────────────────────────────────────────


class AdoptionImpactResponse(MongoModel):
    """Public representation of an adoption impact snapshot."""

    metric_name: str
    category: str
    current_value: float
    previous_value: float
    change_percentage: float
    trend: str
    period: str
    details: dict[str, object]
    created_at: datetime
