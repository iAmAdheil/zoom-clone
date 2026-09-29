"""Messages that a client sends on the meeting WebSocket."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, TypeAdapter


class SetMuted(BaseModel):
    type: Literal["set_muted"]
    value: bool


class SetVideoOff(BaseModel):
    type: Literal["set_video_off"]
    value: bool


class Leave(BaseModel):
    type: Literal["leave"]


ClientEvent = Annotated[SetMuted | SetVideoOff | Leave, Field(discriminator="type")]

client_event_adapter: TypeAdapter[SetMuted | SetVideoOff | Leave] = TypeAdapter(ClientEvent)
