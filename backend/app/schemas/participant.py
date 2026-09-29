from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import ParticipantRole


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    role: ParticipantRole
    is_muted: bool
    is_video_off: bool
    joined_at: datetime
    user_id: int | None
