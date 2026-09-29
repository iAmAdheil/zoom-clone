from functools import lru_cache
from typing import Annotated

from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import RedirectResponse

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import clear_session_cookie, set_session_cookie
from app.routers.deps import CurrentUserDep, DbDep
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter(prefix="/api", tags=["auth"])

GOOGLE_ISSUER = "https://accounts.google.com"


def require_google() -> None:
    if not get_settings().google_configured:
        raise AppError(
            503,
            "google_not_configured",
            "Google sign-in is not set up. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )


@lru_cache
def _oauth_for(client_id: str, client_secret: str) -> OAuth:
    """Build the authlib client. The endpoints are fixed, so no network call at login."""
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=client_id,
        client_secret=client_secret,
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        access_token_url="https://oauth2.googleapis.com/token",
        jwks_uri="https://www.googleapis.com/oauth2/v3/certs",
        userinfo_endpoint="https://openidconnect.googleapis.com/v1/userinfo",
        issuer=GOOGLE_ISSUER,
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth


def get_google_client():
    settings = get_settings()
    return _oauth_for(settings.google_client_id, settings.google_client_secret).google


def _redirect_uri() -> str:
    return f"{get_settings().frontend_origin.rstrip('/')}/api/auth/google/callback"


@router.get("/auth/google/login")
async def google_login(request: Request, next: Annotated[str | None, Query()] = None):
    require_google()
    request.session["next"] = auth_service.safe_next(next)
    return await get_google_client().authorize_redirect(request, _redirect_uri())


@router.get("/auth/google/callback")
async def google_callback(request: Request, db: DbDep):
    require_google()
    try:
        token = await get_google_client().authorize_access_token(request)
    except OAuthError as exc:
        raise AppError(400, "google_auth_failed", f"Google sign-in failed: {exc.error}") from exc
    info = token.get("userinfo") or {}
    if not info.get("sub") or not info.get("email"):
        raise AppError(400, "google_auth_failed", "Google did not return an email address.")
    user = auth_service.upsert_google_user(
        db, info["sub"], info["email"], info.get("name"), info.get("picture")
    )
    response = RedirectResponse(auth_service.safe_next(request.session.pop("next", None)))
    set_session_cookie(response, user.id)
    return response


@router.post("/auth/demo")
def demo_login(db: DbDep, response: Response) -> UserOut:
    if not get_settings().enable_demo_login:
        raise AppError(404, "demo_disabled", "Demo login is not enabled.")
    user = auth_service.get_or_create_demo_user(db)
    set_session_cookie(response, user.id)
    return UserOut.model_validate(user)


@router.post("/auth/logout", status_code=204)
def logout(response: Response) -> None:
    clear_session_cookie(response)


@router.get("/me")
def me(user: CurrentUserDep) -> UserOut:
    return UserOut.model_validate(user)
