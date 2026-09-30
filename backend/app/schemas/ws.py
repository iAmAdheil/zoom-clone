"""Messages that a client sends on the meeting WebSocket.

The models are strict (BUG-21): `"yes"`, `1` or `"true"` is not a bool, and `"2"` is not
an id. A message that does not fit gets the `bad_event` error.
"""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class _Strict(BaseModel):
    model_config = ConfigDict(strict=True)


class SetMuted(_Strict):
    type: Literal["set_muted"]
    value: bool


class SetVideoOff(_Strict):
    type: Literal["set_video_off"]
    value: bool


class Leave(_Strict):
    type: Literal["leave"]


class Signal(_Strict):
    """A WebRTC signaling message for one peer. The server relays `data` and never reads it."""

    type: Literal["signal"]
    to: int
    data: dict[str, Any]


ClientEvent = Annotated[SetMuted | SetVideoOff | Leave | Signal, Field(discriminator="type")]

client_event_adapter: TypeAdapter[SetMuted | SetVideoOff | Leave | Signal] = TypeAdapter(
    ClientEvent
)
