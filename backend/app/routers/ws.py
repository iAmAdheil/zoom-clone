"""The meeting WebSocket: /ws/meetings/{code}?ticket=<ws_ticket>.

Each socket runs two tasks:
- The reader applies client events (`set_muted`, `set_video_off`, `leave`).
- The writer sends the queue that the room manager fills, then closes on a `Close` item.

Database work runs in a worker thread with a short session, so it does not block the loop.
"""

from collections.abc import Callable
from typing import Annotated, Any

import anyio
from asyncer import asyncify
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.db import get_session_factory
from app.core.errors import AppError
from app.schemas.ws import Leave, client_event_adapter
from app.services import room_service
from app.services.room_manager import CLOSE_NORMAL, Close, Connection, room_manager
from app.services.room_service import Seat

router = APIRouter(tags=["realtime"])

SessionFactoryDep = Annotated[Callable[[], Session], Depends(get_session_factory)]


async def _with_db(open_db: Callable[[], Session], fn: Callable[..., Any], *args: Any) -> Any:
    """Run `fn(db, *args)` in a worker thread with a new session."""

    def work() -> Any:
        with open_db() as db:
            return fn(db, *args)

    return await asyncify(work)()


async def _reject(websocket: WebSocket, exc: AppError) -> None:
    """Close with 4000 + the HTTP status (4401, 4403, 4404, 4410). The reason is the code."""
    await websocket.close(code=4000 + exc.status_code, reason=exc.code)


async def _write_loop(websocket: WebSocket, conn: Connection, scope: anyio.CancelScope) -> None:
    try:
        while True:
            item = await conn.queue.get()
            if isinstance(item, Close):
                await websocket.close(code=item.code, reason=item.reason)
                return
            await websocket.send_json(item)
    except (WebSocketDisconnect, RuntimeError, OSError):
        pass  # The client is gone. The cleanup in meeting_socket runs next.
    finally:
        scope.cancel()  # Stop the reader too.


async def _read_loop(
    websocket: WebSocket, conn: Connection, seat: Seat, open_db: Callable[[], Session]
) -> None:
    while True:
        message = await websocket.receive()
        if message["type"] == "websocket.disconnect":
            return
        try:
            event = client_event_adapter.validate_json(message.get("text") or "")
        except ValidationError:
            conn.push({"type": "error", "code": "bad_event", "detail": "Unknown or bad event."})
            continue
        if isinstance(event, Leave):
            # Close every socket of this participant. The last cleanup sets `left_at`.
            room_manager.close_participant(
                seat.meeting_code, seat.participant_id, CLOSE_NORMAL, "left"
            )
        else:
            await _with_db(open_db, room_service.set_media_state, seat, event)


async def _serve(
    websocket: WebSocket, conn: Connection, seat: Seat, open_db: Callable[[], Session]
) -> None:
    try:
        snapshot = await _with_db(open_db, room_service.enter_room, seat)
    except AppError as exc:
        await _reject(websocket, exc)
        return
    # Send the snapshot first. Events that arrive meanwhile wait in the queue.
    await websocket.send_json(snapshot)
    async with anyio.create_task_group() as tg:
        tg.start_soon(_write_loop, websocket, conn, tg.cancel_scope)
        await _read_loop(websocket, conn, seat, open_db)
        tg.cancel_scope.cancel()


@router.websocket("/ws/meetings/{code}")
async def meeting_socket(
    websocket: WebSocket,
    code: str,
    open_db: SessionFactoryDep,
    ticket: Annotated[str | None, Query()] = None,
) -> None:
    # Accept first, so a browser sees the close code and reason of a rejection.
    await websocket.accept()
    try:
        seat = await _with_db(open_db, room_service.take_seat, code, ticket)
    except AppError as exc:
        await _reject(websocket, exc)
        return

    # Join the room before the snapshot is read, so no event falls between the two.
    conn = room_manager.connect(seat.meeting_code, seat.participant_id)
    try:
        await _serve(websocket, conn, seat, open_db)
    except WebSocketDisconnect:
        pass
    finally:
        # Shield the cleanup: a server shutdown or a test client cancels this task.
        with anyio.CancelScope(shield=True):
            if room_manager.disconnect(seat.meeting_code, conn):
                await _with_db(open_db, room_service.leave_room, seat)
