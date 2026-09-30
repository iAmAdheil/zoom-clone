import time

import anyio
import pytest
from fastapi import WebSocketDisconnect
from sqlalchemy import func, select

from app.core.security import create_ws_ticket
from app.models import Participant
from app.services.room_manager import RoomManager
from app.services.ticket_registry import UsedTickets
from tests.conftest import login_as


def join(client, code, name="Guest", **extra) -> dict:
    r = client.post(f"/api/meetings/{code}/join", json={"display_name": name, **extra})
    assert r.status_code == 200, r.json()
    return r.json()


def new_meeting(client) -> str:
    return client.post("/api/meetings/instant", json={}).json()["meeting_code"]


def ws_path(code: str, ticket: str) -> str:
    return f"/ws/meetings/{code}?ticket={ticket}"


def ids(snapshot: dict) -> list[int]:
    assert snapshot["type"] == "snapshot"
    return [p["id"] for p in snapshot["participants"]]


def expect_close(ws, code: int, reason: str) -> None:
    with pytest.raises(WebSocketDisconnect) as info:
        ws.receive_json()
    assert (info.value.code, info.value.reason) == (code, reason)


def expect_joined(ws, pid: int) -> None:
    event = ws.receive_json()
    assert event["type"] == "participant_joined"
    assert event["participant"]["id"] == pid


def expect_updated(ws, pid: int, **fields) -> None:
    event = ws.receive_json()
    assert event["type"] == "participant_updated"
    assert event["participant"]["id"] == pid
    for name, value in fields.items():
        assert event["participant"][name] == value


def left(pid: int) -> dict:
    return {"type": "participant_left", "participant_id": pid}


# ---- happy path -------------------------------------------------------------


def test_happy_path(host_client, guest_client, db_session):
    code = new_meeting(host_client)
    host = join(host_client, code, "Hana")
    hid = host["participant"]["id"]

    with host_client.websocket_connect(ws_path(code, host["ws_ticket"])) as hws:
        assert ids(hws.receive_json()) == [hid]

        guest = join(guest_client, code, "Gus")
        gid = guest["participant"]["id"]

        with guest_client.websocket_connect(ws_path(code, guest["ws_ticket"])) as gws:
            assert ids(gws.receive_json()) == [hid, gid]
            # The host hears about the guest when the guest's socket opens, not at REST join.
            expect_joined(hws, gid)

            gws.send_json({"type": "set_muted", "value": True})
            for ws in (gws, hws):
                expect_updated(ws, gid, is_muted=True, is_video_off=False)

            gws.send_json({"type": "set_video_off", "value": True})
            for ws in (gws, hws):
                expect_updated(ws, gid, is_muted=True, is_video_off=True)

            gws.send_json({"type": "set_muted"})  # no value
            assert gws.receive_json()["code"] == "bad_event"

            gws.send_json({"type": "leave"})
            expect_close(gws, 1000, "left")

        assert hws.receive_json() == left(gid)

    row = db_session.get(Participant, gid)
    assert row.left_at is not None
    assert (row.is_muted, row.is_video_off) == (True, True)


# ---- ticket checks ----------------------------------------------------------


def test_bad_ticket_is_rejected(host_client, settings, monkeypatch):
    code = new_meeting(host_client)
    joined = join(host_client, code, "Hana")
    monkeypatch.setattr(settings, "ws_ticket_seconds", -1)
    expired = create_ws_ticket(joined["participant"]["id"], joined["meeting"]["id"])

    for path in (
        f"/ws/meetings/{code}",
        ws_path(code, "not-a-token"),
        ws_path(code, expired),
        ws_path(code, joined["rejoin_token"]),  # a different token type
    ):
        with host_client.websocket_connect(path) as ws:
            expect_close(ws, 4401, "invalid_ticket")


def test_reused_ticket_is_rejected(host_client):
    code = new_meeting(host_client)
    ticket = join(host_client, code, "Hana")["ws_ticket"]

    with host_client.websocket_connect(ws_path(code, ticket)) as ws:
        assert ws.receive_json()["type"] == "snapshot"
    with host_client.websocket_connect(ws_path(code, ticket)) as ws:
        expect_close(ws, 4401, "ticket_used")


def test_ticket_for_another_meeting_is_rejected(host_client):
    a = new_meeting(host_client)
    b = new_meeting(host_client)
    ticket = join(host_client, a, "Hana")["ws_ticket"]
    with host_client.websocket_connect(ws_path(b, ticket)) as ws:
        expect_close(ws, 4403, "wrong_meeting")


def test_unknown_meeting_is_rejected(host_client):
    code = new_meeting(host_client)
    ticket = join(host_client, code, "Hana")["ws_ticket"]
    with host_client.websocket_connect(ws_path("0000000000", ticket)) as ws:
        expect_close(ws, 4404, "meeting_not_found")


def test_used_tickets_forget_expired_ids():
    tickets = UsedTickets()
    assert tickets.claim("a", time.time() + 60) is True
    assert tickets.claim("a", time.time() + 60) is False
    assert tickets.claim("old", time.time() - 1) is True
    assert tickets.claim("b", time.time() + 60) is True
    assert len(tickets) == 2  # "old" expired and is gone


# ---- host actions -----------------------------------------------------------


def test_removed_participant_is_closed_and_cannot_connect(host_client, guest_client, other):
    login_as(guest_client, other)
    code = new_meeting(host_client)
    host = join(host_client, code, "Hana")

    with host_client.websocket_connect(ws_path(code, host["ws_ticket"])) as hws:
        hws.receive_json()
        guest = join(guest_client, code, "Otto")
        gid = guest["participant"]["id"]

        with guest_client.websocket_connect(ws_path(code, guest["ws_ticket"])) as gws:
            gws.receive_json()
            expect_joined(hws, gid)
            spare = join(guest_client, code, "Otto")  # same row, an unused ticket
            r = host_client.post(f"/api/meetings/{code}/participants/{gid}/remove")
            assert r.status_code == 200
            assert gws.receive_json() == {"type": "you_were_removed", "participant_id": gid}
            expect_close(gws, 4403, "removed_from_meeting")

        # The host gets `participant_left`, not `you_were_removed`.
        assert hws.receive_json() == left(gid)

    with guest_client.websocket_connect(ws_path(code, spare["ws_ticket"])) as ws:
        expect_close(ws, 4403, "removed_from_meeting")


def test_removed_guest_cannot_rejoin_with_token(host_client, guest_client):
    code = new_meeting(host_client)
    guest = join(guest_client, code, "Gus")
    host_client.post(f"/api/meetings/{code}/participants/{guest['participant']['id']}/remove")
    r = guest_client.post(
        f"/api/meetings/{code}/join",
        json={"display_name": "Gus", "rejoin_token": guest["rejoin_token"]},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "removed_from_meeting"


def test_mute_all_reaches_every_socket(host_client, guest_client, db_session):
    code = new_meeting(host_client)
    host = join(host_client, code, "Hana")

    with host_client.websocket_connect(ws_path(code, host["ws_ticket"])) as hws:
        hws.receive_json()
        guest = join(guest_client, code, "Gus")
        gid = guest["participant"]["id"]

        with guest_client.websocket_connect(ws_path(code, guest["ws_ticket"])) as gws:
            gws.receive_json()
            expect_joined(hws, gid)
            assert host_client.post(f"/api/meetings/{code}/mute-all").status_code == 200
            for ws in (hws, gws):
                assert ws.receive_json() == {"type": "mute_all", "participant_ids": [gid]}

            host_client.post(f"/api/meetings/{code}/participants/{gid}/mute")
            for ws in (hws, gws):
                expect_updated(ws, gid, is_muted=True)

    assert db_session.get(Participant, gid).is_muted is True


def test_end_meeting_closes_every_socket(host_client, guest_client):
    code = new_meeting(host_client)
    host = join(host_client, code, "Hana")

    with host_client.websocket_connect(ws_path(code, host["ws_ticket"])) as hws:
        hws.receive_json()
        guest = join(guest_client, code, "Gus")
        late = join(guest_client, code, "Late")  # never connects before the end

        with guest_client.websocket_connect(ws_path(code, guest["ws_ticket"])) as gws:
            # The snapshot lists the connected people only. "Late" has no socket.
            assert len(ids(gws.receive_json())) == 2
            expect_joined(hws, guest["participant"]["id"])
            assert host_client.post(f"/api/meetings/{code}/end").status_code == 200
            for ws in (hws, gws):
                assert ws.receive_json() == {"type": "meeting_ended"}
                expect_close(ws, 4410, "meeting_ended")

    with guest_client.websocket_connect(ws_path(code, late["ws_ticket"])) as ws:
        expect_close(ws, 4410, "meeting_ended")


# ---- drops and reconnects ---------------------------------------------------


def test_drop_then_rejoin_keeps_one_row(host_client, guest_client, db_session):
    code = new_meeting(host_client)
    host = join(host_client, code, "Hana")
    hid = host["participant"]["id"]

    with host_client.websocket_connect(ws_path(code, host["ws_ticket"])) as hws:
        hws.receive_json()
        first = join(guest_client, code, "Gus")
        gid = first["participant"]["id"]

        with guest_client.websocket_connect(ws_path(code, first["ws_ticket"])) as gws:
            gws.receive_json()
            expect_joined(hws, gid)
        # The socket dropped without `leave`.
        assert hws.receive_json() == left(gid)
        assert db_session.get(Participant, gid).left_at is not None

        again = join(guest_client, code, "Gus", rejoin_token=first["rejoin_token"])
        assert again["participant"]["id"] == gid

        with guest_client.websocket_connect(ws_path(code, again["ws_ticket"])) as gws:
            assert ids(gws.receive_json()) == [hid, gid]
            expect_joined(hws, gid)

    rows = db_session.scalar(select(func.count()).select_from(Participant))
    assert rows == 2


def test_reconnect_before_drop_is_seen_keeps_participant(
    host_client, guest_client, other, db_session
):
    """A new socket opens while the old one is still open (a half-open drop or a second tab)."""
    login_as(guest_client, other)
    code = new_meeting(host_client)
    host = join(host_client, code, "Hana")

    with host_client.websocket_connect(ws_path(code, host["ws_ticket"])) as hws:
        hws.receive_json()
        a = join(guest_client, code, "Otto")
        pid = a["participant"]["id"]
        b = join(guest_client, code, "Otto")
        assert b["participant"]["id"] == pid  # no new row

        with guest_client.websocket_connect(ws_path(code, a["ws_ticket"])) as ws1:
            ws1.receive_json()
            expect_joined(hws, pid)  # the first socket only. The second one sends nothing.
            with guest_client.websocket_connect(ws_path(code, b["ws_ticket"])) as ws2:
                assert ids(ws2.receive_json()) == [host["participant"]["id"], pid]
            # One socket is still open, so the participant stays in the room.
            assert db_session.get(Participant, pid).left_at is None
            ws1.send_json({"type": "set_muted", "value": True})
            expect_updated(hws, pid, is_muted=True)  # not participant_left
            expect_updated(ws1, pid, is_muted=True)

        assert hws.receive_json() == left(pid)


def test_fresh_ticket_after_leave_brings_the_row_back(host_client, guest_client, other):
    login_as(guest_client, other)
    code = new_meeting(host_client)
    host = join(host_client, code, "Hana")

    with host_client.websocket_connect(ws_path(code, host["ws_ticket"])) as hws:
        hws.receive_json()
        a = join(guest_client, code, "Otto")
        pid = a["participant"]["id"]
        b = join(guest_client, code, "Otto")  # a second tab gets a ticket

        with guest_client.websocket_connect(ws_path(code, a["ws_ticket"])) as ws1:
            ws1.receive_json()
            expect_joined(hws, pid)
            ws1.send_json({"type": "leave"})
            expect_close(ws1, 1000, "left")
        assert hws.receive_json() == left(pid)

        with guest_client.websocket_connect(ws_path(code, b["ws_ticket"])) as ws2:
            assert pid in ids(ws2.receive_json())
            expect_joined(hws, pid)


# ---- room manager -----------------------------------------------------------


def test_broadcast_works_from_async_and_sync_code():
    manager = RoomManager()

    async def main() -> None:
        conn = manager.connect("1234567890", 1)
        manager.broadcast("1234567890", {"n": 1})  # on the event loop
        await anyio.to_thread.run_sync(manager.broadcast, "1234567890", {"n": 2})  # in a thread
        assert await conn.queue.get() == {"n": 1}
        assert await conn.queue.get() == {"n": 2}
        assert manager.disconnect("1234567890", conn) is True
        assert manager.connections("1234567890") == []

    anyio.run(main)
