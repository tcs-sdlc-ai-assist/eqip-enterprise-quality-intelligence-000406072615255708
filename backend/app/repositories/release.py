"""Repository for the ``releases`` MongoDB collection."""

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository


class ReleaseRepository(BaseRepository):
    """CRUD operations for release documents."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "releases")
