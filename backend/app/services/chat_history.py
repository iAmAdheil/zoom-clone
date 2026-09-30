"""The last chat messages of each live meeting, in memory only.

Nothing goes to the database. The memory of a meeting is cleared when the meeting ends
(`finish_meeting`). A restart of the server also clears it. Like the room manager, this
works for one server process only.

Services call it from worker threads and from the event loop, so a lock guards the data.
"""

import threading
from collections import deque

# The most messages kept for one meeting. The oldest message goes first.
MAX_HISTORY = 100


def is_visible_to(message: dict, participant_id: int) -> bool:
    """A public message is visible to all. A private one only to its sender and its target."""
    return message["to"] is None or participant_id in (message["from"], message["to"])


class ChatHistory:
    def __init__(self, limit: int = MAX_HISTORY) -> None:
        self._limit = limit
        self._meetings: dict[str, deque[dict]] = {}
        self._lock = threading.Lock()

    def add(self, meeting_code: str, message: dict) -> None:
        with self._lock:
            self._meetings.setdefault(meeting_code, deque(maxlen=self._limit)).append(message)

    def visible_to(self, meeting_code: str, participant_id: int) -> list[dict]:
        """The stored messages that this participant may see, oldest first."""
        with self._lock:
            messages = list(self._meetings.get(meeting_code, ()))
        return [m for m in messages if is_visible_to(m, participant_id)]

    def clear(self, meeting_code: str) -> None:
        with self._lock:
            self._meetings.pop(meeting_code, None)

    def __len__(self) -> int:
        with self._lock:
            return len(self._meetings)


chat_history = ChatHistory()
