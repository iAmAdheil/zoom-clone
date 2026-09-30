"""Small in-memory rate limits (sliding window).

The limits (docs/api.md, "Rate limits"):
- `POST /api/auth/demo`: `rate_limit_demo_per_minute` per client IP.
- `POST /api/meetings/{code}/join`: `rate_limit_join_per_minute` per client IP.
- Chat: `chat_rate_limit_messages` per participant in `chat_rate_limit_window_seconds`.
  The WebSocket sends an `error` event `rate_limited`, not an HTTP 429.
- Wrong passcodes: after `rate_limit_passcode_failures` wrong passcodes from one IP for
  one meeting in `rate_limit_passcode_window_seconds`, every join from that IP to that
  meeting gets 429 until the oldest failure leaves the window. A right passcode is
  refused too, so a guesser cannot go on.

The counters live in the memory of one process, like the room manager.
"""

import math
import threading
import time
from collections import deque
from collections.abc import Callable

from app.core.config import get_settings
from app.core.errors import AppError


class SlidingWindow:
    """Counts events per key in the last `window` seconds. Safe from any thread."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, window: float, now: float) -> deque[float]:
        """The times of the key's events in the window. Call with the lock held."""
        events = self._events.get(key)
        if events is None:
            return deque()
        while events and events[0] <= now - window:
            events.popleft()
        if not events:
            del self._events[key]
        return events

    def wait_time(self, key: str, limit: int, window: float) -> float:
        """Seconds until the key may have one more event. 0 means now. Records nothing."""
        now = self._clock()
        with self._lock:
            events = self._recent(key, window, now)
            if len(events) < limit:
                return 0.0
            return events[len(events) - limit] + window - now

    def record(self, key: str) -> None:
        with self._lock:
            self._events.setdefault(key, deque()).append(self._clock())

    def hit(self, key: str, limit: int, window: float) -> float:
        """Record one event if the limit allows it. Return 0, or the seconds to wait."""
        now = self._clock()
        with self._lock:
            events = self._recent(key, window, now)
            if len(events) >= limit:
                return events[len(events) - limit] + window - now
            self._events.setdefault(key, events).append(now)
            return 0.0

    def sweep(self, window: float) -> None:
        """Forget the keys that had no event in the last `window` seconds."""
        cutoff = self._clock() - window
        with self._lock:
            for key in [k for k, events in self._events.items() if events[-1] <= cutoff]:
                del self._events[key]

    def clear(self) -> None:
        with self._lock:
            self._events.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._events)


demo_logins = SlidingWindow()
joins = SlidingWindow()
passcode_failures = SlidingWindow()
chat_messages = SlidingWindow()


def _too_many(wait: float) -> AppError:
    seconds = max(1, math.ceil(wait))
    return AppError(
        429,
        "rate_limited",
        f"Too many requests. Try again in {seconds} seconds.",
        headers={"Retry-After": str(seconds)},
    )


def check_demo_login(client_ip: str) -> None:
    settings = get_settings()
    if settings.rate_limit_enabled:
        wait = demo_logins.hit(client_ip, settings.rate_limit_demo_per_minute, 60)
        if wait:
            raise _too_many(wait)


def check_join(client_ip: str) -> None:
    settings = get_settings()
    if settings.rate_limit_enabled:
        wait = joins.hit(client_ip, settings.rate_limit_join_per_minute, 60)
        if wait:
            raise _too_many(wait)


def _passcode_key(client_ip: str, meeting_code: str) -> str:
    return f"{client_ip}|{meeting_code}"


def check_passcode_allowed(client_ip: str, meeting_code: str) -> None:
    """Raise 429 if this IP guessed wrong too often for this meeting."""
    settings = get_settings()
    if settings.rate_limit_enabled:
        wait = passcode_failures.wait_time(
            _passcode_key(client_ip, meeting_code),
            settings.rate_limit_passcode_failures,
            settings.rate_limit_passcode_window_seconds,
        )
        if wait:
            raise _too_many(wait)


def record_passcode_failure(client_ip: str, meeting_code: str) -> None:
    if get_settings().rate_limit_enabled:
        passcode_failures.record(_passcode_key(client_ip, meeting_code))


def check_chat(meeting_id: int, participant_id: int) -> float:
    """Count one chat message. Return 0 if allowed, or the seconds to wait."""
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return 0.0
    return chat_messages.hit(
        f"{meeting_id}|{participant_id}",
        settings.chat_rate_limit_messages,
        settings.chat_rate_limit_window_seconds,
    )


def sweep_all() -> None:
    """Forget old keys, so the memory does not grow. The reaper calls it."""
    demo_logins.sweep(60)
    joins.sweep(60)
    passcode_failures.sweep(get_settings().rate_limit_passcode_window_seconds)
    chat_messages.sweep(get_settings().chat_rate_limit_window_seconds)


def reset_all() -> None:
    """Forget every counter. For tests."""
    for window in (demo_logins, joins, passcode_failures, chat_messages):
        window.clear()
