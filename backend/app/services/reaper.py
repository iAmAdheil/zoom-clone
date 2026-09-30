"""A background task that cleans up every `reaper_interval_seconds` (15 s by default).

1. Ghost participants (BUG-01): a row that has not left, has no open socket, and is not
   pending (see presence.py) gets `left_at`. So a guest who joined by REST and closed the
   tab before the room opened leaves after about 60-75 s.
2. Forgotten meetings (BUG-12): a `live` meeting ends when nobody was connected for
   `idle_meeting_minutes` (10), or when it is older than `max_meeting_hours` (24).
   Sockets that are still open get `meeting_ended` and close with 4410.
   A `scheduled` meeting does not change.
3. Old rate-limit keys are forgotten, so their memory does not grow.

The app lifespan starts `run_reaper` (app/main.py). `reap_once` does one round and is
what the tests call.
"""

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from asyncer import asyncify
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Meeting, MeetingStatus, Participant
from app.services import rate_limit
from app.services.meeting_service import finish_meeting, now
from app.services.presence import pending_joins
from app.services.room_manager import room_manager

logger = logging.getLogger(__name__)


@dataclass
class ReapResult:
    ghost_ids: list[int] = field(default_factory=list)
    ended_codes: list[str] = field(default_factory=list)


def _open_meetings():
    return Meeting.status.in_([MeetingStatus.live, MeetingStatus.scheduled])


def reap_ghosts(db: Session, at: datetime) -> list[int]:
    """Set `left_at` on each open row that has no socket and is not pending."""
    rows = db.execute(
        select(Participant, Meeting.meeting_code)
        .join(Meeting, Participant.meeting_id == Meeting.id)
        .where(Participant.left_at.is_(None), _open_meetings())
    ).all()
    ghosts = [
        (participant, code)
        for participant, code in rows
        if not room_manager.connections(code, participant.id)
        and not pending_joins.is_pending(participant.id)
    ]
    for participant, _ in ghosts:
        participant.left_at = at
    db.commit()
    # No `participant_left` event: the room never got `participant_joined` for a ghost.
    # (After a restart there are no sockets, so nobody could hear it anyway.)
    return [participant.id for participant, _ in ghosts]


def _has_open_rows(db: Session, meeting: Meeting) -> bool:
    return (
        db.scalar(
            select(Participant.id)
            .where(Participant.meeting_id == meeting.id, Participant.left_at.is_(None))
            .limit(1)
        )
        is not None
    )


def _last_activity(db: Session, meeting: Meeting) -> datetime:
    """The latest of: the start, the last join, the last leave."""
    last_join, last_leave = db.execute(
        select(func.max(Participant.joined_at), func.max(Participant.left_at)).where(
            Participant.meeting_id == meeting.id
        )
    ).one()
    times = [meeting.started_at, meeting.created_at, last_join, last_leave]
    # Stored times are UTC. A naive value (from an aggregate) gets the UTC zone back.
    return max(t if t.tzinfo else t.replace(tzinfo=UTC) for t in times if t is not None)


def end_forgotten_meetings(db: Session, at: datetime) -> list[str]:
    """End live meetings that are idle too long or live too long."""
    settings = get_settings()
    idle_limit = at - timedelta(minutes=settings.idle_meeting_minutes)
    age_limit = at - timedelta(hours=settings.max_meeting_hours)
    ended = []
    live = list(db.scalars(select(Meeting).where(Meeting.status == MeetingStatus.live)))
    for meeting in live:
        too_old = meeting.started_at is not None and meeting.started_at <= age_limit
        idle = (
            not room_manager.has_connections(meeting.meeting_code)
            # An open row now is connected or pending (the ghosts left just before).
            and not _has_open_rows(db, meeting)
            and _last_activity(db, meeting) <= idle_limit
        )
        if too_old or idle:
            finish_meeting(db, meeting)
            ended.append(meeting.meeting_code)
    return ended


def reap_once(db: Session, at: datetime | None = None) -> ReapResult:
    at = at or now()
    result = ReapResult(ghost_ids=reap_ghosts(db, at))
    # After the ghosts, so a meeting whose last ghost just left counts as idle from `at`.
    result.ended_codes = end_forgotten_meetings(db, at)
    pending_joins.forget_expired()
    rate_limit.sweep_all()
    return result


async def run_reaper(open_db: Callable[[], Session], interval: float) -> None:
    """Run `reap_once` every `interval` seconds until the task is cancelled."""

    def work() -> ReapResult:
        with open_db() as db:
            return reap_once(db)

    while True:
        await asyncio.sleep(interval)
        try:
            result = await asyncify(work)()
        except Exception:
            logger.exception("The reaper round failed. It runs again next time.")
            continue
        if result.ghost_ids or result.ended_codes:
            logger.info(
                "Reaper: closed ghost participants %s, ended meetings %s",
                result.ghost_ids,
                result.ended_codes,
            )
