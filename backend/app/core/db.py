from collections.abc import Callable, Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _is_sqlite_file(url: str) -> bool:
    database = make_url(url).database
    return bool(database) and database != ":memory:" and "mode=memory" not in url


def make_engine(url: str, **kwargs) -> Engine:
    """Build the engine. For a SQLite file, each session opens its own connection.

    Why no connection pool for SQLite (BUG-02): a sync endpoint keeps its connection
    until FastAPI closes the `get_db` session, and FastAPI first validates the response
    in the same thread pool (40 threads). Under a burst, 40 threads waited for one of the
    15 pooled connections, while the 15 holders waited for a thread. Nothing moved until
    the 30 s pool timeout gave 500s. A SQLite connection is a cheap file handle, so
    `NullPool` removes the wait. SQLite itself orders the writers (WAL and busy_timeout).
    """
    is_sqlite = url.startswith("sqlite")
    if is_sqlite:
        kwargs.setdefault("connect_args", {"check_same_thread": False})
        if _is_sqlite_file(url):
            kwargs.setdefault("poolclass", NullPool)
    engine = create_engine(url, **kwargs)
    if is_sqlite:
        busy_ms = int(get_settings().db_busy_timeout_ms)

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
            dbapi_conn.execute(f"PRAGMA busy_timeout={busy_ms}")
            # Readers do not block the writer. An in-memory database ignores this.
            dbapi_conn.execute("PRAGMA journal_mode=WAL")

    return engine


engine = make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def get_session_factory() -> Callable[[], Session]:
    """For the WebSocket endpoint and the reaper. They live for a long time, so they open
    a short session for each step. They do not keep one session open for their whole life."""
    return SessionLocal
