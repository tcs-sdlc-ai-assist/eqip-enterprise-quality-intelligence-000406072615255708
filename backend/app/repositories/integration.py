"""Integration repository — CRUD for the ``integrations`` collection."""

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository


class IntegrationRepository(BaseRepository):
    """Data-access layer for external-system integrations."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "integrations")
