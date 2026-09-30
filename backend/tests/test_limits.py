"""BUG-09 (rate limits) and BUG-10 (request body size)."""

import pytest

from app.services.rate_limit import SlidingWindow
from tests.conftest import schedule_body


def demo(client, ip="203.0.113.1"):
    return client.post("/api/auth/demo", headers={"X-Forwarded-For": f"{ip}, 10.0.0.1"})


def join(client, code, ip="203.0.113.1", **body):
    return client.post(
        f"/api/meetings/{code}/join",
        json={"display_name": "Gus", **body},
        headers={"X-Forwarded-For": ip},
    )


# ---- BUG-09: rate limits ------------------------------------------------------


def test_demo_login_allows_30_per_minute_per_ip(client):
    for _ in range(30):
        assert demo(client).status_code == 200
    r = demo(client)
    assert r.status_code == 429
    assert r.json()["code"] == "rate_limited"
    assert 1 <= int(r.headers["Retry-After"]) <= 60
    # Another client IP has its own counter.
    assert demo(client, ip="198.51.100.7").status_code == 200


def test_join_allows_60_per_minute_per_ip(host_client, guest_client):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    for _ in range(60):
        assert join(guest_client, code).status_code == 200
    r = join(guest_client, code)
    assert r.status_code == 429
    assert "Retry-After" in r.headers
    assert join(guest_client, code, ip="198.51.100.7").status_code == 200


def test_ten_wrong_passcodes_lock_that_ip_out_of_that_meeting(host_client, guest_client):
    code = host_client.post("/api/meetings", json=schedule_body(passcode="1234")).json()[
        "meeting_code"
    ]
    other = host_client.post("/api/meetings", json=schedule_body(passcode="1234")).json()[
        "meeting_code"
    ]
    for _ in range(10):
        assert join(guest_client, code, passcode="0000").json()["code"] == "bad_passcode"

    locked = join(guest_client, code, passcode="1234")  # even the right passcode
    assert locked.status_code == 429
    assert 1 <= int(locked.headers["Retry-After"]) <= 300
    # Another IP, or another meeting, is not locked.
    assert join(guest_client, code, ip="198.51.100.7", passcode="1234").status_code == 200
    assert join(guest_client, other, passcode="1234").status_code == 200


def test_right_passcodes_do_not_count(host_client, guest_client):
    code = host_client.post("/api/meetings", json=schedule_body(passcode="1234")).json()[
        "meeting_code"
    ]
    for _ in range(15):
        assert join(guest_client, code, passcode="1234").status_code == 200


def test_limits_come_from_settings(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_demo_per_minute", 2)
    assert [demo(client).status_code for _ in range(3)] == [200, 200, 429]
    monkeypatch.setattr(settings, "rate_limit_enabled", False)
    assert demo(client).status_code == 200


def test_client_ip_falls_back_to_the_peer(client, settings, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_demo_per_minute", 1)
    monkeypatch.setattr(settings, "trust_forwarded_for", False)
    assert demo(client, ip="203.0.113.1").status_code == 200
    # The header is ignored, so a new forwarded IP does not get a new counter.
    assert demo(client, ip="203.0.113.2").status_code == 429


def test_sliding_window_slides():
    clock = [1000.0]
    window = SlidingWindow(clock=lambda: clock[0])
    assert [window.hit("k", 2, 60) for _ in range(2)] == [0.0, 0.0]
    clock[0] += 30
    assert window.hit("k", 2, 60) == pytest.approx(30)
    clock[0] += 30  # the first two events leave the window
    assert window.hit("k", 2, 60) == 0.0
    assert window.wait_time("k", 1, 60) == pytest.approx(60)
    window.record("x")
    clock[0] += 61
    window.sweep(60)
    assert len(window) == 0


# ---- BUG-10: body size ----------------------------------------------------------


def test_large_body_with_content_length_is_413(host_client):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    body = b'{"display_name": "' + b"x" * 70_000 + b'"}'
    r = host_client.post(
        f"/api/meetings/{code}/join", content=body, headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 413
    assert r.json()["code"] == "payload_too_large"


def test_large_chunked_body_is_413(host_client):
    def chunks():
        yield b'{"display_name": "'
        for _ in range(100):
            yield b"x" * 1024
        yield b'"}'

    r = host_client.post(
        "/api/meetings/instant", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 413


def test_small_chunked_body_still_works(host_client):
    def chunks():
        yield b'{"title": '
        yield b'"Chunked"}'

    r = host_client.post(
        "/api/meetings/instant", content=chunks(), headers={"Content-Type": "application/json"}
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Chunked"


def test_body_at_the_limit_is_parsed(host_client, settings):
    # 64 KB passes the size check. The schema then refuses the long title with 422.
    title = "x" * (settings.max_body_bytes - len('{"title": ""}'))
    r = host_client.post("/api/meetings/instant", json={"title": title})
    assert r.status_code == 422
