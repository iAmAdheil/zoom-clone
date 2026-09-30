from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Seconds that a client waits before it tries again after a 503 `server_busy`.
BUSY_RETRY_AFTER = 2


class AppError(Exception):
    """A domain error. It becomes {"detail": ..., "code": ...} in the response."""

    def __init__(
        self, status_code: int, code: str, detail: str, headers: dict[str, str] | None = None
    ):
        self.status_code = status_code
        self.code = code
        self.detail = detail
        self.headers = headers


def _body(detail: str, code: str) -> dict:
    return {"detail": detail, "code": code}


def busy_response() -> JSONResponse:
    return JSONResponse(
        _body("The server is busy. Try again soon.", "server_busy"),
        status_code=503,
        headers={"Retry-After": str(BUSY_RETRY_AFTER)},
    )


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            _body(exc.detail, exc.code), status_code=exc.status_code, headers=exc.headers
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        parts = [
            f"{'.'.join(str(p) for p in e['loc'] if p != 'body')}: {e['msg']}" for e in exc.errors()
        ]
        return JSONResponse(_body("; ".join(parts), "validation_error"), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        return JSONResponse(_body(str(exc.detail), code), status_code=exc.status_code)

    # Overload is a 503 with Retry-After, not a 500.
    @app.exception_handler(PoolTimeoutError)
    async def handle_pool_timeout(_: Request, exc: PoolTimeoutError) -> JSONResponse:
        return busy_response()

    @app.exception_handler(OperationalError)
    async def handle_db_locked(_: Request, exc: OperationalError) -> JSONResponse:
        if "database is locked" in str(exc.orig):
            return busy_response()
        raise exc
