"""Print session tokens as JSON: {"<user_id>": "<jwt>"}.

Run with the backend venv of the running server, so the same JWT secret is used:
  <repo>/backend/.venv/bin/python qa/mint_tokens.py <backend_dir> 1 2 3 4
The script only reads settings. It does not change the database.
"""

import json
import os
import sys

backend = sys.argv[1]
os.chdir(backend)
sys.path.insert(0, backend)

from app.core.security import create_session_token  # noqa: E402

print(json.dumps({uid: create_session_token(int(uid)) for uid in sys.argv[2:]}))
