import enum
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.meeting import str_enum
from app.models.types import UTCDateTime, utcnow


class ParticipantRole(enum.StrEnum):
    host = "host"
    co_host = "co_host"
    attendee = "attendee"


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), index=True)
    # Indexed: Recent meetings and the join path look rows up by user (BUG-16).
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[ParticipantRole] = mapped_column(
        str_enum(ParticipantRole), default=ParticipantRole.attendee
    )
    joined_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_video_off: Mapped[bool] = mapped_column(Boolean, default=False)
    removed: Mapped[bool] = mapped_column(Boolean, default=False)
