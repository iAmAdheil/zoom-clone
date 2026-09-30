from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-secret-change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./zoomclone.db"
    environment: str = "development"
    jwt_secret: str = DEV_JWT_SECRET
    google_client_id: str | None = None
    google_client_secret: str | None = None
    frontend_origin: str = "http://localhost:3000"
    enable_demo_login: bool = False

    session_days: int = 7
    ws_ticket_seconds: int = 60
    rejoin_token_hours: int = 12

    # Database. SQLite waits this long for a write lock before it gives up.
    db_busy_timeout_ms: int = 5000
    # Worker threads for the database work of WebSockets. REST requests use their own pool.
    ws_db_threads: int = 20

    # Presence. A participant who joined by REST but has no open socket after this time
    # is not in the room. The reaper then sets `left_at`.
    presence_grace_seconds: int = 60
    # How often the reaper runs. 0 turns it off.
    reaper_interval_seconds: float = 15
    # The reaper ends a live meeting when nobody was connected for this long.
    idle_meeting_minutes: int = 10
    # The reaper ends a live meeting that is older than this.
    max_meeting_hours: int = 24
    # More sockets than this for one participant close the oldest one.
    max_sockets_per_participant: int = 3

    # The largest request body. A larger body gets 413.
    max_body_bytes: int = 64 * 1024

    # Rate limits (sliding window, in memory, per process).
    rate_limit_enabled: bool = True
    rate_limit_demo_per_minute: int = 30
    rate_limit_join_per_minute: int = 60
    rate_limit_passcode_failures: int = 10
    rate_limit_passcode_window_seconds: int = 300
    # Take the client IP from the first `X-Forwarded-For` entry (set by Render).
    # Turn it off when the server is not behind a proxy that sets the header.
    trust_forwarded_for: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    def check_secrets(self) -> None:
        """Stop the server at startup if production runs with the dev JWT secret."""
        if self.is_production and self.jwt_secret == DEV_JWT_SECRET:
            raise RuntimeError(
                "JWT_SECRET is the development default, and ENVIRONMENT is 'production'. "
                "Set JWT_SECRET to a long random string. "
                'Example: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def cookie_secure(self) -> bool:
        """Cookies get the Secure flag in production, or when the frontend uses https."""
        return self.is_production or self.frontend_origin.startswith("https://")

    @property
    def allowed_origin(self) -> str:
        """The one browser origin allowed for CORS and the WebSocket. No trailing slash."""
        return self.frontend_origin.strip().rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
