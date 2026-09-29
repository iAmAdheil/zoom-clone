from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import Meeting, MeetingAccess, MeetingStatus, MeetingType
from app.schemas.participant import ParticipantOut
from app.schemas.user import UserOut


def _check_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError, OSError) as exc:
        raise ValueError("Unknown IANA timezone.") from exc
    return value


def _clean_passcode(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_code: str
    title: str
    description: str | None
    type: MeetingType
    status: MeetingStatus
    access: MeetingAccess
    passcode: str | None
    scheduled_start: datetime | None
    duration_min: int | None
    timezone: str
    started_at: datetime | None
    ended_at: datetime | None
    host: UserOut
    invite_link: str

    @classmethod
    def from_model(cls, meeting: Meeting, frontend_origin: str) -> "MeetingOut":
        out = cls.model_validate(
            {
                **{
                    name: getattr(meeting, name)
                    for name in cls.model_fields
                    if name != "invite_link"
                },
                "invite_link": f"{frontend_origin.rstrip('/')}/j/{meeting.meeting_code}",
            }
        )
        return out


class MeetingLookup(BaseModel):
    meeting_code: str
    title: str
    host_name: str
    status: MeetingStatus
    access: MeetingAccess
    requires_passcode: bool


class InstantMeetingIn(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    access: MeetingAccess = MeetingAccess.allow_guests


class ScheduleMeetingIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    scheduled_start: datetime
    duration_min: int = Field(ge=1, le=1440)
    timezone: str
    access: MeetingAccess = MeetingAccess.allow_guests
    passcode: str | None = Field(default=None, max_length=32)

    _tz = field_validator("timezone")(_check_timezone)
    _pass = field_validator("passcode")(_clean_passcode)


class MeetingPatch(BaseModel):
    """Only fields that the client sends are changed. Send null to clear description or passcode."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    scheduled_start: datetime | None = None
    duration_min: int | None = Field(default=None, ge=1, le=1440)
    timezone: str | None = None
    access: MeetingAccess | None = None
    passcode: str | None = Field(default=None, max_length=32)

    @field_validator("timezone")
    @classmethod
    def _tz(cls, value: str | None) -> str | None:
        return None if value is None else _check_timezone(value)

    _pass = field_validator("passcode")(_clean_passcode)


class JoinIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    passcode: str | None = Field(default=None, max_length=32)

    @field_validator("display_name")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("display_name must not be blank.")
        return value


class JoinOut(BaseModel):
    participant: ParticipantOut
    ws_ticket: str
    meeting: MeetingOut
