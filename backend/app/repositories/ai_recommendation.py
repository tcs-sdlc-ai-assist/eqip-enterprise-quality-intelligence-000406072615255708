"""AI recommendation repository — CRUD for the ``ai_recommendations`` collection."""

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository


class AIRecommendationRepository(BaseRepository):
    """Data-access layer for AI-generated recommendations and answers."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "ai_recommendations")
