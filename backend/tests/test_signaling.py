"""The WebRTC signaling relay on the meeting WebSocket."""

from contextlib import ExitStack

import pytest

from app.models import Participant
from app.services.room_service import MAX_SIGNAL_BYTES
from tests.conftest import _client
from tests.test_ws import expect_close, expect_joined, join, left, new_meeting, ws_path


def connect(client, code, name, stack: ExitStack):
    """Join, open the socket, and read the snapshot. Return (participant id, socket, snapshot)."""
    joined = join(client, code, name)
    ws = stack.enter_context(client.websocket_connect(ws_path(code, joined["ws_ticket"])))
    return joined["participant"]["id"], ws, ws.receive_json()


def sync(ws) -> None:
    """Send a bad event and wait for its error. The socket handled every earlier message."""
    ws.send_json({"type": "nope"})
    assert ws.receive_json()["code"] == "bad_event"


def signal(to, data=None) -> dict:
    return {"type": "signal", "to": to, "data": {"sdp": "v=0"} if data is None else data}


@pytest.fixture
def room(host_client, guest_client):
    """A meeting with the host and one guest connected. Yields the ids and the sockets."""
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        gid, gws, snap = connect(guest_client, code, "Gus", stack)
        expect_joined(hws, gid)
        assert snap["connected_ids"] == [hid, gid]
        yield {"code": code, "hid": hid, "gid": gid, "hws": hws, "gws": gws}


# ---- relay ------------------------------------------------------------------


def test_two_clients_exchange_a_signal(room):
    hws, gws, hid, gid = room["hws"], room["gws"], room["hid"], room["gid"]
    offer = {"kind": "offer", "sdp": "v=0", "nested": {"a": [1, 2, None]}}

    hws.send_json(signal(gid, offer))
    assert gws.receive_json() == {"type": "signal", "from": hid, "data": offer}

    answer = {"kind": "answer", "sdp": "v=1"}
    gws.send_json(signal(hid, answer))
    assert hws.receive_json() == {"type": "signal", "from": gid, "data": answer}


def test_signal_goes_to_the_target_only(host_client, guest_client, db_session):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        gid, gws, _ = connect(guest_client, code, "Gus", stack)
        expect_joined(hws, gid)
        third_client = stack.enter_context(_client(db_session))
        tid, tws, snap = connect(third_client, code, "Tia", stack)
        expect_joined(hws, tid)
        expect_joined(gws, tid)
        assert snap["connected_ids"] == [hid, gid, tid]

        hws.send_json(signal(gid))
        assert gws.receive_json()["from"] == hid
        sync(tws)  # Tia's next message is her own error, so she got no signal.
        sync(hws)


def test_data_is_relayed_unchanged(room):
    data = {"a": {"b": [1, "two", 3.5, True, None]}, "unicode": "é中", "empty": {}}
    room["hws"].send_json(signal(room["gid"], data))
    assert room["gws"].receive_json()["data"] == data


# ---- bad targets ------------------------------------------------------------


def test_unknown_target_is_bad_target(room):
    room["hws"].send_json(signal(999_999))
    reply = room["hws"].receive_json()
    assert reply["type"] == "error"
    assert reply["code"] == "bad_target"
    sync(room["gws"])  # the guest got nothing before its own error


def test_signal_to_self_is_bad_target(room):
    room["hws"].send_json(signal(room["hid"]))
    assert room["hws"].receive_json()["code"] == "bad_target"


def test_participant_who_is_not_connected_is_bad_target(room, guest_client):
    quiet = join(guest_client, room["code"], "Quiet")  # joined by REST, no socket
    room["hws"].send_json(signal(quiet["participant"]["id"]))
    assert room["hws"].receive_json()["code"] == "bad_target"


def test_target_in_another_meeting_is_bad_target(room, host_client, db_session):
    other_code = new_meeting(host_client)  # a second meeting, same host
    with ExitStack() as stack:
        client2 = stack.enter_context(_client(db_session))
        xid, xws, _ = connect(client2, other_code, "Xena", stack)
        assert xid not in (room["hid"], room["gid"])

        room["hws"].send_json(signal(xid))
        assert room["hws"].receive_json()["code"] == "bad_target"
        sync(xws)  # Xena's next message is her own error, so nothing crossed over.


def test_left_participant_cannot_receive(room):
    room["gws"].send_json({"type": "leave"})
    expect_close(room["gws"], 1000, "left")
    assert room["hws"].receive_json() == left(room["gid"])

    room["hws"].send_json(signal(room["gid"]))
    assert room["hws"].receive_json()["code"] == "bad_target"


def test_removed_participant_cannot_receive(room, host_client):
    r = host_client.post(f"/api/meetings/{room['code']}/participants/{room['gid']}/remove")
    assert r.status_code == 200
    assert room["hws"].receive_json() == left(room["gid"])

    room["hws"].send_json(signal(room["gid"]))
    assert room["hws"].receive_json()["code"] == "bad_target"


def test_removed_target_with_an_open_socket_is_bad_target(room, db_session):
    """The row says removed, but the close is still queued. The relay checks the row."""
    row = db_session.get(Participant, room["gid"])
    row.removed = True
    db_session.commit()

    room["hws"].send_json(signal(room["gid"]))
    assert room["hws"].receive_json()["code"] == "bad_target"
    sync(room["gws"])  # the guest got no signal


def test_removed_or_left_sender_cannot_send(room, db_session):
    row = db_session.get(Participant, room["gid"])
    row.removed = True
    db_session.commit()

    room["gws"].send_json(signal(room["hid"]))
    sync(room["gws"])  # the relay handled the signal, and it sent no error
    sync(room["hws"])  # the host got no signal before its own error


# ---- size and format --------------------------------------------------------


def _data_of_size(size: int) -> dict:
    overhead = len('{"k":""}')
    return {"k": "x" * (size - overhead)}


def test_data_at_the_limit_is_relayed(room):
    data = _data_of_size(MAX_SIGNAL_BYTES)
    room["hws"].send_json(signal(room["gid"], data))
    assert room["gws"].receive_json()["data"] == data


def test_oversize_data_is_rejected(room):
    room["hws"].send_json(signal(room["gid"], _data_of_size(MAX_SIGNAL_BYTES + 1)))
    reply = room["hws"].receive_json()
    assert (reply["type"], reply["code"]) == ("error", "payload_too_large")
    sync(room["gws"])  # nothing arrived
    # The socket stays open.
    room["hws"].send_json(signal(room["gid"]))
    assert room["gws"].receive_json()["type"] == "signal"


def test_huge_message_is_rejected_without_parsing(room):
    room["hws"].send_text("x" * 200_000)
    assert room["hws"].receive_json()["code"] == "payload_too_large"
    sync(room["hws"])


@pytest.mark.parametrize(
    "message",
    [
        {"type": "signal", "data": {"a": 1}},  # no target
        {"type": "signal", "to": "2", "data": {"a": 1}},  # target is not an integer
        {"type": "signal", "to": 2},  # no data
        {"type": "signal", "to": 2, "data": [1, 2]},  # data is not an object
        {"type": "signal", "to": 2, "data": "sdp"},
    ],
)
def test_malformed_signal_is_bad_event(room, message):
    room["hws"].send_json(message)
    assert room["hws"].receive_json()["code"] == "bad_event"


# ---- snapshot ---------------------------------------------------------------


def test_snapshot_lists_only_connected_participants(host_client, guest_client, db_session):
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, snap = connect(host_client, code, "Hana", stack)
        assert snap["connected_ids"] == [hid]

        quiet = join(guest_client, code, "Quiet")["participant"]["id"]  # REST only

        gid, _, snap = connect(stack.enter_context(_client(db_session)), code, "Gus", stack)
        assert snap["connected_ids"] == [hid, gid]
        # `participants` and `connected_ids` name the same people (BUG-01).
        assert [p["id"] for p in snap["participants"]] == [hid, gid]
        assert quiet not in snap["connected_ids"]
        expect_joined(hws, gid)  # the host heard about Gus only, never about Quiet
