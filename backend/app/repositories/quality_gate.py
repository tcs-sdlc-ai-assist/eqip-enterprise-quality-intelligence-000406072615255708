"""Repository for the ``quality_gates`` MongoDB collection."""

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository


class QualityGateRepository(BaseRepository):
    """CRUD operations for quality gate documents."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "quality_gates")
