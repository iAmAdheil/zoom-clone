import pytest

from app.core.config import DEV_JWT_SECRET, Settings
from app.main import create_app


def test_environment_defaults_to_development():
    assert Settings(_env_file=None).environment == "development"


def test_production_with_the_dev_secret_fails_at_startup(settings, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "jwt_secret", DEV_JWT_SECRET)
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        create_app()


def test_production_check_ignores_case(settings, monkeypatch):
    monkeypatch.setattr(settings, "environment", "Production")
    monkeypatch.setattr(settings, "jwt_secret", DEV_JWT_SECRET)
    with pytest.raises(RuntimeError):
        create_app()


def test_production_with_a_real_secret_starts(settings, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 48)
    create_app()


def test_development_with_the_dev_secret_starts(settings, monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "jwt_secret", DEV_JWT_SECRET)
    create_app()
