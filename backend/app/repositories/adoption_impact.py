"""Adoption impact repository — CRUD for the ``adoption_impact`` collection."""

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository


class AdoptionImpactRepository(BaseRepository):
    """Data-access layer for adoption / impact measurement snapshots."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "adoption_impact")
