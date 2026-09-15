from pydantic import Field
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "AutoYT Backend"
    api_v1_prefix: str = "/api/v1"
    database_url: str = Field(default="sqlite:///./autoyt.db")
    max_retries: int = 3
    # TODO: añadir configuraciones de YouTube OAuth, Redis, etc.

    model_config = {
        "env_file": ".env",
        # Env var names are case-insensitive on Windows; with True, DATABASE_URL was silently ignored.
        "case_sensitive": False,
    }

@lru_cache
def get_settings() -> Settings:
    return Settings()
