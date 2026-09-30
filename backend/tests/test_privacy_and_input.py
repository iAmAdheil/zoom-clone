"""BUG-04 (host email and passcode), BUG-03 (safe_next) and BUG-17 (local start times)."""

import pytest

from app.services.auth_service import safe_next
from tests.conftest import login_as, schedule_body

PUBLIC_HOST_KEYS = {"id", "name", "avatar_url"}


# ---- BUG-04: only the host sees the email and the passcode -----------------


def test_guest_join_gets_a_public_host_and_no_passcode(host_client, guest_client, host):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="s3cret")).json()
    r = guest_client.post(
        f"/api/meetings/{m['meeting_code']}/join",
        json={"display_name": "Gus", "passcode": "s3cret"},
    )
    assert r.status_code == 200
    meeting = r.json()["meeting"]
    assert meeting["host"] == {"id": host.id, "name": "Hana Host", "avatar_url": None}
    assert "email" not in str(r.json())
    assert meeting["passcode"] is None
    assert meeting["requires_passcode"] is True


def test_signed_in_participant_sees_a_public_host_everywhere(host_client, guest_client, other):
    m = host_client.post("/api/meetings/instant", json={}).json()
    login_as(guest_client, other)
    joined = guest_client.post(
        f"/api/meetings/{m['meeting_code']}/join", json={"display_name": "O"}
    )
    assert set(joined.json()["meeting"]["host"]) == PUBLIC_HOST_KEYS

    recent = guest_client.get("/api/meetings/recent").json()
    assert [x["id"] for x in recent] == [m["id"]]
    assert set(recent[0]["host"]) == PUBLIC_HOST_KEYS


def test_host_sees_the_full_user_and_the_passcode(host_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="s3cret")).json()
    assert m["host"]["email"] == "host@example.com"
    assert m["passcode"] == "s3cret"
    assert m["requires_passcode"] is True
    joined = host_client.post(f"/api/meetings/{m['meeting_code']}/join", json={"display_name": "H"})
    assert joined.json()["meeting"]["host"]["email"] == "host@example.com"
    assert joined.json()["meeting"]["passcode"] == "s3cret"
    listed = host_client.get("/api/meetings/recent").json()[0]  # live now, so in Recent
    assert (listed["host"]["email"], listed["passcode"]) == ("host@example.com", "s3cret")


def test_meeting_without_passcode_says_so(host_client):
    m = host_client.post("/api/meetings/instant", json={}).json()
    assert (m["passcode"], m["requires_passcode"]) == (None, False)


# ---- BUG-03: safe_next --------------------------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        "/",
        "/schedule",
        "/j/1234567890?pwd=a%20b%23c",
        "/meeting/1234567890#top",
        "/a/b.c-d_e~f!$&'()*+,;=:@",
    ],
)
def test_safe_next_keeps_plain_paths(value):
    assert safe_next(value) == value


@pytest.mark.parametrize(
    "value",
    [
        None,
        "",
        "//evil.example",
        "/\\evil.example",
        "\\\\evil.example",
        "https://evil.example",
        "evil.example",
        "javascript:alert(1)",
        "/\t/evil.example/",  # tab
        "/\r/evil.example/",  # CR
        "/\n/evil.example/",  # LF
        "/\x00/evil.example",
        "/ /evil.example",
        "\t//evil.example",
        " /schedule",
        "/ /evil.example",  # line separator
        "/​/evil.example",  # zero-width space
        "/／/evil.example",  # fullwidth solidus, looks like "/"
        "/∕evil.example",  # division slash
        "／／evil.example",
        "/%09/evil.example/",  # encoded tab
        "/%0a/evil.example/",
        "/%0D/evil.example/",
        "/%2F/evil.example",
        "/%5Cevil.example",
        "/%252F/evil.example",  # encoded twice
        "/redirect?to=https://evil.example",
        "/%68ttps://evil.example",
        "/" + "a" * 3000,
    ],
)
def test_safe_next_refuses_everything_else(value):
    assert safe_next(value) == "/"


# ---- BUG-17: a start time without an offset uses the timezone field ----------


def test_naive_start_is_read_in_the_meeting_timezone(host_client):
    body = schedule_body(scheduled_start="2031-01-01T10:00:00", timezone="Asia/Kolkata")
    m = host_client.post("/api/meetings", json=body).json()
    assert m["scheduled_start"].startswith("2031-01-01T04:30:00")
    assert m["timezone"] == "Asia/Kolkata"


def test_naive_start_follows_daylight_saving(host_client):
    summer = schedule_body(scheduled_start="2031-07-01T10:00:00", timezone="America/New_York")
    winter = schedule_body(scheduled_start="2031-01-01T10:00:00", timezone="America/New_York")
    assert (
        host_client.post("/api/meetings", json=summer)
        .json()["scheduled_start"]
        .startswith("2031-07-01T14:00:00")
    )
    assert (
        host_client.post("/api/meetings", json=winter)
        .json()["scheduled_start"]
        .startswith("2031-01-01T15:00:00")
    )


def test_start_with_an_offset_is_kept(host_client):
    body = schedule_body(scheduled_start="2031-01-01T10:00:00Z", timezone="Asia/Kolkata")
    m = host_client.post("/api/meetings", json=body).json()
    assert m["scheduled_start"].startswith("2031-01-01T10:00:00")


def test_unknown_timezone_is_422(host_client):
    body = schedule_body(scheduled_start="2031-01-01T10:00:00", timezone="Mars/Olympus")
    r = host_client.post("/api/meetings", json=body)
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"


def test_patch_naive_start_uses_the_new_or_the_stored_timezone(host_client):
    m = host_client.post("/api/meetings", json=schedule_body(timezone="Asia/Kolkata")).json()
    r = host_client.patch(f"/api/meetings/{m['id']}", json={"scheduled_start": "2031-01-01T10:00"})
    assert r.json()["scheduled_start"].startswith("2031-01-01T04:30:00")
    r = host_client.patch(
        f"/api/meetings/{m['id']}",
        json={"scheduled_start": "2031-01-01T10:00", "timezone": "Europe/London"},
    )
    assert r.json()["scheduled_start"].startswith("2031-01-01T10:00:00")


def test_naive_start_in_the_past_is_refused(host_client):
    body = schedule_body(scheduled_start="2001-01-01T10:00:00", timezone="Asia/Kolkata")
    assert host_client.post("/api/meetings", json=body).json()["code"] == "start_in_past"
