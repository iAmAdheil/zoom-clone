#!/bin/sh
# Start the API in the container.
# 1. Create or update the tables.
# 2. Seed demo data, only if the database has no users.
# 3. Start uvicorn.
set -eu

alembic upgrade head

# app.seed does nothing when the users table already has a row.
python -m app.seed

# --proxy-headers and --forwarded-allow-ips make uvicorn trust the Render proxy.
# Then the app sees the real scheme (https) and the real client address.
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips='*'
