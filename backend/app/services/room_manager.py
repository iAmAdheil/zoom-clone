"""Realtime room hook.

The REST services call `room_manager.broadcast(...)` after they change state.
Today this does nothing except log. The WebSocket task fills it in.

What the WebSocket task must do here:
1. Keep a map of meeting_code -> connected sockets.
2. Implement `broadcast` so it sends the event to every socket in the room.
   The services call it from sync code in a worker thread. Use
   `asyncio.run_coroutine_threadsafe` (or an anyio portal) to reach the event loop.
3. In `routers/ws.py`, call `core.security.verify_ws_ticket` on the `ticket` query
   parameter. Reject a `jti` that was used before (single use).

Events that the services send (see docs/api.md):
  participant_joined, participant_left, participant_updated,
  you_were_removed, mute_all, meeting_ended
Each event is a dict: {"type": "<event>", ...payload}.
"""

import logging

logger = logging.getLogger(__name__)


class RoomManager:
    def broadcast(self, meeting_code: str, event: dict) -> None:
        """Send `event` to every socket in the room. No-op until the WebSocket task."""
        logger.debug("room event (no websocket yet): %s %s", meeting_code, event)


room_manager = RoomManager()
