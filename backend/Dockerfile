FROM python:3.13-slim

# uv installs the packages from uv.lock.
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

# The app runs as a user without root rights.
RUN useradd --create-home --uid 10001 app
WORKDIR /app
RUN chown app:app /app

USER app

# Install the packages first. Docker keeps this layer while the lock file does not change.
COPY --chown=app:app pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY --chown=app:app alembic.ini ./
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app app ./app
COPY --chown=app:app start.sh ./

# Render sets PORT. The default is for a local run.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "start.sh"]
