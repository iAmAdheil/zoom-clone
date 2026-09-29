from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import verify_ws_ticket
from app.models import Meeting, MeetingStatus, Participant, ParticipantRole, User
from app.schemas.participant import ParticipantOut
from app.services.meeting_service import now
from app.services.room_manager import CLOSE_REMOVED, room_manager


def _active(meeting: Meeting):
    return (
        Participant.meeting_id == meeting.id,
        Participant.left_at.is_(None),
        Participant.removed.is_(False),
    )


def _user_participant(db: Session, meeting: Meeting, user: User) -> Participant | None:
    return db.scalar(
        select(Participant).where(
            Participant.meeting_id == meeting.id,
            Participant.user_id == user.id,
            Participant.removed.is_(False),
        )
    )


def require_viewer(db: Session, meeting: Meeting, user: User | None, ticket: str | None) -> None:
    """Allow the host, a signed-in participant, or a holder of a valid ticket for this meeting."""
    if user is not None:
        if user.id == meeting.host_id or _user_participant(db, meeting, user):
            return
    if ticket:
        claims = verify_ws_ticket(ticket)
        if claims and claims.get("mid") == meeting.id:
            return
    raise AppError(403, "not_participant", "You are not in this meeting.")


def require_controller(db: Session, meeting: Meeting, user: User) -> None:
    """Allow the host or a co-host."""
    if user.id == meeting.host_id:
        return
    participant = _user_participant(db, meeting, user)
    if participant and participant.role == ParticipantRole.co_host:
        return
    raise AppError(403, "not_allowed", "Only the host or a co-host can do this.")


def _require_live(meeting: Meeting) -> None:
    if meeting.status == MeetingStatus.ended:
        raise AppError(410, "meeting_ended", "The meeting has ended.")


def _get_participant(db: Session, meeting: Meeting, participant_id: int) -> Participant:
    participant = db.get(Participant, participant_id)
    if participant is None or participant.meeting_id != meeting.id:
        raise AppError(404, "participant_not_found", "Participant not found.")
    return participant


def list_participants(db: Session, meeting: Meeting) -> list[Participant]:
    return list(
        db.scalars(
            select(Participant)
            .where(*_active(meeting))
            .order_by(Participant.joined_at, Participant.id)
        )
    )


def updated_event(participant: Participant) -> dict:
    return {
        "type": "participant_updated",
        "participant": ParticipantOut.model_validate(participant).model_dump(mode="json"),
    }


def mute_participant(db: Session, meeting: Meeting, user: User, participant_id: int) -> Participant:
    require_controller(db, meeting, user)
    _require_live(meeting)
    participant = _get_participant(db, meeting, participant_id)
    participant.is_muted = True
    db.commit()
    db.refresh(participant)
    room_manager.broadcast(meeting.meeting_code, updated_event(participant))
    return participant


def mute_all(db: Session, meeting: Meeting, user: User) -> list[Participant]:
    """Mute every attendee. The host and co-hosts stay unmuted."""
    require_controller(db, meeting, user)
    _require_live(meeting)
    muted = list(
        db.scalars(
            select(Participant).where(
                *_active(meeting), Participant.role == ParticipantRole.attendee
            )
        )
    )
    for participant in muted:
        participant.is_muted = True
    db.commit()
    room_manager.broadcast(
        meeting.meeting_code, {"type": "mute_all", "participant_ids": [p.id for p in muted]}
    )
    return muted


def remove_participant(
    db: Session, meeting: Meeting, user: User, participant_id: int
) -> Participant:
    require_controller(db, meeting, user)
    _require_live(meeting)
    participant = _get_participant(db, meeting, participant_id)
    if participant.role == ParticipantRole.host:
        raise AppError(403, "cannot_remove_host", "The host cannot be removed.")
    participant.removed = True
    participant.left_at = participant.left_at or now()
    db.commit()
    db.refresh(participant)
    # Only the removed participant gets `you_were_removed`. Then the server closes its sockets.
    room_manager.send_to_participant(
        meeting.meeting_code,
        participant.id,
        {"type": "you_were_removed", "participant_id": participant.id},
    )
    room_manager.close_participant(
        meeting.meeting_code, participant.id, CLOSE_REMOVED, "removed_from_meeting"
    )
    room_manager.broadcast(
        meeting.meeting_code, {"type": "participant_left", "participant_id": participant.id}
    )
    return participant
