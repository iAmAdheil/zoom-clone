"""BUG-16: the index migration works both ways, and the models match the migrations."""

from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import inspect

from alembic import command
from app.core.db import Base, make_engine

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def alembic_db(tmp_path, settings, monkeypatch):
    url = f"sqlite:///{tmp_path / 'migrate.db'}"
    monkeypatch.setattr(settings, "database_url", url)  # alembic/env.py reads it
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    engine = make_engine(url)
    yield config, engine
    engine.dispose()


def _indexes(engine, table: str) -> set[str]:
    return {ix["name"] for ix in inspect(engine).get_indexes(table)}


def test_upgrade_and_downgrade_the_indexes(alembic_db):
    config, engine = alembic_db
    command.upgrade(config, "head")
    assert "ix_participants_user_id" in _indexes(engine, "participants")
    assert "ix_meetings_status" in _indexes(engine, "meetings")

    command.downgrade(config, "0001")
    assert "ix_participants_user_id" not in _indexes(engine, "participants")
    assert "ix_meetings_status" not in _indexes(engine, "meetings")
    assert "ix_participants_meeting_id" in _indexes(engine, "participants")  # 0001 stays

    command.upgrade(config, "head")
    assert "ix_participants_user_id" in _indexes(engine, "participants")


def test_models_match_the_migrations(alembic_db):
    config, engine = alembic_db
    command.upgrade(config, "head")
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == []
