import re
import secrets
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import create_rejoin_token, create_ws_ticket, verify_rejoin_token
from app.models import (
    Meeting,
    MeetingAccess,
    MeetingStatus,
    MeetingType,
    Participant,
    ParticipantRole,
    User,
)
from app.schemas.meeting import InstantMeetingIn, JoinIn, MeetingPatch, ScheduleMeetingIn
from app.schemas.participant import ParticipantOut
from app.services import rate_limit
from app.services.chat_history import chat_history
from app.services.presence import pending_joins
from app.services.room_manager import CLOSE_MEETING_ENDED, room_manager

CODE_ATTEMPTS = 10
# A scheduled meeting with no duration stays upcoming this long after its start.
DEFAULT_GRACE_MIN = 15


def now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def local_to_utc(value: datetime, timezone: str) -> datetime:
    """A time without an offset is a wall-clock time in `timezone`. Return it in UTC."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=ZoneInfo(timezone))
    return value.astimezone(UTC)


# ---- codes and lookup -------------------------------------------------------


# A meeting code as a person types it: digits, maybe with spaces or dashes between them.
_TYPED_CODE = re.compile(r"[0-9][0-9 -]*")


def normalize_code(raw: str) -> str:
    """'123 456 7890' and '123-456-7890' become '1234567890'.

    Any other character (a letter, a slash, a non-ASCII digit) gives '', which is an
    unknown meeting. So '43984abc18723' is not meeting '4398418723'.
    """
    raw = raw.strip()
    if not _TYPED_CODE.fullmatch(raw):
        return ""
    return raw.replace(" ", "").replace("-", "")


def generate_code(db: Session) -> str:
    for _ in range(CODE_ATTEMPTS):
        code = str(secrets.randbelow(9 * 10**9) + 10**9)  # 10 digits, no leading zero
        if db.scalar(select(Meeting.id).where(Meeting.meeting_code == code)) is None:
            return code
    raise AppError(500, "code_generation_failed", "Could not create a meeting code.")


def get_by_code(db: Session, raw_code: str) -> Meeting:
    code = normalize_code(raw_code)
    meeting = db.scalar(select(Meeting).where(Meeting.meeting_code == code)) if code else None
    if meeting is None:
        raise AppError(404, "meeting_not_found", "Meeting not found.")
    return meeting


def get_by_id(db: Session, meeting_id: int) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if meeting is None:
        raise AppError(404, "meeting_not_found", "Meeting not found.")
    return meeting


def require_host(meeting: Meeting, user: User) -> None:
    if meeting.host_id != user.id:
        raise AppError(403, "not_host", "Only the host can do this.")


# ---- create -----------------------------------------------------------------


def create_instant(db: Session, host: User, data: InstantMeetingIn) -> Meeting:
    started = now()
    meeting = Meeting(
        meeting_code=generate_code(db),
        host_id=host.id,
        title=data.title or f"{host.name}'s meeting",
        type=MeetingType.instant,
        status=MeetingStatus.live,
        access=data.access,
        timezone="UTC",
        started_at=started,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def _check_future(start: datetime) -> None:
    if _as_utc(start) < now():
        raise AppError(422, "start_in_past", "The start time must be in the future.")


def create_scheduled(db: Session, host: User, data: ScheduleMeetingIn) -> Meeting:
    start = local_to_utc(data.scheduled_start, data.timezone)
    _check_future(start)
    meeting = Meeting(
        meeting_code=generate_code(db),
        host_id=host.id,
        title=data.title,
        description=data.description,
        type=MeetingType.scheduled,
        status=MeetingStatus.scheduled,
        access=data.access,
        passcode=data.passcode,
        scheduled_start=start,
        duration_min=data.duration_min,
        timezone=data.timezone,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


# ---- lists ------------------------------------------------------------------


def scheduled_end(meeting: Meeting) -> datetime | None:
    """When a scheduled meeting's window closes: start + duration (or the grace time)."""
    if meeting.scheduled_start is None:
        return None
    minutes = meeting.duration_min if meeting.duration_min is not None else DEFAULT_GRACE_MIN
    return _as_utc(meeting.scheduled_start) + timedelta(minutes=minutes)


def _lapsed(meeting: Meeting, at: datetime) -> bool:
    """True for a scheduled meeting that nobody started and whose window is over."""
    end = scheduled_end(meeting)
    return meeting.status == MeetingStatus.scheduled and end is not None and end <= at


def list_upcoming(db: Session, user: User) -> list[Meeting]:
    """Scheduled meetings the user hosts, until start + duration has passed."""
    at = now()
    stmt = (
        select(Meeting)
        .where(Meeting.host_id == user.id, Meeting.status == MeetingStatus.scheduled)
        .order_by(Meeting.scheduled_start.asc())
    )
    return [m for m in db.scalars(stmt) if not _lapsed(m, at)]


def list_recent(db: Session, user: User, limit: int) -> list[Meeting]:
    """Live or ended meetings, and lapsed scheduled ones, that the user hosted or joined."""
    at = now()
    joined = select(Participant.meeting_id).where(Participant.user_id == user.id)
    stmt = select(Meeting).where(
        or_(Meeting.host_id == user.id, Meeting.id.in_(joined)),
        # Coarse filter in SQL. `_lapsed` checks the exact end time below.
        or_(Meeting.status != MeetingStatus.scheduled, Meeting.scheduled_start <= at),
    )
    meetings = [
        m for m in db.scalars(stmt) if m.status != MeetingStatus.scheduled or _lapsed(m, at)
    ]
    meetings.sort(
        key=lambda m: _as_utc(m.started_at or m.scheduled_start or m.created_at), reverse=True
    )
    return meetings[:limit]


# ---- edit, cancel, end ------------------------------------------------------


def update_meeting(db: Session, meeting: Meeting, user: User, patch: MeetingPatch) -> Meeting:
    require_host(meeting, user)
    if meeting.status == MeetingStatus.ended:
        raise AppError(409, "meeting_not_editable", "An ended meeting cannot be edited.")
    changes = patch.model_dump(exclude_unset=True)

    for field in ("title", "scheduled_start", "duration_min", "timezone", "access"):
        if field in changes and changes[field] is None:
            raise AppError(422, "invalid_field", f"{field} cannot be null.")

    time_fields = {"scheduled_start", "duration_min", "timezone"} & changes.keys()
    if time_fields and meeting.status != MeetingStatus.scheduled:
        raise AppError(409, "meeting_not_editable", "Only a scheduled meeting has a start time.")
    if "scheduled_start" in changes:
        timezone = changes.get("timezone") or meeting.timezone
        changes["scheduled_start"] = local_to_utc(changes["scheduled_start"], timezone)
        _check_future(changes["scheduled_start"])

    for field, value in changes.items():
        setattr(meeting, field, value)
    db.commit()
    db.refresh(meeting)
    return meeting


def cancel_meeting(db: Session, meeting: Meeting, user: User) -> None:
    require_host(meeting, user)
    if meeting.status != MeetingStatus.scheduled:
        raise AppError(409, "meeting_not_cancellable", "Only a scheduled meeting can be cancelled.")
    db.query(Participant).filter(Participant.meeting_id == meeting.id).delete()
    db.delete(meeting)
    db.commit()


def end_meeting(db: Session, meeting: Meeting, user: User) -> Meeting:
    require_host(meeting, user)
    if meeting.status == MeetingStatus.ended:
        raise AppError(410, "meeting_ended", "The meeting already ended.")
    return finish_meeting(db, meeting)


def finish_meeting(db: Session, meeting: Meeting) -> Meeting:
    """End the meeting for everyone. The host's `end` and the reaper use it."""
    ended = now()
    meeting.status = MeetingStatus.ended
    meeting.ended_at = ended
    for p in db.scalars(
        select(Participant).where(
            Participant.meeting_id == meeting.id, Participant.left_at.is_(None)
        )
    ):
        p.left_at = ended
    db.commit()
    db.refresh(meeting)
    chat_history.clear(meeting.meeting_code)
    room_manager.broadcast(meeting.meeting_code, {"type": "meeting_ended"})
    room_manager.close_room(meeting.meeting_code, CLOSE_MEETING_ENDED, "meeting_ended")
    return meeting


# ---- join -------------------------------------------------------------------


def _rejoin_row(
    db: Session, meeting: Meeting, user: User | None, token: str | None
) -> Participant | None:
    """Return the row that a rejoin token names, if the token belongs to this caller."""
    claims = verify_rejoin_token(token) if token else None
    if claims is None or claims.get("mid") != meeting.id:
        return None
    participant = db.get(Participant, claims.get("pid"))
    owner_id = user.id if user else None
    if participant is None or participant.meeting_id != meeting.id:
        return None
    if participant.user_id != owner_id:
        return None
    return participant


def join_meeting(
    db: Session, meeting: Meeting, user: User | None, data: JoinIn, client_ip: str = ""
) -> tuple[Participant, str, str]:
    """Apply the join rules. Order: ended, access, removed, passcode.

    Returns the participant, a WebSocket ticket, and a rejoin token.
    The room hears nothing now. It gets `participant_joined` when the first socket of
    the participant opens (see presence.py).
    """
    if meeting.status == MeetingStatus.ended:
        raise AppError(410, "meeting_ended", "The meeting has ended.")

    if meeting.access == MeetingAccess.verified_only and user is None:
        raise AppError(403, "guests_not_allowed", "Sign in to join this meeting.")

    is_host = user is not None and user.id == meeting.host_id

    if user is not None:
        was_removed = db.scalar(
            select(Participant.id).where(
                Participant.meeting_id == meeting.id,
                Participant.user_id == user.id,
                Participant.removed.is_(True),
            )
        )
        if was_removed and not is_host:
            raise AppError(403, "removed_from_meeting", "The host removed you from this meeting.")

    # A rejoin token gives back the same row after a dropped connection (guests too).
    participant = _rejoin_row(db, meeting, user, data.rejoin_token)
    if participant is not None and participant.removed:
        raise AppError(403, "removed_from_meeting", "The host removed you from this meeting.")

    # The host does not need the passcode. Everyone else does.
    if meeting.passcode and not is_host:
        rate_limit.check_passcode_allowed(client_ip, meeting.meeting_code)
        if data.passcode != meeting.passcode:
            rate_limit.record_passcode_failure(client_ip, meeting.meeting_code)
            raise AppError(403, "bad_passcode", "The passcode is not correct.")

    if participant is None and user is not None:
        # A signed-in user who is still in the room keeps the same row (second tab, reload).
        participant = db.scalar(
            select(Participant).where(
                Participant.meeting_id == meeting.id,
                Participant.user_id == user.id,
                Participant.left_at.is_(None),
            )
        )
    if participant is None:
        participant = Participant(
            meeting_id=meeting.id,
            user_id=user.id if user else None,
            display_name=data.display_name,
            role=ParticipantRole.host if is_host else ParticipantRole.attendee,
        )
        db.add(participant)
    else:
        participant.left_at = None

    if is_host and meeting.status == MeetingStatus.scheduled:
        meeting.status = MeetingStatus.live
        meeting.started_at = now()

    db.commit()
    db.refresh(participant)
    ticket = create_ws_ticket(participant.id, meeting.id)
    rejoin_token = create_rejoin_token(participant.id, meeting.id)
    if not room_manager.connections(meeting.meeting_code, participant.id):
        pending_joins.add(participant.id)
    return participant, ticket, rejoin_token


def joined_event(participant: Participant) -> dict:
    return {
        "type": "participant_joined",
        "participant": ParticipantOut.model_validate(participant).model_dump(mode="json"),
    }
