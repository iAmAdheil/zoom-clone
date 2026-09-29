from collections.abc import Iterator
from contextlib import nullcontext
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.db import Base, get_db, get_session_factory, make_engine
from app.main import app
from app.models import User


@pytest.fixture
def db_session() -> Iterator[Session]:
    engine = make_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        yield session
    engine.dispose()


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "enable_demo_login", True)
    monkeypatch.setattr(s, "google_client_id", None)
    monkeypatch.setattr(s, "google_client_secret", None)
    monkeypatch.setattr(s, "frontend_origin", "http://localhost:3000")
    return s


def _client(db_session: Session) -> TestClient:
    def override():
        yield db_session

    app.dependency_overrides[get_db] = override
    # The WebSocket opens a short session per step. In tests, every step uses the test session.
    app.dependency_overrides[get_session_factory] = lambda: lambda: nullcontext(db_session)
    return TestClient(app)


@pytest.fixture
def client(db_session) -> Iterator[TestClient]:
    with _client(db_session) as c:
        yield c
    app.dependency_overrides.clear()


def make_user(db: Session, email: str, name: str) -> User:
    user = User(email=email, name=name)
    db.add(user)
    db.commit()
    return user


def login_as(client: TestClient, user: User) -> TestClient:
    from app.core.security import create_session_token

    client.cookies.set("session", create_session_token(user.id))
    return client


@pytest.fixture
def host(db_session) -> User:
    return make_user(db_session, "host@example.com", "Hana Host")


@pytest.fixture
def other(db_session) -> User:
    return make_user(db_session, "other@example.com", "Otto Other")


@pytest.fixture
def host_client(client, host) -> TestClient:
    return login_as(client, host)


@pytest.fixture
def guest_client(db_session) -> Iterator[TestClient]:
    """A second client with no cookies, on the same database."""
    with _client(db_session) as c:
        yield c


def future(hours: int = 24) -> str:
    return (datetime.now(UTC) + timedelta(hours=hours)).isoformat()


def schedule_body(**overrides) -> dict:
    body = {
        "title": "Planning",
        "scheduled_start": future(),
        "duration_min": 30,
        "timezone": "Asia/Kolkata",
    }
    body.update(overrides)
    return body
