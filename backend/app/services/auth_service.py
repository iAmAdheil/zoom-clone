import re
import unicodedata
from urllib.parse import unquote

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User

DEMO_EMAIL = "demo@zoomclone.test"
DEMO_NAME = "Demo User"


def get_or_create_demo_user(db: Session) -> User:
    user = db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is None:
        user = User(email=DEMO_EMAIL, name=DEMO_NAME, is_demo=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def upsert_google_user(
    db: Session, sub: str, email: str, name: str | None, avatar_url: str | None
) -> User:
    """Find the user by Google id, then by email. Create one if none exists."""
    user = db.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, name=name or email.split("@")[0])
        db.add(user)
    user.google_sub = sub
    if name:
        user.name = name
    if avatar_url:
        user.avatar_url = avatar_url
    db.commit()
    db.refresh(user)
    return user


# A plain path on this site: a single "/" and then printable ASCII URL characters only.
# No whitespace, no control characters, no backslash, no non-ASCII look-alikes.
_PLAIN_PATH = re.compile(r"/(?![/\\])[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*")


def _strip_invisible(value: str) -> str:
    """Remove every control character and every whitespace character.

    A browser drops tab, CR and LF from a URL, so "/\\t/evil.example" acts like
    "//evil.example". Checking the stripped value catches that.
    """
    return "".join(
        ch for ch in value if not ch.isspace() and not unicodedata.category(ch).startswith("C")
    )


def _looks_external(value: str) -> bool:
    cleaned = _strip_invisible(value)
    return (
        not cleaned.startswith("/")
        or cleaned.startswith("//")
        or cleaned.startswith("/\\")
        or "://" in cleaned
    )


def safe_next(path: str | None) -> str:
    """Return `path` if it is a plain path on this site. Otherwise return "/".

    This stops open redirects after sign-in (BUG-03). The check also runs on the
    percent-decoded forms, so "/%09/evil.example" and "%2F%2Fevil.example" are refused.
    """
    if not path or len(path) > 2048 or not _PLAIN_PATH.fullmatch(path):
        return "/"
    candidate = path
    for _ in range(4):
        if _looks_external(candidate):
            return "/"
        decoded = unquote(candidate)
        if decoded == candidate:
            return path
        candidate = decoded
    return "/"  # still encoded after 4 rounds: refuse it
