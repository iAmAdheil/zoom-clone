"""index participants.user_id and meetings.status

Recent meetings and the join path filter participants by user_id (BUG-16).
The reaper filters meetings by status every 15 seconds.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-30 12:00:00

"""
from typing import Sequence, Union

from alembic import op


revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_participants_user_id", "participants", ["user_id"], unique=False)
    op.create_index("ix_meetings_status", "meetings", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_meetings_status", table_name="meetings")
    op.drop_index("ix_participants_user_id", table_name="participants")
