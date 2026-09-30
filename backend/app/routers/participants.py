from typing import Annotated

from fastapi import APIRouter, Query

from app.routers.deps import CurrentUserDep, DbDep, OptionalUserDep
from app.schemas.participant import ParticipantOut
from app.services import meeting_service, participant_service

router = APIRouter(prefix="/api/meetings/{code}", tags=["participants"])


@router.get("/participants")
def list_participants(
    code: str,
    user: OptionalUserDep,
    db: DbDep,
    ticket: Annotated[str | None, Query()] = None,
) -> list[ParticipantOut]:
    meeting = meeting_service.get_by_code(db, code)
    participant_service.require_viewer(db, meeting, user, ticket)
    return [ParticipantOut.model_validate(p) for p in participant_service.list_present(db, meeting)]


@router.post("/participants/{pid}/mute")
def mute(code: str, pid: int, user: CurrentUserDep, db: DbDep) -> ParticipantOut:
    meeting = meeting_service.get_by_code(db, code)
    return ParticipantOut.model_validate(
        participant_service.mute_participant(db, meeting, user, pid)
    )


@router.post("/mute-all")
def mute_all(code: str, user: CurrentUserDep, db: DbDep) -> list[ParticipantOut]:
    meeting = meeting_service.get_by_code(db, code)
    return [
        ParticipantOut.model_validate(p) for p in participant_service.mute_all(db, meeting, user)
    ]


@router.post("/participants/{pid}/remove")
def remove(code: str, pid: int, user: CurrentUserDep, db: DbDep) -> ParticipantOut:
    meeting = meeting_service.get_by_code(db, code)
    return ParticipantOut.model_validate(
        participant_service.remove_participant(db, meeting, user, pid)
    )
