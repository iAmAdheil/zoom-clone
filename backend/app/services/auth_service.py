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


def safe_next(path: str | None) -> str:
    """Allow only a relative path on this site. This stops open redirects."""
    if path and path.startswith("/") and not path.startswith("//") and "\\" not in path:
        return path
    return "/"
