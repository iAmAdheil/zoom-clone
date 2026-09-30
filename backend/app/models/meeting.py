import enum
from datetime import datetime

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.types import UTCDateTime, utcnow
from app.models.user import User


class MeetingType(enum.StrEnum):
    instant = "instant"
    scheduled = "scheduled"


class MeetingStatus(enum.StrEnum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"


class MeetingAccess(enum.StrEnum):
    verified_only = "verified_only"
    allow_guests = "allow_guests"


def str_enum(cls: type[enum.StrEnum]) -> Enum:
    """Store the enum as a plain VARCHAR of its values."""
    return Enum(cls, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e])


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (Index("ix_meetings_host_id_scheduled_start", "host_id", "scheduled_start"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[MeetingType] = mapped_column(str_enum(MeetingType))
    # Indexed: the reaper looks for live and scheduled meetings every 15 s.
    status: Mapped[MeetingStatus] = mapped_column(str_enum(MeetingStatus), index=True)
    access: Mapped[MeetingAccess] = mapped_column(
        str_enum(MeetingAccess), default=MeetingAccess.allow_guests
    )
    passcode: Mapped[str | None] = mapped_column(String(32))
    scheduled_start: Mapped[datetime | None] = mapped_column(UTCDateTime)
    duration_min: Mapped[int | None]
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    host: Mapped[User] = relationship(lazy="joined")
