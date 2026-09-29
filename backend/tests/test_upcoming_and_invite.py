from datetime import UTC, datetime, timedelta

from app.models import Meeting, MeetingAccess, MeetingStatus, MeetingType
from tests.conftest import login_as, schedule_body

_codes = iter(range(1_000_000_000, 2_000_000_000))


def _schedule_at(db_session, host, start: datetime, duration_min, title: str) -> Meeting:
    """Insert a scheduled meeting directly. The API refuses a start time in the past."""
    meeting = Meeting(
        meeting_code=str(next(_codes)),
        host_id=host.id,
        title=title,
        type=MeetingType.scheduled,
        status=MeetingStatus.scheduled,
        access=MeetingAccess.allow_guests,
        scheduled_start=start,
        duration_min=duration_min,
        timezone="UTC",
    )
    db_session.add(meeting)
    db_session.commit()
    return meeting


def _titles(resp) -> list[str]:
    assert resp.status_code == 200
    return [m["title"] for m in resp.json()]


# ---- upcoming and recent window --------------------------------------------


def test_meeting_stays_upcoming_until_its_end(host_client, host, db_session):
    ago = datetime.now(UTC) - timedelta(minutes=10)
    _schedule_at(db_session, host, ago, 30, "Running")  # ends in 20 minutes
    _schedule_at(db_session, host, ago - timedelta(hours=1), 30, "Over")  # ended 40 minutes ago

    assert _titles(host_client.get("/api/meetings/upcoming")) == ["Running"]
    assert _titles(host_client.get("/api/meetings/recent")) == ["Over"]


def test_null_duration_uses_a_15_minute_grace(host_client, host, db_session):
    now = datetime.now(UTC)
    _schedule_at(db_session, host, now - timedelta(minutes=10), None, "Inside")
    _schedule_at(db_session, host, now - timedelta(minutes=20), None, "Outside")

    assert _titles(host_client.get("/api/meetings/upcoming")) == ["Inside"]
    recent = host_client.get("/api/meetings/recent").json()
    assert [(m["title"], m["status"]) for m in recent] == [("Outside", "scheduled")]


def test_lapsed_meeting_keeps_status_scheduled(host_client, host, db_session):
    past = datetime.now(UTC) - timedelta(hours=3)
    lapsed = _schedule_at(db_session, host, past, 30, "Lapsed")
    started = _schedule_at(db_session, host, past, 30, "Started")
    started.status = MeetingStatus.live
    started.started_at = past
    db_session.commit()

    assert _titles(host_client.get("/api/meetings/upcoming")) == []
    recent = host_client.get("/api/meetings/recent").json()
    assert {m["id"]: m["status"] for m in recent} == {lapsed.id: "scheduled", started.id: "live"}


def test_future_meeting_is_upcoming_and_not_recent(host_client, host, db_session):
    _schedule_at(db_session, host, datetime.now(UTC) + timedelta(hours=1), 30, "Later")
    assert _titles(host_client.get("/api/meetings/recent")) == []
    assert _titles(host_client.get("/api/meetings/upcoming")) == ["Later"]


# ---- invite link ------------------------------------------------------------


def test_invite_link_has_the_passcode_only_for_the_host(host_client, other, guest_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="a b&c")).json()
    code = m["meeting_code"]
    assert m["invite_link"] == f"http://localhost:3000/j/{code}?pwd=a%20b%26c"
    assert host_client.get("/api/meetings/upcoming").json()[0]["invite_link"] == m["invite_link"]

    # The public lookup shows no passcode.
    assert "a b&c" not in guest_client.get(f"/api/meetings/{code}").text

    # A guest gets a link without the passcode.
    body = {"display_name": "Gus", "passcode": "a b&c"}
    joined = guest_client.post(f"/api/meetings/{code}/join", json=body).json()
    assert joined["meeting"]["invite_link"] == f"http://localhost:3000/j/{code}"

    # A signed-in user who is not the host gets no passcode in the link either.
    login_as(guest_client, other)
    joined = guest_client.post(f"/api/meetings/{code}/join", json=body).json()
    assert "pwd" not in joined["meeting"]["invite_link"]
    recent = guest_client.get("/api/meetings/recent").json()
    assert all("pwd" not in x["invite_link"] for x in recent)


def test_host_join_response_has_the_passcode_link(host_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="abc")).json()
    joined = host_client.post(
        f"/api/meetings/{m['meeting_code']}/join", json={"display_name": "Hana"}
    ).json()
    assert joined["meeting"]["invite_link"].endswith("?pwd=abc")


def test_invite_link_without_a_passcode_has_no_pwd(host_client):
    m = host_client.post("/api/meetings", json=schedule_body()).json()
    assert m["invite_link"] == f"http://localhost:3000/j/{m['meeting_code']}"


def test_join_accepts_the_passcode_from_the_link(host_client, guest_client):
    m = host_client.post("/api/meetings", json=schedule_body(passcode="s3cret")).json()
    pwd = m["invite_link"].split("?pwd=")[1]
    url = f"/api/meetings/{m['meeting_code']}/join"
    assert guest_client.post(url, json={"display_name": "G", "passcode": pwd}).status_code == 200
    assert guest_client.post(url, json={"display_name": "G"}).status_code == 403
