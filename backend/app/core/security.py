import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Response

from app.core.config import get_settings

ALGORITHM = "HS256"
COOKIE_NAME = "session"


def _encode(claims: dict, lifetime: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {**claims, "iat": now, "exp": now + lifetime}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=ALGORITHM)


def _decode(token: str, expected_type: str) -> dict | None:
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != expected_type:
        return None
    return claims


def create_session_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id), "typ": "session"},
        timedelta(days=get_settings().session_days),
    )


def decode_session_token(token: str) -> int | None:
    claims = _decode(token, "session")
    if claims is None:
        return None
    try:
        return int(claims["sub"])
    except (KeyError, ValueError):
        return None


def set_session_cookie(response: Response, user_id: int) -> None:
    settings = get_settings()
    response.set_cookie(
        COOKIE_NAME,
        create_session_token(user_id),
        max_age=settings.session_days * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def create_ws_ticket(participant_id: int, meeting_id: int) -> str:
    """A signed ticket that lives ws_ticket_seconds. The WebSocket task makes it single use."""
    return _encode(
        {"typ": "ws", "pid": participant_id, "mid": meeting_id, "jti": uuid.uuid4().hex},
        timedelta(seconds=get_settings().ws_ticket_seconds),
    )


def verify_ws_ticket(token: str) -> dict | None:
    """Return the ticket claims (pid, mid, jti), or None if invalid or expired."""
    return _decode(token, "ws")


def create_rejoin_token(participant_id: int, meeting_id: int) -> str:
    """A signed token that lets the same participant join again after a dropped connection."""
    return _encode(
        {"typ": "rejoin", "pid": participant_id, "mid": meeting_id},
        timedelta(hours=get_settings().rejoin_token_hours),
    )


def verify_rejoin_token(token: str) -> dict | None:
    """Return the token claims (pid, mid), or None if invalid or expired."""
    return _decode(token, "rejoin")
