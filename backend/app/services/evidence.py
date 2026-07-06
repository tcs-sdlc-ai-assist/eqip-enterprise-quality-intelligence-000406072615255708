"""Evidence service — upload, retrieval, and download metadata."""

import logging
from datetime import datetime, timezone

from pymongo.asynchronous.database import AsyncDatabase

from app.exceptions import NotFoundError
from app.repositories.evidence import EvidenceRepository

logger = logging.getLogger(__name__)


class EvidenceService:
    """Business logic for evidence artifact management.

    Evidence *files* are stored externally; this service manages the
    metadata documents in MongoDB.
    """

    def __init__(self, db: AsyncDatabase) -> None:
        self._db = db
        self._repo = EvidenceRepository(db)

    async def upload_evidence(self, data: dict) -> dict:
        """Store evidence metadata in MongoDB.

        Parameters
        ----------
        data:
            Evidence fields — ``test_execution_id``, ``type``, ``filename``,
            ``file_size``, ``mime_type``, ``storage_path``, ``uploaded_by``,
            and optionally ``test_case_id`` and ``description``.

        Returns
        -------
        dict
            The created evidence document with a string ``id``.
        """
        now = datetime.now(tz=timezone.utc)
        doc = {
            "test_execution_id": data.get("test_execution_id", ""),
            "test_case_id": data.get("test_case_id"),
            "type": data.get("type", "document"),
            "filename": data.get("filename", ""),
            "file_size": data.get("file_size", 0),
            "mime_type": data.get("mime_type", "application/octet-stream"),
            "storage_path": data.get("storage_path", ""),
            "uploaded_by": data.get("uploaded_by", ""),
            "description": data.get("description"),
            "created_at": now,
        }
        created = await self._repo.create(doc)
        logger.info(
            "Evidence uploaded: id=%s filename=%s",
            created.get("id"),
            created.get("filename"),
        )
        return created

    async def get_evidence(self, id: str) -> dict:
        """Return a single evidence document by id.

        Raises :class:`~app.exceptions.NotFoundError` when not found.
        """
        evidence = await self._repo.get_by_id(id)
        if evidence is None:
            raise NotFoundError(detail=f"Evidence {id} not found")
        return evidence

    async def download_evidence(self, id: str) -> dict:
        """Return evidence metadata including the ``storage_path``.

        The caller uses the ``storage_path`` to retrieve the actual file
        from the external storage system.

        Raises :class:`~app.exceptions.NotFoundError` when not found.
        """
        evidence = await self._repo.get_by_id(id)
        if evidence is None:
            raise NotFoundError(detail=f"Evidence {id} not found")

        return {
            "id": evidence.get("id"),
            "filename": evidence.get("filename", ""),
            "mime_type": evidence.get("mime_type", "application/octet-stream"),
            "file_size": evidence.get("file_size", 0),
            "storage_path": evidence.get("storage_path", ""),
            "type": evidence.get("type", ""),
            "description": evidence.get("description"),
        }
