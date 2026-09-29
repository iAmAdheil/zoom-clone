from app.core.security import create_session_token, create_ws_ticket, verify_ws_ticket
from app.services.auth_service import safe_next


def test_me_requires_login(client):
    r = client.get("/api/me")
    assert r.status_code == 401
    assert r.json()["code"] == "not_authenticated"


def test_demo_login_sets_httponly_cookie(client):
    r = client.post("/api/auth/demo")
    assert r.status_code == 200
    assert r.json()["is_demo"] is True
    header = r.headers["set-cookie"].lower()
    assert header.startswith("session=")
    assert "httponly" in header
    assert "samesite=lax" in header

    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == r.json()["email"]


def test_demo_login_disabled_returns_404(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "enable_demo_login", False)
    r = client.post("/api/auth/demo")
    assert r.status_code == 404
    assert r.json()["code"] == "demo_disabled"


def test_logout_clears_cookie(client):
    client.post("/api/auth/demo")
    r = client.post("/api/auth/logout")
    assert r.status_code == 204
    assert client.get("/api/me").status_code == 401


def test_bad_token_is_rejected(client):
    client.cookies.set("session", "not-a-jwt")
    assert client.get("/api/me").status_code == 401


def test_ws_ticket_is_not_a_session_token(client, host):
    client.cookies.set("session", create_ws_ticket(1, 1))
    assert client.get("/api/me").status_code == 401
    assert verify_ws_ticket(create_session_token(host.id)) is None


def test_ws_ticket_round_trip():
    claims = verify_ws_ticket(create_ws_ticket(5, 9))
    assert claims["pid"] == 5
    assert claims["mid"] == 9
    assert claims["jti"]


def test_google_routes_return_503_when_not_configured(client):
    for path in ("/api/auth/google/login", "/api/auth/google/callback"):
        r = client.get(path, follow_redirects=False)
        assert r.status_code == 503
        assert r.json()["code"] == "google_not_configured"
        assert "GOOGLE_CLIENT_ID" in r.json()["detail"]


def test_google_login_redirects_to_google_when_configured(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "cid")
    monkeypatch.setattr(settings, "google_client_secret", "secret")
    r = client.get("/api/auth/google/login?next=/schedule", follow_redirects=False)
    assert r.status_code == 302
    location = r.headers["location"]
    assert location.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "client_id=cid" in location
    assert "api%2Fauth%2Fgoogle%2Fcallback" in location


def test_google_callback_creates_user_and_sets_cookie(client, settings, monkeypatch):
    from app.routers import auth as auth_router

    monkeypatch.setattr(settings, "google_client_id", "cid")
    monkeypatch.setattr(settings, "google_client_secret", "secret")

    class FakeGoogle:
        async def authorize_access_token(self, request):
            return {"userinfo": {"sub": "g-1", "email": "g@example.com", "name": "Gina"}}

    monkeypatch.setattr(auth_router, "get_google_client", lambda: FakeGoogle())
    r = client.get("/api/auth/google/callback", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"] == "/"
    assert "session=" in r.headers["set-cookie"]
    assert client.get("/api/me").json()["email"] == "g@example.com"


def test_safe_next_blocks_open_redirects():
    assert safe_next("/schedule") == "/schedule"
    assert safe_next("//evil.com") == "/"
    assert safe_next("https://evil.com") == "/"
    assert safe_next(None) == "/"
