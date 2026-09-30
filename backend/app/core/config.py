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
