from typing import Annotated

from fastapi import APIRouter, Query

from app.core.config import get_settings
from app.routers.deps import CurrentUserDep, DbDep, OptionalUserDep
from app.schemas.meeting import (
    InstantMeetingIn,
    JoinIn,
    JoinOut,
    MeetingLookup,
    MeetingOut,
    MeetingPatch,
    ScheduleMeetingIn,
)
from app.schemas.participant import ParticipantOut
from app.services import meeting_service as svc

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _out(meeting) -> MeetingOut:
    return MeetingOut.from_model(meeting, get_settings().frontend_origin)


@router.post("/instant")
def create_instant(data: InstantMeetingIn, user: CurrentUserDep, db: DbDep) -> MeetingOut:
    return _out(svc.create_instant(db, user, data))


@router.post("")
def schedule(data: ScheduleMeetingIn, user: CurrentUserDep, db: DbDep) -> MeetingOut:
    return _out(svc.create_scheduled(db, user, data))


@router.get("/upcoming")
def upcoming(user: CurrentUserDep, db: DbDep) -> list[MeetingOut]:
    return [_out(m) for m in svc.list_upcoming(db, user)]


@router.get("/recent")
def recent(
    user: CurrentUserDep, db: DbDep, limit: Annotated[int, Query(ge=1, le=100)] = 20
) -> list[MeetingOut]:
    return [_out(m) for m in svc.list_recent(db, user, limit)]


@router.get("/{code}")
def lookup(code: str, db: DbDep) -> MeetingLookup:
    meeting = svc.get_by_code(db, code)
    return MeetingLookup(
        meeting_code=meeting.meeting_code,
        title=meeting.title,
        host_name=meeting.host.name,
        status=meeting.status,
        access=meeting.access,
        requires_passcode=bool(meeting.passcode),
    )


@router.patch("/{meeting_id}")
def patch(meeting_id: int, data: MeetingPatch, user: CurrentUserDep, db: DbDep) -> MeetingOut:
    meeting = svc.get_by_id(db, meeting_id)
    return _out(svc.update_meeting(db, meeting, user, data))


@router.delete("/{meeting_id}", status_code=204)
def delete(meeting_id: int, user: CurrentUserDep, db: DbDep) -> None:
    meeting = svc.get_by_id(db, meeting_id)
    svc.cancel_meeting(db, meeting, user)


@router.post("/{code}/join")
def join(code: str, data: JoinIn, user: OptionalUserDep, db: DbDep) -> JoinOut:
    meeting = svc.get_by_code(db, code)
    participant, ticket, rejoin_token = svc.join_meeting(db, meeting, user, data)
    return JoinOut(
        participant=ParticipantOut.model_validate(participant),
        ws_ticket=ticket,
        rejoin_token=rejoin_token,
        meeting=_out(meeting),
    )


@router.post("/{code}/end")
def end(code: str, user: CurrentUserDep, db: DbDep) -> MeetingOut:
    meeting = svc.get_by_code(db, code)
    return _out(svc.end_meeting(db, meeting, user))
