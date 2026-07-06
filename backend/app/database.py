"""MongoDB async client singleton using PyMongo async (AsyncMongoClient).

The client is created inside the FastAPI lifespan — not at module import —
so it binds to the running event loop.  Call ``init_client()`` at startup
and ``close_client()`` at shutdown.
"""

import logging

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.config import settings

logger = logging.getLogger(__name__)

# ── Module-level holder (populated by init_client) ───────────────────────
_client: AsyncMongoClient | None = None


def init_client() -> None:
    """Create the singleton PyMongo async client.  Call once from the lifespan."""
    global _client  # noqa: PLW0603
    if _client is not None:
        logger.warning("PyMongo async client already initialised — skipping")
        return
    _client = AsyncMongoClient(settings.MONGODB_URI)
    logger.info("MongoDB client connected to %s", settings.MONGODB_URI.split("@")[-1])


def get_client() -> AsyncMongoClient:
    """Return the initialised PyMongo async client; raises if not yet started."""
    if _client is None:
        raise RuntimeError(
            "MongoDB client is not initialised. "
            "Ensure init_client() is called in the application lifespan."
        )
    return _client


def get_database() -> AsyncDatabase:
    """Return the application database handle."""
    return get_client().get_database(settings.MONGODB_DB_NAME)


async def close_client() -> None:
    """Close the PyMongo async client and release the connection pool."""
    global _client  # noqa: PLW0603
    if _client is not None:
        await _client.close()
        _client = None
        logger.info("MongoDB client closed")
