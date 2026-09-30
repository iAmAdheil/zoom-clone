"""Who is in the room (BUG-01).

A participant is "connected" while at least one socket of theirs is open (the room
manager knows the sockets). A REST join alone does not put anyone in the room.
After a REST join, the participant is "pending" for `presence_grace_seconds` (the ticket
lifetime). A pending participant shows in `GET /participants`, but not in the
`snapshot`, and the room gets no `participant_joined` until the first socket opens.
When the grace time passes with no socket, the reaper sets `left_at` on the row.

The pending list lives in the memory of one process, like the room manager. After a
restart it is empty, so the reaper closes every open row that has no socket.
"""

import threading
import time
from collections.abc import Callable

from app.core.config import get_settings


class PendingJoins:
    """participant id -> time of the last REST join that has no socket yet."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._since: dict[int, float] = {}
        self._lock = threading.Lock()

    def add(self, participant_id: int) -> None:
        with self._lock:
            self._since[participant_id] = self._clock()

    def discard(self, participant_id: int) -> None:
        with self._lock:
            self._since.pop(participant_id, None)

    def is_pending(self, participant_id: int) -> bool:
        """True if the participant joined by REST less than the grace time ago."""
        grace = get_settings().presence_grace_seconds
        with self._lock:
            since = self._since.get(participant_id)
        return since is not None and self._clock() - since < grace

    def forget_expired(self) -> None:
        cutoff = self._clock() - get_settings().presence_grace_seconds
        with self._lock:
            self._since = {pid: t for pid, t in self._since.items() if t > cutoff}

    def clear(self) -> None:
        with self._lock:
            self._since.clear()


pending_joins = PendingJoins()
