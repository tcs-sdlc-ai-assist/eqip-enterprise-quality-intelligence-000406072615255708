"""Report repository — CRUD for the ``reports`` collection."""

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository


class ReportRepository(BaseRepository):
    """Data-access layer for generated reports and exports."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "reports")
