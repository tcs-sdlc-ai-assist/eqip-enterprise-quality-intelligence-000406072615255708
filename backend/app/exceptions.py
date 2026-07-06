"""Custom application exceptions with RFC 7807 problem-detail responses."""


class AppException(Exception):
    """Base application exception.

    Subclasses set ``status_code`` and ``error_type`` to produce a
    consistent RFC 7807 *Problem Details* response via ``to_response()``.
    """

    status_code: int = 500
    error_type: str = "internal_error"

    def __init__(
        self,
        detail: str = "An unexpected error occurred",
        title: str | None = None,
        error_type: str | None = None,
        status_code: int | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        if title is not None:
            self.title = title
        else:
            self.title = self.__class__.__name__
        if error_type is not None:
            self.error_type = error_type
        if status_code is not None:
            self.status_code = status_code

    def to_response(self) -> dict:
        """Return an RFC 7807 problem-detail dict."""
        return {
            "type": self.error_type,
            "title": self.title,
            "status": self.status_code,
            "detail": self.detail,
        }


class NotFoundError(AppException):
    """Resource not found (404)."""

    status_code: int = 404
    error_type: str = "not_found"


class ValidationError(AppException):
    """Request validation failed (422)."""

    status_code: int = 422
    error_type: str = "validation_error"


class ConflictError(AppException):
    """Resource conflict — e.g. duplicate key (409)."""

    status_code: int = 409
    error_type: str = "conflict"


class AuthorizationError(AppException):
    """Insufficient permissions (403)."""

    status_code: int = 403
    error_type: str = "authorization_error"


class AuthenticationError(AppException):
    """Missing or invalid credentials (401)."""

    status_code: int = 401
    error_type: str = "authentication_error"


class PayloadTooLargeError(AppException):
    """Request payload exceeds the allowed size (413)."""

    status_code: int = 413
    error_type: str = "payload_too_large"
