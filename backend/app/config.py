"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """EQIP API settings — reads flat UPPER_SNAKE env vars and .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── MongoDB ──────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "eqip"

    # ── JWT / Auth ───────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080

    # ── CORS ─────────────────────────────────────────────────────────────
    # Stored as a comma-separated string; pydantic-settings would
    # JSON-parse a list-typed field and crash on a plain CSV value.
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        """Split the comma-separated ALLOWED_ORIGINS into a list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # ── Application ──────────────────────────────────────────────────────
    APP_NAME: str = "EQIP API"
    DEBUG: bool = True
    SEED_ON_STARTUP: bool = True


settings = Settings()
