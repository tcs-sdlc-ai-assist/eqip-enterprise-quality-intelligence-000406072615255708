"""Repository for the ``test_suites`` MongoDB collection."""

import logging

from pymongo.asynchronous.database import AsyncDatabase

from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class TestSuiteRepository(BaseRepository):
    """Data-access layer for test suite documents."""

    def __init__(self, db: AsyncDatabase) -> None:
        super().__init__(db, "test_suites")
