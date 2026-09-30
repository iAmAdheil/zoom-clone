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


class Chat(_Strict):
    """A chat message. `to` is a participant id for a private message, null for everyone.

    The server checks the text (trim, length, control characters) in room_service, so a bad
    text gets a clear error and not `bad_event`.
    """

    type: Literal["chat"]
    text: str
    to: int | None = None


ClientEvent = Annotated[SetMuted | SetVideoOff | Leave | Signal | Chat, Field(discriminator="type")]

client_event_adapter: TypeAdapter[SetMuted | SetVideoOff | Leave | Signal | Chat] = TypeAdapter(
    ClientEvent
)
