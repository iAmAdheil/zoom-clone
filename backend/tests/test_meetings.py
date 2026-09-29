from datetime import UTC, datetime, timedelta

from tests.conftest import future, login_as, schedule_body


def test_instant_meeting_is_live_with_code(host_client):
    r = host_client.post("/api/meetings/instant", json={})
    assert r.status_code == 200
    m = r.json()
    assert m["status"] == "live"
    assert m["type"] == "instant"
    assert m["access"] == "allow_guests"
    assert len(m["meeting_code"]) == 10 and m["meeting_code"].isdigit()
    assert m["invite_link"] == f"http://localhost:3000/j/{m['meeting_code']}"
    assert m["host"]["email"] == "host@example.com"
    assert m["started_at"]


def test_instant_requires_login(guest_client):
    assert guest_client.post("/api/meetings/instant", json={}).status_code == 401


def test_schedule_meeting(host_client):
    r = host_client.post(
        "/api/meetings", json=schedule_body(passcode="1234", access="verified_only")
    )
    assert r.status_code == 200
    m = r.json()
    assert m["status"] == "scheduled"
    assert m["type"] == "scheduled"
    assert m["access"] == "verified_only"
    assert m["passcode"] == "1234"
    assert m["scheduled_start"].endswith("Z")


def test_schedule_rejects_past_start(host_client):
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    r = host_client.post("/api/meetings", json=schedule_body(scheduled_start=past))
    assert r.status_code == 422
    assert r.json()["code"] == "start_in_past"


def test_schedule_rejects_bad_timezone_and_duration(host_client):
    r = host_client.post("/api/meetings", json=schedule_body(timezone="Mars/Base"))
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"
    r = host_client.post("/api/meetings", json=schedule_body(duration_min=0))
    assert r.status_code == 422


def test_blank_passcode_means_no_passcode(host_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="  ")).json()
    assert m["passcode"] is None


def test_upcoming_is_own_scheduled_future_ascending(host_client, other, db_session):
    later = host_client.post("/api/meetings", json=schedule_body(scheduled_start=future(48))).json()
    sooner = host_client.post("/api/meetings", json=schedule_body(scheduled_start=future(2))).json()
    host_client.post("/api/meetings/instant", json={})  # live, not upcoming

    upcoming = host_client.get("/api/meetings/upcoming").json()
    assert [m["id"] for m in upcoming] == [sooner["id"], later["id"]]

    login_as(host_client, other)
    assert host_client.get("/api/meetings/upcoming").json() == []


def test_recent_lists_hosted_and_joined_newest_first(host_client, other, guest_client):
    first = host_client.post("/api/meetings/instant", json={"title": "First"}).json()
    second = host_client.post("/api/meetings/instant", json={"title": "Second"}).json()
    host_client.post("/api/meetings", json=schedule_body())  # not started: not recent

    recent = host_client.get("/api/meetings/recent").json()
    assert [m["title"] for m in recent] == ["Second", "First"]
    assert host_client.get("/api/meetings/recent?limit=1").json()[0]["id"] == second["id"]

    # `other` joined the first meeting, so it shows up for them.
    login_as(guest_client, other)
    guest_client.post(f"/api/meetings/{first['meeting_code']}/join", json={"display_name": "Otto"})
    ids = [m["id"] for m in guest_client.get("/api/meetings/recent").json()]
    assert ids == [first["id"]]


def test_recent_limit_is_validated(host_client):
    assert host_client.get("/api/meetings/recent?limit=0").status_code == 422


def test_public_lookup_with_spaces(host_client, guest_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="abc")).json()
    code = m["meeting_code"]
    spaced = f"{code[:3]} {code[3:6]} {code[6:]}"
    r = guest_client.get(f"/api/meetings/{spaced}")
    assert r.status_code == 200
    assert r.json() == {
        "meeting_code": code,
        "title": "Planning",
        "host_name": "Hana Host",
        "status": "scheduled",
        "access": "allow_guests",
        "requires_passcode": True,
    }


def test_lookup_unknown_is_404(guest_client):
    r = guest_client.get("/api/meetings/0000000000")
    assert r.status_code == 404
    assert r.json()["code"] == "meeting_not_found"


def test_patch_by_host(host_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="1234")).json()
    r = host_client.patch(
        f"/api/meetings/{m['id']}",
        json={"title": "New title", "access": "verified_only", "passcode": None},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "New title"
    assert r.json()["access"] == "verified_only"
    assert r.json()["passcode"] is None
    assert r.json()["duration_min"] == 30  # untouched


def test_patch_by_non_host_is_403(host_client, other):
    m = host_client.post("/api/meetings", json=schedule_body()).json()
    login_as(host_client, other)
    r = host_client.patch(f"/api/meetings/{m['id']}", json={"title": "Hijack"})
    assert r.status_code == 403
    assert r.json()["code"] == "not_host"


def test_patch_rejects_null_title_and_past_time(host_client):
    m = host_client.post("/api/meetings", json=schedule_body()).json()
    assert host_client.patch(f"/api/meetings/{m['id']}", json={"title": None}).status_code == 422
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    r = host_client.patch(f"/api/meetings/{m['id']}", json={"scheduled_start": past})
    assert r.json()["code"] == "start_in_past"


def test_patch_time_of_live_meeting_is_409(host_client):
    m = host_client.post("/api/meetings/instant", json={}).json()
    r = host_client.patch(f"/api/meetings/{m['id']}", json={"scheduled_start": future()})
    assert r.status_code == 409


def test_delete_scheduled_meeting(host_client, guest_client):
    m = host_client.post("/api/meetings", json=schedule_body()).json()
    assert host_client.delete(f"/api/meetings/{m['id']}").status_code == 204
    assert guest_client.get(f"/api/meetings/{m['meeting_code']}").status_code == 404


def test_delete_rules(host_client, other):
    live = host_client.post("/api/meetings/instant", json={}).json()
    r = host_client.delete(f"/api/meetings/{live['id']}")
    assert r.status_code == 409
    assert r.json()["code"] == "meeting_not_cancellable"

    sched = host_client.post("/api/meetings", json=schedule_body()).json()
    login_as(host_client, other)
    assert host_client.delete(f"/api/meetings/{sched['id']}").status_code == 403
    assert host_client.delete("/api/meetings/99999").status_code == 404


def test_end_meeting_by_host_only(host_client, other, guest_client):
    m = host_client.post("/api/meetings/instant", json={}).json()
    code = m["meeting_code"]

    login_as(guest_client, other)
    assert guest_client.post(f"/api/meetings/{code}/end").status_code == 403

    r = host_client.post(f"/api/meetings/{code}/end")
    assert r.status_code == 200
    assert r.json()["status"] == "ended"
    assert r.json()["ended_at"]

    again = host_client.post(f"/api/meetings/{code}/end")
    assert again.status_code == 410
    assert again.json()["code"] == "meeting_ended"


def test_ended_meeting_cannot_be_edited(host_client):
    m = host_client.post("/api/meetings/instant", json={}).json()
    host_client.post(f"/api/meetings/{m['meeting_code']}/end")
    r = host_client.patch(f"/api/meetings/{m['id']}", json={"title": "x"})
    assert r.status_code == 409


def test_meeting_codes_are_unique_and_retry_on_collision(host_client, db_session, monkeypatch):
    from app.services import meeting_service

    first = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    codes = iter([first, first, "1234567890"])
    monkeypatch.setattr(meeting_service.secrets, "randbelow", lambda n: int(next(codes)) - 10**9)
    second = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    assert second == "1234567890"
