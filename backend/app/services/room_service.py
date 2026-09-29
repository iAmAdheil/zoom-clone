"""Business rules for the meeting WebSocket. The router in routers/ws.py stays thin.

Each function gets a short-lived session from the router. The router closes it.
"""

import json
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import verify_ws_ticket
from app.models import Meeting, MeetingStatus, Participant
from app.schemas.participant import ParticipantOut
from app.schemas.ws import SetMuted, SetVideoOff, Signal
from app.services.meeting_service import get_by_code, joined_event, now
from app.services.participant_service import list_participants, updated_event
from app.services.room_manager import room_manager
from app.services.ticket_registry import used_tickets

# The limit for `data` of a `signal`, as compact JSON in UTF-8 bytes.
MAX_SIGNAL_BYTES = 16 * 1024
# The most bytes a raw client message may have before the server parses it.
MAX_MESSAGE_BYTES = MAX_SIGNAL_BYTES + 1024


@dataclass(frozen=True)
class Seat:
    """Who holds a socket. The socket keeps ids only, never ORM objects."""

    meeting_id: int
    meeting_code: str
    participant_id: int


def _check_seat(meeting: Meeting | None, participant: Participant | None) -> None:
    if meeting is None:
        raise AppError(404, "meeting_not_found", "Meeting not found.")
    if meeting.status == MeetingStatus.ended:
        raise AppError(410, "meeting_ended", "The meeting has ended.")
    if participant is None or participant.meeting_id != meeting.id:
        raise AppError(403, "not_participant", "You are not in this meeting.")
    if participant.removed:
        raise AppError(403, "removed_from_meeting", "The host removed you from this meeting.")


def take_seat(db: Session, raw_code: str, ticket: str | None) -> Seat:
    """Check the ticket and use it up. Raise AppError if the socket must not open."""
    claims = verify_ws_ticket(ticket) if ticket else None
    if claims is None:
        raise AppError(401, "invalid_ticket", "The ticket is not valid or has expired.")
    # Claim before the other checks, so two sockets cannot race with one ticket.
    if not used_tickets.claim(claims["jti"], claims["exp"]):
        raise AppError(401, "ticket_used", "This ticket was already used. Join again.")

    meeting = get_by_code(db, raw_code)
    if claims["mid"] != meeting.id:
        raise AppError(403, "wrong_meeting", "This ticket is for another meeting.")
    _check_seat(meeting, db.get(Participant, claims["pid"]))
    return Seat(meeting.id, meeting.meeting_code, claims["pid"])


def enter_room(db: Session, seat: Seat) -> dict:
    """Call after the socket is in the room manager. Return the `snapshot` event.

    If the row left after the ticket was made (for example, another tab of the same
    user sent `leave`), the row comes back and the room gets `participant_joined`.
    """
    meeting = db.get(Meeting, seat.meeting_id)
    participant = db.get(Participant, seat.participant_id)
    _check_seat(meeting, participant)
    if participant.left_at is not None:
        participant.left_at = None
        db.commit()
        room_manager.broadcast(seat.meeting_code, joined_event(participant))
    snapshot = {
        "type": "snapshot",
        "connected_ids": connected_ids(seat.meeting_code),
        "participants": [
            ParticipantOut.model_validate(p).model_dump(mode="json")
            for p in list_participants(db, meeting)
        ],
    }
    return snapshot


def set_media_state(db: Session, seat: Seat, event: SetMuted | SetVideoOff) -> None:
    """Apply `set_muted` or `set_video_off` and broadcast `participant_updated`."""
    participant = db.get(Participant, seat.participant_id)
    if participant is None or participant.removed or participant.left_at is not None:
        return
    if isinstance(event, SetMuted):
        participant.is_muted = event.value
    else:
        participant.is_video_off = event.value
    db.commit()
    room_manager.broadcast(seat.meeting_code, updated_event(participant))


def leave_room(db: Session, seat: Seat) -> None:
    """Call when the last socket of a participant closes. Set `left_at` once."""
    participant = db.get(Participant, seat.participant_id)
    # A removed participant, or everyone in an ended meeting, already has `left_at`.
    if participant is None or participant.left_at is not None:
        return
    participant.left_at = now()
    db.commit()
    room_manager.broadcast(
        seat.meeting_code, {"type": "participant_left", "participant_id": participant.id}
    )


def connected_ids(meeting_code: str) -> list[int]:
    """The ids of the participants that have an open socket in the room, ascending."""
    return sorted({c.participant_id for c in room_manager.connections(meeting_code)})


def error_event(code: str, detail: str) -> dict:
    return {"type": "error", "code": code, "detail": detail}


def _in_room(db: Session, seat: Seat, participant_id: int) -> bool:
    """True if the participant is in this meeting, has not left or been removed."""
    participant = db.get(Participant, participant_id)
    return (
        participant is not None
        and participant.meeting_id == seat.meeting_id
        and not participant.removed
        and participant.left_at is None
    )


def relay_signal(db: Session, seat: Seat, event: Signal) -> dict | None:
    """Send `data` to the target only. Return an `error` event for the sender, or None.

    The server never reads `data`. The room manager keeps one room per meeting code,
    so a signal cannot cross meetings.
    """
    if not _in_room(db, seat, seat.participant_id):
        return None  # The sender left or was removed. Its socket closes soon.
    connected = event.to in connected_ids(seat.meeting_code)
    if event.to == seat.participant_id or not connected or not _in_room(db, seat, event.to):
        return error_event("bad_target", "The target is not connected to this meeting.")
    if len(json.dumps(event.data, separators=(",", ":")).encode()) > MAX_SIGNAL_BYTES:
        return error_event("payload_too_large", "The signal data is larger than 16 KB.")
    room_manager.send_to_participant(
        seat.meeting_code,
        event.to,
        {"type": "signal", "from": seat.participant_id, "data": event.data},
    )
    return None
