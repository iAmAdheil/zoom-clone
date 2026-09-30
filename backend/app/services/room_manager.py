"""Open WebSocket connections, grouped by meeting code.

Services call `broadcast` (and the other send methods) after they change state.
They call it from sync code in a worker thread. The WebSocket endpoint calls it from
async code on the event loop. Both are safe because no method here writes to a socket.
Each method puts the event on the queue of each target connection with
`loop.call_soon_threadsafe`. One writer task per connection sends its queue in order,
so every client gets the events in the order the server made them.

Events (see docs/api.md) are dicts: {"type": "<event>", ...payload}.
A `Close` item on the queue tells the writer task to close that socket.

The registry lives in the memory of one process. More than one server process needs a
shared pub/sub (for example Redis) instead.
"""

import asyncio
import itertools
import logging
import threading
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# WebSocket close codes. An error closes with 4000 + the HTTP status of the error.
CLOSE_NORMAL = 1000
CLOSE_REMOVED = 4403
CLOSE_MEETING_ENDED = 4410
# A newer socket of the same participant replaced this one (more than the cap were open).
# 4403 is final for the client, so the old tab does not reconnect and push out another one.
CLOSE_TOO_MANY = 4403
REASON_TOO_MANY = "too_many_connections"

_sequence = itertools.count()


@dataclass(frozen=True)
class Close:
    code: int
    reason: str


@dataclass(eq=False)
class Connection:
    """One open socket. `loop` is the event loop that serves it."""

    participant_id: int
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue[dict | Close] = field(default_factory=asyncio.Queue)
    # Open order. A lower number is an older socket.
    seq: int = field(default_factory=lambda: next(_sequence))
    # True if no other socket of this participant was open when this one opened.
    first: bool = False
    # True after the cap closed this socket. It does not count against the cap again.
    evicted: bool = False

    def push(self, item: dict | Close) -> None:
        """Add an item to the queue. Safe from any thread."""
        try:
            self.loop.call_soon_threadsafe(self.queue.put_nowait, item)
        except RuntimeError:
            # The loop is closed, so this socket is gone. Its cleanup removes it.
            logger.debug("dropped event for a closed loop: %s", item)


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, set[Connection]] = {}
        self._lock = threading.Lock()

    def connect(
        self, meeting_code: str, participant_id: int, max_per_participant: int | None = None
    ) -> Connection:
        """Register a socket. Call it on the event loop that serves the socket.

        If the participant then has more than `max_per_participant` open sockets, the
        oldest ones get a `Close` with 4403 `too_many_connections`.
        """
        conn = Connection(participant_id, asyncio.get_running_loop())
        with self._lock:
            room = self._rooms.setdefault(meeting_code, set())
            mine = sorted(
                (c for c in room if c.participant_id == participant_id and not c.evicted),
                key=lambda c: c.seq,
            )
            conn.first = not any(c.participant_id == participant_id for c in room)
            room.add(conn)
            extra = len(mine) + 1 - max_per_participant if max_per_participant else 0
            evicted = mine[: max(0, extra)]
            for old in evicted:
                old.evicted = True
        for old in evicted:
            old.push(Close(CLOSE_TOO_MANY, REASON_TOO_MANY))
        return conn

    def disconnect(self, meeting_code: str, conn: Connection) -> bool:
        """Remove a socket. Return True if the participant has no other socket in the room."""
        with self._lock:
            room = self._rooms.get(meeting_code, set())
            room.discard(conn)
            if not room:
                self._rooms.pop(meeting_code, None)
            return all(c.participant_id != conn.participant_id for c in room)

    def connections(self, meeting_code: str, participant_id: int | None = None) -> list[Connection]:
        """The open sockets in a room. Give `participant_id` to get only that participant's."""
        with self._lock:
            room = list(self._rooms.get(meeting_code, ()))
        if participant_id is None:
            return room
        return [c for c in room if c.participant_id == participant_id]

    def broadcast(self, meeting_code: str, event: dict, exclude: int | None = None) -> None:
        """Send `event` to every socket in the room, except the sockets of `exclude`."""
        for conn in self.connections(meeting_code):
            if conn.participant_id != exclude:
                conn.push(event)

    def has_connections(self, meeting_code: str) -> bool:
        with self._lock:
            return bool(self._rooms.get(meeting_code))

    def send_to_participant(self, meeting_code: str, participant_id: int, event: dict) -> None:
        """Send `event` only to the sockets of one participant."""
        for conn in self.connections(meeting_code, participant_id):
            conn.push(event)

    def close_participant(
        self, meeting_code: str, participant_id: int, code: int, reason: str
    ) -> None:
        """Close every socket of one participant, after the events already queued."""
        for conn in self.connections(meeting_code, participant_id):
            conn.push(Close(code, reason))

    def close_room(self, meeting_code: str, code: int, reason: str) -> None:
        """Close every socket in the room, after the events already queued."""
        for conn in self.connections(meeting_code):
            conn.push(Close(code, reason))


room_manager = RoomManager()
