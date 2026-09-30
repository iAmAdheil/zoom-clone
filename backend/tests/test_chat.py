"""In-meeting chat on the meeting WebSocket."""

from contextlib import ExitStack
from datetime import UTC, datetime

import pytest

from app.core.config import get_settings
from app.models import Participant
from app.services import rate_limit
from app.services.chat_history import MAX_HISTORY, ChatHistory, chat_history
from app.services.room_service import MAX_CHAT_CHARS, clean_chat_text
from tests.conftest import _client
from tests.test_signaling import connect, sync
from tests.test_ws import expect_close, expect_joined, new_meeting


@pytest.fixture(autouse=True)
def clean_chat_memory():
    chat_history._meetings.clear()
    yield
    chat_history._meetings.clear()


def chat(text, to=None) -> dict:
    return {"type": "chat", "text": text, "to": to}


@pytest.fixture
def room(host_client, guest_client):
    """A meeting with the host and one guest connected."""
    code = new_meeting(host_client)
    with ExitStack() as stack:
        hid, hws, _ = connect(host_client, code, "Hana", stack)
        gid, gws, _ = connect(guest_client, code, "Gus", stack)
        expect_joined(hws, gid)
        yield {"code": code, "hid": hid, "gid": gid, "hws": hws, "gws": gws}


@pytest.fixture
def trio(room, db_session):
    """The room plus a third participant, Tia."""
    with ExitStack() as stack:
        client = stack.enter_context(_client(db_session))
        tid, tws, _ = connect(client, room["code"], "Tia", stack)
        expect_joined(room["hws"], tid)
        expect_joined(room["gws"], tid)
        yield {**room, "tid": tid, "tws": tws}


# ---- send and receive -------------------------------------------------------


def test_two_clients_exchange_public_messages(room):
    hws, gws = room["hws"], room["gws"]
    hws.send_json(chat("Hello everyone"))
    got = gws.receive_json()
    assert got["type"] == "chat"
    assert got["from"] == room["hid"]
    assert got["from_name"] == "Hana"
    assert got["to"] is None
    assert got["text"] == "Hello everyone"
    assert len(got["id"]) == 36  # a uuid
    # The sender gets the same message (the echo), so its tabs all show it.
    assert hws.receive_json() == got

    gws.send_json(chat("Hi Hana"))
    reply = hws.receive_json()
    assert (reply["from"], reply["from_name"], reply["text"]) == (room["gid"], "Gus", "Hi Hana")
    assert gws.receive_json() == reply


def test_time_is_utc_iso(room):
    room["hws"].send_json(chat("time"))
    at = room["gws"].receive_json()["at"]
    assert at.endswith("Z")
    parsed = datetime.fromisoformat(at)
    assert parsed.tzinfo == UTC
    assert abs((datetime.now(UTC) - parsed).total_seconds()) < 30


def test_from_name_comes_from_the_server(room, db_session):
    # A client cannot set `from` or `from_name`. Extra fields are ignored, and the row wins.
    room["hws"].send_json({**chat("who am I"), "from": room["gid"], "from_name": "Mallory"})
    got = room["gws"].receive_json()
    assert (got["from"], got["from_name"]) == (room["hid"], "Hana")


def test_text_is_trimmed_and_control_characters_are_removed(room):
    room["hws"].send_json(chat("  hi\x00 \x07there\x1b[31m ‮gnp.exe\n\nnext\t\r\n  "))
    got = room["gws"].receive_json()
    assert got["text"] == "hi there[31m gnp.exe\n\nnext"


def test_clean_chat_text():
    assert clean_chat_text("  a  ") == "a"
    assert clean_chat_text("a\r\nb\rc") == "a\nb\nc"
    assert clean_chat_text("a\n\n\n\n\nb") == "a\n\nb"
    assert clean_chat_text("a\u0085b\u009fc\x7f") == "abc"
    # The zero width joiner stays, so emoji sequences work.
    assert clean_chat_text("\U0001f468‍\U0001f469") == "\U0001f468‍\U0001f469"
    assert clean_chat_text("\x00\x01 \n") == ""


def test_markup_is_stored_as_plain_text(room):
    payload = "<script>alert(1)</script><img src=x onerror=alert(1)> https://example.com"
    room["hws"].send_json(chat(payload))
    # The server does not change the markup. The client shows it as text (see the frontend tests).
    assert room["gws"].receive_json()["text"] == payload


def test_exactly_500_characters_is_allowed(room):
    room["hws"].send_json(chat("x" * MAX_CHAT_CHARS))
    assert len(room["gws"].receive_json()["text"]) == MAX_CHAT_CHARS


# ---- bad input --------------------------------------------------------------


def test_oversize_text_is_refused(room):
    hws, gws = room["hws"], room["gws"]
    hws.send_json(chat("x" * (MAX_CHAT_CHARS + 1)))
    reply = hws.receive_json()
    assert (reply["type"], reply["code"]) == ("error", "payload_too_large")
    sync(gws)  # the guest got nothing before its own error
    assert chat_history.visible_to(room["code"], room["gid"]) == []


def test_oversize_after_trim_counts_the_clean_text(room):
    # 500 real characters plus spaces and a control character is fine.
    room["hws"].send_json(chat("  " + "y" * MAX_CHAT_CHARS + " \x00 "))
    assert len(room["gws"].receive_json()["text"]) == MAX_CHAT_CHARS


def test_very_large_message_is_refused_before_parsing(room):
    room["hws"].send_json(chat("z" * 30_000))
    assert room["hws"].receive_json()["code"] == "payload_too_large"


@pytest.mark.parametrize("text", ["", "   ", "\n\t \x00\x01"])
def test_empty_text_is_refused(room, text):
    room["hws"].send_json(chat(text))
    reply = room["hws"].receive_json()
    assert (reply["type"], reply["code"]) == ("error", "bad_event")
    sync(room["gws"])


@pytest.mark.parametrize(
    "event",
    [
        {"type": "chat"},
        {"type": "chat", "text": 5},
        {"type": "chat", "text": None},
        {"type": "chat", "text": "hi", "to": "2"},
        {"type": "chat", "text": "hi", "to": True},
        {"type": "chat", "text": "hi", "to": 2.0},
    ],
)
def test_wrong_types_are_bad_event(room, event):
    room["hws"].send_json(event)
    assert room["hws"].receive_json()["code"] == "bad_event"


def test_missing_to_means_everyone(room):
    room["hws"].send_json({"type": "chat", "text": "no to field"})
    assert room["gws"].receive_json()["to"] is None


# ---- private messages -------------------------------------------------------


def test_private_message_goes_to_the_target_and_the_sender_only(trio):
    hws, gws, tws = trio["hws"], trio["gws"], trio["tws"]
    hws.send_json(chat("secret", to=trio["gid"]))
    got = gws.receive_json()
    assert (got["text"], got["to"], got["from"]) == ("secret", trio["gid"], trio["hid"])
    assert hws.receive_json() == got
    # Tia gets nothing. Her next message is her own error.
    sync(tws)
    # A public message after it reaches everyone, and Tia sees it first.
    hws.send_json(chat("public"))
    assert tws.receive_json()["text"] == "public"


def test_private_target_must_be_in_the_room(room):
    room["hws"].send_json(chat("to nobody", to=999_999))
    assert room["hws"].receive_json()["code"] == "bad_target"
    sync(room["gws"])


def test_private_message_to_myself_is_bad_target(room):
    room["hws"].send_json(chat("me", to=room["hid"]))
    assert room["hws"].receive_json()["code"] == "bad_target"


def test_private_message_to_a_participant_who_left_is_bad_target(room):
    gws = room["gws"]
    gws.send_json({"type": "leave"})
    expect_close(gws, 1000, "left")
    # Wait for the leave to finish, then the host is told.
    assert room["hws"].receive_json() == {"type": "participant_left", "participant_id": room["gid"]}
    room["hws"].send_json(chat("bye", to=room["gid"]))
    assert room["hws"].receive_json()["code"] == "bad_target"


def test_private_message_to_a_participant_of_another_meeting_is_bad_target(
    room, host_client, db_session
):
    with ExitStack() as stack:
        other = stack.enter_context(_client(db_session))
        code = new_meeting(host_client)
        oid, ows, _ = connect(other, code, "Olga", stack)
        room["hws"].send_json(chat("leak?", to=oid))
        assert room["hws"].receive_json()["code"] == "bad_target"
        sync(ows)


def test_all_sockets_of_a_participant_get_the_message(room, host_client, db_session):
    # The guest has a second tab. It is the same participant (same rejoin token).
    gid = room["gid"]
    with ExitStack() as stack:
        joined = _second_join(room, db_session)
        ws2 = stack.enter_context(
            host_client.websocket_connect(f"/ws/meetings/{room['code']}?ticket={joined}")
        )
        ws2.receive_json()  # snapshot
        room["hws"].send_json(chat("both tabs", to=gid))
        assert ws2.receive_json()["text"] == "both tabs"
        assert room["gws"].receive_json()["text"] == "both tabs"


def _second_join(room, db_session) -> str:
    from app.core.security import create_ws_ticket

    row = db_session.get(Participant, room["gid"])
    return create_ws_ticket(row.id, row.meeting_id)


# ---- rate limit -------------------------------------------------------------


def test_rate_limit_gives_rate_limited(room):
    hws, gws = room["hws"], room["gws"]
    limit = get_settings().chat_rate_limit_messages
    assert limit == 10
    for i in range(limit):
        hws.send_json(chat(f"m{i}"))
        assert gws.receive_json()["text"] == f"m{i}"
        assert hws.receive_json()["text"] == f"m{i}"
    hws.send_json(chat("one too many"))
    reply = hws.receive_json()
    assert (reply["type"], reply["code"]) == ("error", "rate_limited")
    # The guest is not limited by the host, and the socket stays open.
    gws.send_json(chat("still fine"))
    assert hws.receive_json()["text"] == "still fine"


def test_rate_limit_is_per_participant_and_frees_after_the_window(room, monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(rate_limit.chat_messages, "_clock", lambda: now[0])
    monkeypatch.setattr(get_settings(), "chat_rate_limit_messages", 2)
    monkeypatch.setattr(get_settings(), "chat_rate_limit_window_seconds", 10)
    hws, gws = room["hws"], room["gws"]
    for text in ("a", "b"):
        hws.send_json(chat(text))
        gws.receive_json()
        hws.receive_json()
    hws.send_json(chat("c"))
    assert hws.receive_json()["code"] == "rate_limited"
    now[0] += 10.5
    hws.send_json(chat("d"))
    assert gws.receive_json()["text"] == "d"


def test_rate_limit_can_be_turned_off(room, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_enabled", False)
    for i in range(15):
        room["hws"].send_json(chat(f"m{i}"))
        assert room["gws"].receive_json()["text"] == f"m{i}"
        room["hws"].receive_json()


# ---- left or removed senders ------------------------------------------------


def test_removed_sender_is_dropped(room, db_session):
    # Simulate the moment after the host removed the guest and before the socket closes.
    row = db_session.get(Participant, room["gid"])
    row.removed = True
    row.left_at = datetime.now(UTC)
    db_session.commit()
    room["gws"].send_json(chat("I am removed"))
    sync(room["hws"])  # the host got nothing before its own error
    assert chat_history.visible_to(room["code"], room["hid"]) == []


def test_real_removal_closes_the_socket_and_chat_stops(host_client, room):
    host_client.post(f"/api/meetings/{room['code']}/participants/{room['gid']}/remove")
    assert room["gws"].receive_json()["type"] == "you_were_removed"
    expect_close(room["gws"], 4403, "removed_from_meeting")
    assert chat_history.visible_to(room["code"], room["hid"]) == []


def test_sender_who_left_is_dropped(room, db_session):
    row = db_session.get(Participant, room["gid"])
    row.left_at = datetime.now(UTC)
    db_session.commit()
    room["gws"].send_json(chat("ghost"))
    sync(room["hws"])
    assert chat_history.visible_to(room["code"], room["hid"]) == []


# ---- history ----------------------------------------------------------------


def test_new_participant_gets_public_history_in_the_snapshot(room, db_session):
    room["hws"].send_json(chat("first"))
    room["gws"].receive_json()
    room["hws"].receive_json()
    with ExitStack() as stack:
        client = stack.enter_context(_client(db_session))
        _, _, snap = connect(client, room["code"], "Late", stack)
    assert [m["text"] for m in snap["chat_history"]] == ["first"]
    assert snap["chat_history"][0]["from_name"] == "Hana"


def test_history_holds_only_what_the_participant_may_see(trio, db_session):
    hws, gws = trio["hws"], trio["gws"]
    hid, gid, tid = trio["hid"], trio["gid"], trio["tid"]
    hws.send_json(chat("public"))
    hws.send_json(chat("host to guest", to=gid))
    gws.send_json(chat("guest to host", to=hid))
    # Wait until the server handled all three. Each of them gets 3 events.
    for _ in range(3):
        hws.receive_json()
        gws.receive_json()
    # The two senders run in parallel, so the order between them is not fixed.
    wanted = {"public", "host to guest", "guest to host"}
    assert {m["text"] for m in chat_history.visible_to(trio["code"], hid)} == wanted
    assert [m["text"] for m in chat_history.visible_to(trio["code"], tid)] == ["public"]

    # A rejoining Gus (a new socket) sees the public message and both private ones.
    with ExitStack() as stack:
        client = stack.enter_context(_client(db_session))
        from app.core.security import create_ws_ticket

        ticket = create_ws_ticket(gid, db_session.get(Participant, gid).meeting_id)
        with client.websocket_connect(f"/ws/meetings/{trio['code']}?ticket={ticket}") as ws:
            snap = ws.receive_json()
    assert {m["text"] for m in snap["chat_history"]} == wanted


def test_private_history_is_hidden_from_a_new_participant(room, db_session):
    room["hws"].send_json(chat("private", to=room["gid"]))
    room["gws"].receive_json()
    room["hws"].receive_json()
    with ExitStack() as stack:
        client = stack.enter_context(_client(db_session))
        _, _, snap = connect(client, room["code"], "Late", stack)
    assert snap["chat_history"] == []


def test_snapshot_has_an_empty_history_first(room, host_client, db_session):
    with ExitStack() as stack:
        client = stack.enter_context(_client(db_session))
        _, _, snap = connect(client, room["code"], "Early", stack)
    assert snap["chat_history"] == []


def test_history_keeps_the_last_100():
    history = ChatHistory()
    for i in range(MAX_HISTORY + 5):
        history.add("111", {"id": str(i), "from": 1, "to": None})
    kept = history.visible_to("111", 9)
    assert len(kept) == MAX_HISTORY
    assert kept[0]["id"] == "5"
    assert kept[-1]["id"] == str(MAX_HISTORY + 4)


def test_history_is_per_meeting():
    history = ChatHistory()
    history.add("111", {"id": "a", "from": 1, "to": None})
    assert history.visible_to("222", 1) == []
    history.clear("111")
    assert history.visible_to("111", 1) == []
    assert len(history) == 0


def test_nothing_is_stored_in_the_database(room, db_session):
    tables = set(db_session.get_bind().dialect.get_table_names(db_session.connection()))
    assert not {t for t in tables if "chat" in t or "message" in t}


# ---- end of the meeting -----------------------------------------------------


def test_ending_the_meeting_clears_the_memory(host_client, room):
    room["hws"].send_json(chat("remember me"))
    room["gws"].receive_json()
    room["hws"].receive_json()
    assert chat_history.visible_to(room["code"], room["hid"])
    assert host_client.post(f"/api/meetings/{room['code']}/end").status_code == 200
    assert chat_history.visible_to(room["code"], room["hid"]) == []
    assert len(chat_history) == 0


def test_the_reaper_ending_a_meeting_clears_the_memory(room, db_session):
    from app.models import Meeting
    from app.services.meeting_service import finish_meeting

    chat_history.add(room["code"], {"id": "x", "from": 1, "to": None})
    meeting = db_session.query(Meeting).filter_by(meeting_code=room["code"]).one()
    finish_meeting(db_session, meeting)
    assert len(chat_history) == 0
