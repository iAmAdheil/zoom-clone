from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./zoomclone.db"
    jwt_secret: str = "dev-only-secret-change-me-in-production"
    google_client_id: str | None = None
    google_client_secret: str | None = None
    frontend_origin: str = "http://localhost:3000"
    enable_demo_login: bool = False

    session_days: int = 7
    ws_ticket_seconds: int = 60

    @property
    def google_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def cookie_secure(self) -> bool:
        return self.frontend_origin.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
