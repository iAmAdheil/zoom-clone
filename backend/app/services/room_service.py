"""Business rules for the meeting WebSocket. The router in routers/ws.py stays thin.

Each function gets a short-lived session from the router. The router closes it.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import verify_ws_ticket
from app.models import Meeting, MeetingStatus, Participant
from app.schemas.participant import ParticipantOut
from app.schemas.ws import SetMuted, SetVideoOff
from app.services.meeting_service import get_by_code, joined_event, now
from app.services.participant_service import list_participants, updated_event
from app.services.room_manager import room_manager
from app.services.ticket_registry import used_tickets


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
