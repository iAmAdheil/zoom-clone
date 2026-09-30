"""BUG-01 (ghost participants) and BUG-12 (meetings that never end)."""

import asyncio
from contextlib import ExitStack, nullcontext
from datetime import timedelta

from fastapi.testclient import TestClient

from app import main
from app.models import Meeting, MeetingStatus, Participant
from app.services import reaper
from app.services.meeting_service import now
from app.services.presence import PendingJoins
from tests.conftest import _client, schedule_body
from tests.test_signaling import connect, sync
from tests.test_ws import expect_close, expect_joined, ids, join, new_meeting, ws_path


def participant_ids(client, code, **params) -> list[int]:
    r = client.get(f"/api/meetings/{code}/participants", params=params)
    assert r.status_code == 200, r.json()
    return [p["id"] for p in r.json()]


def meeting_row(db_session, code) -> Meeting:
    return db_session.query(Meeting).filter_by(meeting_code=code).one()


# ---- BUG-01: presence -------------------------------------------------------


def test_rest_join_alone_sends_no_event(host_client, guest_client):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        join(guest_client, code, "Ghost")  # REST only. The tab closes at the pre-join.
        sync(hws)  # the host's next message is its own error: no participant_joined came


def test_first_socket_sends_participant_joined_to_the_others_only(host_client, guest_client):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        gid, gws, snap = connect(guest_client, code, "Gus", stack)
        assert snap["connected_ids"] == [hid, gid]
        expect_joined(hws, gid)
        sync(gws)  # the guest does not get an event about itself


def test_participants_list_hides_ghosts_after_the_grace(
    host_client, guest_client, settings, monkeypatch
):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, _, _ = connect(host_client, code, "Hana", stack)
        ghost = join(guest_client, code, "Ghost")
        gid = ghost["participant"]["id"]

        # Inside the grace time the new guest is listed (the socket may open soon).
        assert participant_ids(host_client, code) == [hid, gid]
        assert participant_ids(guest_client, code, ticket=ghost["ws_ticket"]) == [hid, gid]

        # After the grace time a guest with no socket is not listed, even before the reaper.
        monkeypatch.setattr(settings, "presence_grace_seconds", 0)
        assert participant_ids(host_client, code) == [hid]


def test_reaper_closes_the_ghost_and_a_late_joiner_does_not_see_it(
    host_client, guest_client, db_session, settings, monkeypatch
):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        gid = join(guest_client, code, "Ghost")["participant"]["id"]

        # Pending ghosts stay until the grace time passes.
        assert reaper.reap_once(db_session).ghost_ids == []
        assert db_session.get(Participant, gid).left_at is None

        monkeypatch.setattr(settings, "presence_grace_seconds", 0)
        result = reaper.reap_once(db_session)
        assert result.ghost_ids == [gid]
        sync(hws)  # the host never heard of the ghost, so it gets no event now either
        assert db_session.get(Participant, gid).left_at is not None
        assert db_session.get(Participant, hid).left_at is None  # connected, so kept

        late_client = stack.enter_context(_client(db_session))
        lid, _, snap = connect(late_client, code, "Late", stack)
        assert ids(snap) == [hid, lid]
        assert participant_ids(host_client, code) == [hid, lid]


def test_reaped_guest_comes_back_with_the_rejoin_token(
    host_client, guest_client, db_session, settings, monkeypatch
):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        first = join(guest_client, code, "Gus")
        gid = first["participant"]["id"]
        monkeypatch.setattr(settings, "presence_grace_seconds", 0)
        assert reaper.reap_once(db_session).ghost_ids == [gid]

        monkeypatch.setattr(settings, "presence_grace_seconds", 60)
        again = join(guest_client, code, "Gus", rejoin_token=first["rejoin_token"])
        assert again["participant"]["id"] == gid
        assert db_session.get(Participant, gid).left_at is None
        with guest_client.websocket_connect(ws_path(code, again["ws_ticket"])) as gws:
            assert ids(gws.receive_json()) == [hid, gid]
            expect_joined(hws, gid)


def test_ticket_used_after_the_reaper_brings_the_row_back(
    host_client, guest_client, db_session, settings, monkeypatch
):
    """The reaper may close a row a moment before its ticket is used. The socket wins."""
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        slow = join(guest_client, code, "Slow")
        sid = slow["participant"]["id"]
        monkeypatch.setattr(settings, "presence_grace_seconds", 0)
        reaper.reap_once(db_session)

        with guest_client.websocket_connect(ws_path(code, slow["ws_ticket"])) as sws:
            assert ids(sws.receive_json()) == [hid, sid]
            expect_joined(hws, sid)
        assert db_session.get(Participant, sid).left_at is not None  # left again at close


def test_reaper_leaves_ended_meetings_alone(
    host_client, guest_client, db_session, settings, monkeypatch
):
    code = new_meeting(host_client)
    join(guest_client, code, "Gus")
    host_client.post(f"/api/meetings/{code}/end")
    monkeypatch.setattr(settings, "presence_grace_seconds", 0)
    assert reaper.reap_once(db_session).ghost_ids == []


def test_pending_joins_expire_after_the_grace(settings, monkeypatch):
    clock = [100.0]
    joins = PendingJoins(clock=lambda: clock[0])
    monkeypatch.setattr(settings, "presence_grace_seconds", 60)
    joins.add(7)
    assert joins.is_pending(7)
    clock[0] += 59
    assert joins.is_pending(7)
    clock[0] += 1
    assert not joins.is_pending(7)
    joins.forget_expired()
    assert len(joins._since) == 0


# ---- BUG-12: forgotten meetings ---------------------------------------------


def test_empty_live_meeting_ends_after_ten_idle_minutes(host_client, db_session):
    code = new_meeting(host_client)  # instant: live at once, the host never joins
    assert reaper.reap_once(db_session, at=now() + timedelta(minutes=9)).ended_codes == []
    result = reaper.reap_once(db_session, at=now() + timedelta(minutes=11))
    assert result.ended_codes == [code]
    meeting = meeting_row(db_session, code)
    assert meeting.status == MeetingStatus.ended
    assert meeting.ended_at is not None


def test_idle_time_counts_from_the_last_leave(host_client, db_session):
    code = new_meeting(host_client)
    joined = join(host_client, code, "Hana")
    with host_client.websocket_connect(ws_path(code, joined["ws_ticket"])) as ws:
        ws.receive_json()
    left_at = db_session.get(Participant, joined["participant"]["id"]).left_at
    meeting = meeting_row(db_session, code)
    meeting.started_at = meeting.created_at = left_at - timedelta(hours=2)
    db_session.commit()

    assert reaper.reap_once(db_session, at=left_at + timedelta(minutes=9)).ended_codes == []
    assert reaper.reap_once(db_session, at=left_at + timedelta(minutes=10)).ended_codes == [code]


def test_meeting_with_a_connected_person_does_not_end(host_client, db_session):
    code = new_meeting(host_client)
    joined = join(host_client, code, "Hana")
    with host_client.websocket_connect(ws_path(code, joined["ws_ticket"])) as ws:
        ws.receive_json()
        assert reaper.reap_once(db_session, at=now() + timedelta(hours=3)).ended_codes == []
        assert meeting_row(db_session, code).status == MeetingStatus.live


def test_meeting_with_a_pending_join_does_not_end(host_client, guest_client, db_session):
    code = new_meeting(host_client)
    meeting = meeting_row(db_session, code)
    meeting.started_at = meeting.created_at = now() - timedelta(hours=1)
    db_session.commit()
    join(guest_client, code, "Gus")  # the socket opens soon
    assert reaper.reap_once(db_session, at=now() + timedelta(seconds=5)).ended_codes == []


def test_meeting_live_for_24_hours_ends_and_sockets_close(host_client, db_session):
    code = new_meeting(host_client)
    joined = join(host_client, code, "Hana")
    with host_client.websocket_connect(ws_path(code, joined["ws_ticket"])) as ws:
        ws.receive_json()
        result = reaper.reap_once(db_session, at=now() + timedelta(hours=24, minutes=1))
        assert result.ended_codes == [code]
        assert ws.receive_json() == {"type": "meeting_ended"}
        expect_close(ws, 4410, "meeting_ended")
    assert meeting_row(db_session, code).status == MeetingStatus.ended


def test_scheduled_meeting_is_not_changed(host_client, db_session):
    code = host_client.post("/api/meetings", json=schedule_body()).json()["meeting_code"]
    assert reaper.reap_once(db_session, at=now() + timedelta(days=3)).ended_codes == []
    assert meeting_row(db_session, code).status == MeetingStatus.scheduled


# ---- the background task ----------------------------------------------------


def test_run_reaper_runs_rounds_and_survives_an_error(db_session, monkeypatch):
    calls = []

    def fake_reap_once(db):
        calls.append(db)
        if len(calls) == 1:
            raise RuntimeError("boom")
        return reaper.ReapResult()

    monkeypatch.setattr(reaper, "reap_once", fake_reap_once)

    async def run() -> None:
        task = asyncio.create_task(reaper.run_reaper(lambda: nullcontext(db_session), 0.01))
        for _ in range(200):
            if len(calls) >= 3:
                break
            await asyncio.sleep(0.01)
        task.cancel()

    asyncio.run(run())
    assert len(calls) >= 3  # the first round failed, and the loop went on
    assert all(db is db_session for db in calls)


def test_lifespan_starts_and_stops_the_reaper(settings, monkeypatch):
    events = []

    async def fake_run_reaper(open_db, interval):
        events.append(("start", interval))
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            events.append(("stop", interval))
            raise

    monkeypatch.setattr(main, "run_reaper", fake_run_reaper)
    monkeypatch.setattr(settings, "reaper_interval_seconds", 15)
    with TestClient(main.app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
    assert events == [("start", 15), ("stop", 15)]
