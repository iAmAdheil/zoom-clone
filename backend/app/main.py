import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.body_limit import BodySizeLimitMiddleware
from app.core.config import get_settings
from app.core.db import get_session_factory
from app.core.errors import install_error_handlers
from app.routers import auth, meetings, participants, ws
from app.services.reaper import run_reaper


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Start the reaper (services/reaper.py) and stop it at shutdown."""
    interval = get_settings().reaper_interval_seconds
    task = (
        asyncio.create_task(run_reaper(get_session_factory(), interval)) if interval > 0 else None
    )
    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


def create_app() -> FastAPI:
    settings = get_settings()
    settings.check_secrets()
    app = FastAPI(title="Zoom Clone API", lifespan=lifespan)
    install_error_handlers(app)

    # The last middleware added runs first. The body limit is inside CORS, so a 413 has
    # the CORS headers too.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.allowed_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Only the Google OAuth flow uses this cookie. It keeps the state and `next`.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.jwt_secret,
        session_cookie="oauth_state",
        same_site="lax",
        https_only=settings.cookie_secure,
        max_age=600,
    )

    app.include_router(auth.router)
    app.include_router(meetings.router)
    app.include_router(participants.router)
    app.include_router(ws.router)

    # Async and without the database: it runs on the event loop, not in the thread pool,
    # so it answers during a burst of requests.
    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
