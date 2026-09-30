"""Settings that matter when the app runs behind the Vercel proxy in production."""

from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import Settings
from app.main import create_app

VERCEL = "https://zoom-clone.vercel.app"


def _settings(**kwargs) -> Settings:
    return Settings(_env_file=None, **kwargs)


def test_cookie_secure_in_production_even_with_http_origin():
    assert _settings(environment="production").cookie_secure is True


def test_cookie_secure_when_the_frontend_uses_https():
    assert _settings(frontend_origin=VERCEL).cookie_secure is True


def test_cookie_not_secure_in_local_development():
    assert _settings().cookie_secure is False


def test_allowed_origin_drops_a_trailing_slash():
    assert _settings(frontend_origin=VERCEL + "/").allowed_origin == VERCEL


@pytest.fixture
def prod(settings, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 48)
    monkeypatch.setattr(settings, "frontend_origin", VERCEL)
    monkeypatch.setattr(settings, "google_client_id", "cid")
    monkeypatch.setattr(settings, "google_client_secret", "secret")
    return settings


def test_google_redirect_uri_and_state_cookie_in_production(prod):
    with TestClient(create_app()) as client:
        r = client.get("/api/auth/google/login", follow_redirects=False)
    query = parse_qs(urlparse(r.headers["location"]).query)
    assert query["redirect_uri"] == [f"{VERCEL}/api/auth/google/callback"]
    cookie = r.headers["set-cookie"].lower()
    assert "oauth_state=" in cookie
    assert "secure" in cookie
    assert "samesite=lax" in cookie
    assert "path=/" in cookie
    assert "domain=" not in cookie


def test_cors_allows_only_the_frontend_origin(prod):
    with TestClient(create_app()) as client:
        ok = client.get("/api/health", headers={"Origin": VERCEL})
        bad = client.get("/api/health", headers={"Origin": "https://evil.example"})
    assert ok.headers["access-control-allow-origin"] == VERCEL
    assert "access-control-allow-origin" not in bad.headers


def test_ws_rejects_another_origin(client):
    headers = {"Origin": "https://evil.example"}
    with client.websocket_connect("/ws/meetings/1234567890?ticket=x", headers=headers) as ws:
        with pytest.raises(WebSocketDisconnect) as info:
            ws.receive_json()
    assert (info.value.code, info.value.reason) == (4403, "origin_not_allowed")


def test_ws_accepts_the_frontend_origin(client):
    # The origin passes. The bad ticket is the next check that fails.
    headers = {"Origin": "http://localhost:3000"}
    with client.websocket_connect("/ws/meetings/1234567890?ticket=x", headers=headers) as ws:
        with pytest.raises(WebSocketDisconnect) as info:
            ws.receive_json()
    assert (info.value.code, info.value.reason) == (4401, "invalid_ticket")
