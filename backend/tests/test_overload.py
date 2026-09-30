"""BUG-02: a burst of requests must not freeze the backend."""

import inspect
import sqlite3
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

from app.core.db import Base, get_db, make_engine
from app.main import app
from app.routers import ws
from app.services import auth_service


@pytest.fixture
def file_engine(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'burst.db'}")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


def test_sqlite_file_engine_has_no_pool_wait_and_uses_wal(file_engine, settings):
    assert isinstance(file_engine.pool, NullPool)
    with file_engine.connect() as conn:
        raw = conn.connection.dbapi_connection
        assert raw.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert raw.execute("PRAGMA busy_timeout").fetchone()[0] == settings.db_busy_timeout_ms
        assert raw.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_in_memory_engine_keeps_the_given_pool():
    engine = make_engine("sqlite://", poolclass=StaticPool)
    assert isinstance(engine.pool, StaticPool)


def test_burst_larger_than_the_thread_pool_does_not_deadlock(file_engine, settings, monkeypatch):
    """Before the fix, 120 parallel demo logins hung for 30 s and then got 500s.

    The pool had 15 connections, the thread pool had 40 threads. A finished endpoint
    held its connection until FastAPI validated its response, which needs a thread.
    """
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    factory = sessionmaker(bind=file_engine, expire_on_commit=False)

    def file_db():
        with factory() as session:
            yield session

    with factory() as db:
        auth_service.get_or_create_demo_user(db)
    app.dependency_overrides[get_db] = file_db
    try:
        with TestClient(app) as client, ThreadPoolExecutor(max_workers=120) as pool:
            codes = list(pool.map(lambda _: client.post("/api/auth/demo").status_code, range(120)))
    finally:
        app.dependency_overrides.clear()
    assert codes == [200] * 120


def test_health_is_async_and_needs_no_database(client):
    route = next(r for r in app.routes if getattr(r, "path", "") == "/api/health")
    assert inspect.iscoroutinefunction(route.endpoint)
    assert client.get("/api/health").json() == {"status": "ok"}


@pytest.mark.parametrize(
    "error",
    [
        OperationalError("SELECT 1", {}, sqlite3.OperationalError("database is locked")),
        PoolTimeoutError("QueuePool limit reached"),
    ],
)
def test_database_overload_is_503_with_retry_after(client, monkeypatch, error):
    def busy(_db):
        raise error

    monkeypatch.setattr(auth_service, "get_or_create_demo_user", busy)
    r = client.post("/api/auth/demo")
    assert r.status_code == 503
    assert r.json()["code"] == "server_busy"
    assert r.headers["Retry-After"] == "2"


def test_other_database_errors_are_not_hidden(db_session, monkeypatch):
    def broken(_db):
        raise OperationalError("SELECT 1", {}, sqlite3.OperationalError("no such table: users"))

    monkeypatch.setattr(auth_service, "get_or_create_demo_user", broken)
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            assert client.post("/api/auth/demo").status_code == 500
    finally:
        app.dependency_overrides.clear()


def test_websocket_database_work_has_its_own_threads(settings):
    assert ws._db_threads.total_tokens == settings.ws_db_threads
