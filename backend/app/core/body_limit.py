"""Refuse a request body that is larger than a limit (413), before the app parses it.

A plain ASGI middleware:
- With `Content-Length`, the check uses the header. The body is not read.
- Without it (chunked upload), the middleware reads the body up to the limit, then
  gives the same messages to the app. It stops reading when the limit is passed.
"""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


def _too_large(max_bytes: int) -> JSONResponse:
    return JSONResponse(
        {
            "detail": f"The request body is larger than {max_bytes} bytes.",
            "code": "payload_too_large",
        },
        status_code=413,
    )


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        length = dict(scope["headers"]).get(b"content-length")
        if length is not None:
            if not length.isdigit() or int(length) > self.max_bytes:
                await _too_large(self.max_bytes)(scope, receive, send)
                return
            await self.app(scope, receive, send)
            return

        messages: list[Message] = []
        size = 0
        while True:
            message = await receive()
            messages.append(message)
            if message["type"] != "http.request":
                break  # the client went away
            size += len(message.get("body", b""))
            if size > self.max_bytes:
                await _too_large(self.max_bytes)(scope, receive, send)
                return
            if not message.get("more_body", False):
                break

        async def replay() -> Message:
            return messages.pop(0) if messages else await receive()

        await self.app(scope, replay, send)
