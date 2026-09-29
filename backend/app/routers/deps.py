from typing import Annotated

from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import COOKIE_NAME, decode_session_token
from app.models import User

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
