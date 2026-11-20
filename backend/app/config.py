import os
from dataclasses import dataclass, field


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///./links.db"
    # short links are built as <short_base_url>/<code>
    short_base_url: str = "http://localhost:8104"
    seed_demo_data: bool = True
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:4304"])

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_url=os.getenv("DATABASE_URL", cls.database_url),
            short_base_url=os.getenv("SHORT_BASE_URL", cls.short_base_url).rstrip("/"),
            seed_demo_data=_env_bool("SEED_DEMO_DATA", True),
            cors_origins=_env_list("CORS_ORIGINS", ["http://localhost:4304"]),
        )
