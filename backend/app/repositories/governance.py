"""Repository for the ``governance_procedures`` MongoDB collection."""

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository


class GovernanceRepository(BaseRepository):
    """CRUD operations for governance procedure documents."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "governance_procedures")
