"""Integration document model — external system connections (Jira, GitHub, etc.)."""

from datetime import datetime
from typing import Optional

from pydantic import Field

from app.models.base import MongoModel, PyObjectId, utcnow


class CircuitBreakerConfig(MongoModel):
    """Embedded circuit-breaker state for an integration."""

    state: str = Field(default="closed", description="closed | open | half_open")
    failure_count: int = Field(default=0, ge=0)
    threshold: int = Field(default=5, ge=1)
    reset_timeout: int = Field(default=60, ge=1, description="Seconds before half-open retry")


class RetryRulesConfig(MongoModel):
    """Embedded retry policy for an integration."""

    max_retries: int = Field(default=3, ge=0)
    backoff_strategy: str = Field(default="exponential", description="linear | exponential | fixed")
    initial_delay: int = Field(default=1, ge=0, description="Initial delay in seconds")


class ConnectionConfig(MongoModel):
    """Embedded connection configuration for an integration."""

    url: str
    auth_type: str = Field(description="bearer | basic | api_key | oauth2")
    credentials_ref: str = Field(description="Reference to stored credentials (vault key)")


class IntegrationDocument(MongoModel):
    """Represents an external system integration in MongoDB."""

    name: str
    system_type: str = Field(
        description="jira | azure_devops | jenkins | github | gitlab | sonarqube | selenium | custom",
    )
    connection_config: ConnectionConfig
    sync_frequency: str = Field(
        default="daily",
        description="manual | hourly | daily | weekly",
    )
    status: str = Field(
        default="inactive",
        description="IntegrationStatus: active | inactive | error",
    )
    last_sync: Optional[datetime] = None
    error_count: int = Field(default=0, ge=0)
    last_error: Optional[str] = None
    circuit_breaker: CircuitBreakerConfig = Field(default_factory=CircuitBreakerConfig)
    retry_rules: RetryRulesConfig = Field(default_factory=RetryRulesConfig)
    owner_id: PyObjectId
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    version: int = Field(default=1, ge=1)
