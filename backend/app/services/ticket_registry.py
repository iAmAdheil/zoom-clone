"""Makes each WebSocket ticket single use.

A ticket is a signed token that lives `ws_ticket_seconds`. The signature does not stop a
replay, so the WebSocket endpoint claims the ticket `jti` here before it accepts the
ticket. The registry keeps a `jti` only until its ticket expires. After that time the
signature check rejects the ticket, so the registry does not need to remember it.

The registry lives in the memory of one process, like the room manager.
"""

import threading
import time


class UsedTickets:
    def __init__(self) -> None:
        self._expires_at: dict[str, float] = {}
        self._lock = threading.Lock()

    def claim(self, jti: str, expires_at: float) -> bool:
        """Return True the first time a `jti` is claimed. Return False after that."""
        now = time.time()
        with self._lock:
            self._expires_at = {k: exp for k, exp in self._expires_at.items() if exp > now}
            if jti in self._expires_at:
                return False
            self._expires_at[jti] = expires_at
            return True

    def __len__(self) -> int:
        with self._lock:
            return len(self._expires_at)


used_tickets = UsedTickets()
