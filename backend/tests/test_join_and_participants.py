from app.core.security import verify_ws_ticket
from app.models import Participant, ParticipantRole
from tests.conftest import login_as, make_user, schedule_body


def join(client, code, name="Guest", **extra):
    return client.post(f"/api/meetings/{code}/join", json={"display_name": name, **extra})


# ---- join rules -------------------------------------------------------------


def test_guest_joins_open_meeting_and_gets_ticket(host_client, guest_client):
    m = host_client.post("/api/meetings/instant", json={}).json()
    r = join(guest_client, m["meeting_code"], "Gus")
    assert r.status_code == 200
    body = r.json()
    assert body["participant"]["display_name"] == "Gus"
    assert body["participant"]["role"] == "attendee"
    assert body["participant"]["user_id"] is None
    assert body["meeting"]["id"] == m["id"]
    claims = verify_ws_ticket(body["ws_ticket"])
    assert claims["pid"] == body["participant"]["id"]
    assert claims["mid"] == m["id"]


def test_guest_blocked_when_verified_only(host_client, guest_client):
    m = host_client.post("/api/meetings/instant", json={"access": "verified_only"}).json()
    r = join(guest_client, m["meeting_code"])
    assert r.status_code == 403
    assert r.json()["code"] == "guests_not_allowed"


def test_signed_in_user_joins_verified_only(host_client, guest_client, other):
    m = host_client.post("/api/meetings/instant", json={"access": "verified_only"}).json()
    login_as(guest_client, other)
    r = join(guest_client, m["meeting_code"], "Otto")
    assert r.status_code == 200
    assert r.json()["participant"]["user_id"] == other.id


def test_passcode_rules(host_client, guest_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="1234")).json()
    code = m["meeting_code"]

    missing = join(guest_client, code)
    assert missing.status_code == 403
    assert missing.json()["code"] == "bad_passcode"
    assert join(guest_client, code, passcode="0000").json()["code"] == "bad_passcode"
    assert join(guest_client, code, passcode="1234").status_code == 200


def test_access_is_checked_before_passcode(host_client, guest_client):
    m = host_client.post(
        "/api/meetings", json=schedule_body(passcode="1234", access="verified_only")
    ).json()
    r = join(guest_client, m["meeting_code"], passcode="1234")
    assert r.json()["code"] == "guests_not_allowed"


def test_ended_meeting_returns_410_before_other_checks(host_client, guest_client):
    m = host_client.post("/api/meetings/instant", json={"access": "verified_only"}).json()
    host_client.post(f"/api/meetings/{m['meeting_code']}/end")
    r = join(guest_client, m["meeting_code"])
    assert r.status_code == 410
    assert r.json()["code"] == "meeting_ended"


def test_host_join_starts_scheduled_meeting_and_skips_passcode(host_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="1234")).json()
    r = join(host_client, m["meeting_code"], "Hana")
    assert r.status_code == 200
    assert r.json()["participant"]["role"] == "host"
    assert r.json()["meeting"]["status"] == "live"
    assert r.json()["meeting"]["started_at"]


def test_non_host_join_does_not_start_meeting(host_client, guest_client):
    m = host_client.post("/api/meetings", json=schedule_body()).json()
    r = join(guest_client, m["meeting_code"])
    assert r.json()["meeting"]["status"] == "scheduled"


def test_join_unknown_meeting_and_blank_name(host_client, guest_client):
    assert join(guest_client, "0000000000").status_code == 404
    m = host_client.post("/api/meetings/instant", json={}).json()
    assert join(guest_client, m["meeting_code"], "   ").status_code == 422


def test_signed_in_user_rejoin_reuses_row(host_client, guest_client, other, db_session):
    m = host_client.post("/api/meetings/instant", json={}).json()
    login_as(guest_client, other)
    a = join(guest_client, m["meeting_code"], "Otto").json()["participant"]["id"]
    b = join(guest_client, m["meeting_code"], "Otto").json()["participant"]["id"]
    assert a == b


# ---- participants -----------------------------------------------------------


def test_list_participants_access(host_client, guest_client, other):
    m = host_client.post("/api/meetings/instant", json={}).json()
    code = m["meeting_code"]
    joined = join(guest_client, code, "Gus").json()

    # Host by session, guest by ticket. A stranger gets 403.
    assert len(host_client.get(f"/api/meetings/{code}/participants").json()) == 1
    ok = guest_client.get(
        f"/api/meetings/{code}/participants", params={"ticket": joined["ws_ticket"]}
    )
    assert ok.status_code == 200
    denied = guest_client.get(f"/api/meetings/{code}/participants")
    assert denied.status_code == 403
    assert denied.json()["code"] == "not_participant"

    # A ticket for another meeting does not work.
    other_m = host_client.post("/api/meetings/instant", json={}).json()
    wrong = guest_client.get(
        f"/api/meetings/{other_m['meeting_code']}/participants",
        params={"ticket": joined["ws_ticket"]},
    )
    assert wrong.status_code == 403


def test_host_mutes_participant(host_client, guest_client):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    pid = join(guest_client, code, "Gus").json()["participant"]["id"]
    r = host_client.post(f"/api/meetings/{code}/participants/{pid}/mute")
    assert r.status_code == 200
    assert r.json()["is_muted"] is True


def test_guest_cannot_control(host_client, guest_client, other):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    pid = join(guest_client, code, "Gus").json()["participant"]["id"]

    # No session at all.
    assert guest_client.post(f"/api/meetings/{code}/participants/{pid}/mute").status_code == 401
    # Signed in but not host or co-host.
    login_as(guest_client, other)
    r = guest_client.post(f"/api/meetings/{code}/participants/{pid}/mute")
    assert r.status_code == 403
    assert r.json()["code"] == "not_allowed"
    assert guest_client.post(f"/api/meetings/{code}/mute-all").status_code == 403


def test_co_host_can_mute_all_attendees_only(host_client, guest_client, other, db_session):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    host_pid = join(host_client, code, "Hana").json()["participant"]["id"]
    login_as(guest_client, other)
    co_pid = join(guest_client, code, "Otto").json()["participant"]["id"]
    db_session.get(Participant, co_pid).role = ParticipantRole.co_host
    db_session.commit()
    third = make_user(db_session, "third@example.com", "Thea")
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as third_client:
        login_as(third_client, third)
        third_pid = join(third_client, code, "Thea").json()["participant"]["id"]

    r = guest_client.post(f"/api/meetings/{code}/mute-all")
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [third_pid]
    assert db_session.get(Participant, third_pid).is_muted is True
    assert db_session.get(Participant, host_pid).is_muted is False
    assert db_session.get(Participant, co_pid).is_muted is False


def test_remove_participant(host_client, guest_client, other):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    login_as(guest_client, other)
    pid = join(guest_client, code, "Otto").json()["participant"]["id"]

    r = host_client.post(f"/api/meetings/{code}/participants/{pid}/remove")
    assert r.status_code == 200
    assert host_client.get(f"/api/meetings/{code}/participants").json() == []

    # A removed signed-in user cannot come back.
    again = join(guest_client, code, "Otto")
    assert again.status_code == 403
    assert again.json()["code"] == "removed_from_meeting"


def test_cannot_remove_host_or_unknown_participant(host_client):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    host_pid = join(host_client, code, "Hana").json()["participant"]["id"]
    r = host_client.post(f"/api/meetings/{code}/participants/{host_pid}/remove")
    assert r.status_code == 403
    assert r.json()["code"] == "cannot_remove_host"
    assert host_client.post(f"/api/meetings/{code}/participants/999/remove").status_code == 404


def test_participant_from_other_meeting_is_404(host_client, guest_client):
    a = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    b = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    pid = join(guest_client, a).json()["participant"]["id"]
    assert host_client.post(f"/api/meetings/{b}/participants/{pid}/mute").status_code == 404


def test_controls_fail_after_meeting_ends(host_client, guest_client):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    pid = join(guest_client, code).json()["participant"]["id"]
    host_client.post(f"/api/meetings/{code}/end")
    assert host_client.post(f"/api/meetings/{code}/participants/{pid}/mute").status_code == 410
