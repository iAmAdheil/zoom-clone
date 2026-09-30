"""BUG-11 (sockets per participant), BUG-21 (strict WebSocket types and error order)
and BUG-23 (meeting codes with letters)."""

from contextlib import ExitStack

import anyio
import pytest
from fastapi import WebSocketDisconnect

from app.services.room_manager import Close, RoomManager
from app.services.room_service import MAX_SIGNAL_BYTES
from tests.conftest import login_as
from tests.test_signaling import connect, signal, sync
from tests.test_ws import expect_close, expect_joined, join, new_meeting, ws_path

# ---- BUG-11: at most 3 sockets per participant ------------------------------


def test_fourth_socket_closes_the_oldest(host_client, guest_client, other, settings):
    assert settings.max_sockets_per_participant == 3
    login_as(guest_client, other)
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        tickets = [join(guest_client, code, "Otto")["ws_ticket"] for _ in range(4)]
        sockets = []
        for ticket in tickets[:3]:
            ws = stack.enter_context(guest_client.websocket_connect(ws_path(code, ticket)))
            ws.receive_json()
            sockets.append(ws)
        pid = join(guest_client, code, "Otto")["participant"]["id"]
        expect_joined(hws, pid)  # once, for the first socket

        newest = stack.enter_context(guest_client.websocket_connect(ws_path(code, tickets[3])))
        assert newest.receive_json()["type"] == "snapshot"
        expect_close(sockets[0], 4403, "too_many_connections")

        # The others stay open, and the participant is still in the room.
        for ws in (*sockets[1:], newest):
            sync(ws)
        sync(hws)  # no participant_left: other sockets of the participant are open


def test_room_manager_caps_sockets_per_participant():
    manager = RoomManager()

    async def main() -> None:
        conns = [manager.connect("1234567890", 7, max_per_participant=2) for _ in range(4)]
        other = manager.connect("1234567890", 8, max_per_participant=2)
        assert [c.first for c in conns] == [True, False, False, False]
        assert other.first is True
        # The two oldest got a Close. Each socket is closed once.
        for conn, expected in zip(conns, [True, True, False, False], strict=True):
            assert conn.evicted is expected
            if expected:
                assert await conn.queue.get() == Close(4403, "too_many_connections")
            assert conn.queue.empty()
        assert other.queue.empty()

    anyio.run(main)


# ---- BUG-21: strict types ---------------------------------------------------


@pytest.fixture
def room(host_client, guest_client):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        gid, gws, _ = connect(guest_client, code, "Gus", stack)
        expect_joined(hws, gid)
        yield {"code": code, "hid": hid, "gid": gid, "hws": hws, "gws": gws}


@pytest.mark.parametrize(
    "message",
    [
        {"type": "set_muted", "value": "yes"},
        {"type": "set_muted", "value": "true"},
        {"type": "set_muted", "value": 1},
        {"type": "set_muted", "value": None},
        {"type": "set_video_off", "value": 0},
        {"type": "signal", "to": 2.0, "data": {"a": 1}},
        {"type": "signal", "to": True, "data": {"a": 1}},
    ],
)
def test_loose_types_are_bad_event(room, message):
    room["gws"].send_json(message)
    reply = room["gws"].receive_json()
    assert (reply["type"], reply["code"]) == ("error", "bad_event")
    sync(room["hws"])  # no participant_updated went out


def test_real_bools_still_work(room):
    room["gws"].send_json({"type": "set_muted", "value": True})
    assert room["hws"].receive_json()["participant"]["is_muted"] is True


def test_size_is_checked_before_the_target(room):
    """A 17 KB signal to an unknown target gets payload_too_large, not bad_target."""
    data = {"k": "x" * (MAX_SIGNAL_BYTES + 100)}
    room["hws"].send_json(signal(999_999, data))
    assert room["hws"].receive_json()["code"] == "payload_too_large"


# ---- BUG-23: meeting codes --------------------------------------------------


def test_code_with_letters_is_404(host_client, guest_client):
    code = new_meeting(host_client)
    mixed = f"{code[:5]}abc{code[5:]}"
    for raw in (mixed, f"{code}x", f"x{code}", "abcdefghij", "١" + code[1:]):  # Arabic-Indic one
        r = guest_client.get(f"/api/meetings/{raw}")
        assert r.status_code == 404, raw
        assert r.json()["code"] == "meeting_not_found"
    r = guest_client.post(f"/api/meetings/{mixed}/join", json={"display_name": "G"})
    assert r.status_code == 404


def test_code_with_spaces_or_dashes_is_found(host_client, guest_client):
    code = new_meeting(host_client)
    for raw in (f"{code[:3]} {code[3:7]} {code[7:]}", f"{code[:3]}-{code[3:7]}-{code[7:]}"):
        assert guest_client.get(f"/api/meetings/{raw}").status_code == 200, raw


def test_websocket_with_a_code_with_letters_is_4404(host_client):
    code = new_meeting(host_client)
    ticket = join(host_client, code, "Hana")["ws_ticket"]
    with host_client.websocket_connect(ws_path(f"{code}abc", ticket)) as ws:
        with pytest.raises(WebSocketDisconnect) as info:
            ws.receive_json()
    assert (info.value.code, info.value.reason) == (4404, "meeting_not_found")
