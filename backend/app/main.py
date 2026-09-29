from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.routers import auth, meetings, participants, ws


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Zoom Clone API")
    install_error_handlers(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
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

    @app.get("/api/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
