"""Messages that a client sends on the meeting WebSocket."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StrictInt, TypeAdapter


class SetMuted(BaseModel):
    type: Literal["set_muted"]
    value: bool


class SetVideoOff(BaseModel):
    type: Literal["set_video_off"]
    value: bool


class Leave(BaseModel):
    type: Literal["leave"]


class Signal(BaseModel):
    """A WebRTC signaling message for one peer. The server relays `data` and never reads it."""

    type: Literal["signal"]
    to: StrictInt
    data: dict[str, Any]


ClientEvent = Annotated[SetMuted | SetVideoOff | Leave | Signal, Field(discriminator="type")]

client_event_adapter: TypeAdapter[SetMuted | SetVideoOff | Leave | Signal] = TypeAdapter(
    ClientEvent
)
