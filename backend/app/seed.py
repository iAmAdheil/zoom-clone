"""Seed demo data. Run `alembic upgrade head` first, then `uv run python -m app.seed`.

Use `--reset` to delete all rows and seed again.
"""

import argparse
import random
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models import (
    Meeting,
    MeetingAccess,
    MeetingStatus,
    MeetingType,
    Participant,
    ParticipantRole,
    User,
)
from app.services.auth_service import DEMO_EMAIL, DEMO_NAME
from app.services.meeting_service import generate_code, now

OTHER_USERS = [
    ("alice@example.com", "Alice Nguyen"),
    ("bob@example.com", "Bob Martins"),
    ("carla@example.com", "Carla Ortiz"),
]

UPCOMING = [
    ("Weekly team sync", 1, 10, 30, None, MeetingAccess.allow_guests),
    ("Design review", 2, 15, 45, "246810", MeetingAccess.verified_only),
    ("Customer call: Acme", 4, 9, 60, None, MeetingAccess.allow_guests),
    ("Quarterly planning", 7, 13, 90, "135790", MeetingAccess.verified_only),
]

ENDED_TITLES = [
    "Standup",
    "Sprint retro",
    "Onboarding session",
    "Product demo",
    "1:1 with Alice",
    "Bug triage",
    "Architecture chat",
    "Hiring sync",
]

GUEST_NAMES = ["Guest Dev", "Sam (guest)", "Priya K", "Visitor"]


def _participant(meeting, user, name, role, joined, left, rng):
    return Participant(
        meeting_id=meeting.id,
        user_id=user.id if user else None,
        display_name=name,
        role=role,
        joined_at=joined,
        left_at=left,
        is_muted=rng.random() < 0.3,
        is_video_off=rng.random() < 0.3,
    )


def seed(db: Session, reset: bool = False) -> None:
    if reset:
        for model in (Participant, Meeting, User):
            db.execute(delete(model))
        db.commit()
    elif db.scalar(select(User.id).limit(1)) is not None:
        print("Database already has users. Use --reset to seed again.")
        return

    rng = random.Random(7)
    demo = User(email=DEMO_EMAIL, name=DEMO_NAME, is_demo=True)
    others = [User(email=e, name=n) for e, n in OTHER_USERS]
    db.add_all([demo, *others])
    db.commit()

    base = now().replace(minute=0, second=0, microsecond=0)

    for title, days, hour, duration, passcode, access in UPCOMING:
        start = (base + timedelta(days=days)).replace(hour=hour)
        db.add(
            Meeting(
                meeting_code=generate_code(db),
                host_id=demo.id,
                title=title,
                description=f"{title}. Agenda to follow.",
                type=MeetingType.scheduled,
                status=MeetingStatus.scheduled,
                access=access,
                passcode=passcode,
                scheduled_start=start,
                duration_min=duration,
                timezone="Asia/Kolkata",
            )
        )
        db.commit()

    everyone = [demo, *others]
    for i, title in enumerate(ENDED_TITLES):
        host = demo if i % 2 == 0 else others[i % len(others)]
        started = (base - timedelta(days=i + 1)).replace(hour=10 + i % 6)
        length = rng.choice([25, 30, 45, 60])
        scheduled = i % 3 == 0
        meeting = Meeting(
            meeting_code=generate_code(db),
            host_id=host.id,
            title=title,
            type=MeetingType.scheduled if scheduled else MeetingType.instant,
            status=MeetingStatus.ended,
            access=MeetingAccess.allow_guests,
            scheduled_start=started if scheduled else None,
            duration_min=length if scheduled else None,
            timezone="Asia/Kolkata" if scheduled else "UTC",
            started_at=started,
            ended_at=started + timedelta(minutes=length),
        )
        db.add(meeting)
        db.commit()

        end = meeting.ended_at
        db.add(_participant(meeting, host, host.name, ParticipantRole.host, started, end, rng))
        guests = [u for u in everyone if u.id != host.id]
        for user in rng.sample(guests, k=rng.randint(1, len(guests))):
            joined = started + timedelta(minutes=rng.randint(0, 5))
            db.add(
                _participant(meeting, user, user.name, ParticipantRole.attendee, joined, end, rng)
            )
        if i % 2:
            joined = started + timedelta(minutes=3)
            left = end - timedelta(minutes=rng.randint(0, 10))
            name = GUEST_NAMES[i % len(GUEST_NAMES)]
            db.add(_participant(meeting, None, name, ParticipantRole.attendee, joined, left, rng))
        db.commit()

    print(
        f"Seeded 4 users, {len(UPCOMING)} upcoming meetings, {len(ENDED_TITLES)} ended meetings. "
        f"Demo user: {DEMO_EMAIL}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo data.")
    parser.add_argument("--reset", action="store_true", help="Delete all rows first.")
    args = parser.parse_args()
    with SessionLocal() as db:
        seed(db, reset=args.reset)


if __name__ == "__main__":
    main()
