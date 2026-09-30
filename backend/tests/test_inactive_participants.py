"""Host actions on a participant who left or was removed."""

import pytest

from app.models import Participant
from app.services.meeting_service import now
from app.services.room_manager import room_manager
from tests.conftest import login_as


def _join(client, code, name="Gus"):
    r = client.post(f"/api/meetings/{code}/join", json={"display_name": name})
    return r.json()["participant"]["id"]


@pytest.fixture
def events(monkeypatch):
    """Record every event that the room manager would send."""
    sent: list = []
    monkeypatch.setattr(room_manager, "broadcast", lambda code, event: sent.append(event))
    monkeypatch.setattr(room_manager, "send_to_participant", lambda c, p, e: sent.append(e))
    monkeypatch.setattr(room_manager, "close_participant", lambda *a: sent.append(("close", a)))
    return sent


def _leave(db_session, pid):
    db_session.get(Participant, pid).left_at = now()
    db_session.commit()


@pytest.mark.parametrize("action", ["mute", "remove"])
def test_action_on_left_participant_is_409(host_client, guest_client, db_session, events, action):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    pid = _join(guest_client, code)
    _leave(db_session, pid)
    events.clear()

    r = host_client.post(f"/api/meetings/{code}/participants/{pid}/{action}")
    assert r.status_code == 409
    assert r.json()["code"] == "participant_not_in_meeting"
    assert events == []
    participant = db_session.get(Participant, pid)
    assert participant.is_muted is False
    assert participant.removed is False


@pytest.mark.parametrize("action", ["mute", "remove"])
def test_action_on_removed_participant_is_409(host_client, guest_client, events, action):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    pid = _join(guest_client, code)
    assert host_client.post(f"/api/meetings/{code}/participants/{pid}/remove").status_code == 200
    events.clear()

    r = host_client.post(f"/api/meetings/{code}/participants/{pid}/{action}")
    assert r.status_code == 409
    assert r.json()["code"] == "participant_not_in_meeting"
    assert events == []


def test_mute_all_skips_left_and_removed(host_client, guest_client, db_session, other, events):
    code = host_client.post("/api/meetings/instant", json={}).json()["meeting_code"]
    active = _join(guest_client, code, "Active")
    left = _join(guest_client, code, "Left")
    login_as(guest_client, other)
    removed = _join(guest_client, code, "Removed")
    _leave(db_session, left)
    host_client.post(f"/api/meetings/{code}/participants/{removed}/remove")
    events.clear()

    r = host_client.post(f"/api/meetings/{code}/mute-all")
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == [active]
    assert events == [{"type": "mute_all", "participant_ids": [active]}]
    assert db_session.get(Participant, left).is_muted is False
    assert db_session.get(Participant, removed).is_muted is False
