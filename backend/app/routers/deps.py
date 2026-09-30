from typing import Annotated

from fastapi import Cookie, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import COOKIE_NAME, decode_session_token
from app.models import User
from app.services import rate_limit

DbDep = Annotated[Session, Depends(get_db)]


def get_optional_user(
    db: DbDep, session: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None
) -> User | None:
    if not session:
        return None
    user_id = decode_session_token(session)
    return db.get(User, user_id) if user_id is not None else None


OptionalUserDep = Annotated[User | None, Depends(get_optional_user)]


def get_current_user(user: OptionalUserDep) -> User:
    if user is None:
        raise AppError(401, "not_authenticated", "Sign in first.")
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def get_client_ip(request: Request) -> str:
    """The caller's IP for rate limits.

    Render puts the real client IP first in `X-Forwarded-For` (Vercel sets the header
    the same way for the `/api` proxy). Without the header, use the socket peer.
    """
    if get_settings().trust_forwarded_for:
        forwarded = request.headers.get("x-forwarded-for", "")
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


ClientIpDep = Annotated[str, Depends(get_client_ip)]


async def limit_demo_login(client_ip: ClientIpDep) -> None:
    rate_limit.check_demo_login(client_ip)


async def limit_join(client_ip: ClientIpDep) -> None:
    rate_limit.check_join(client_ip)
