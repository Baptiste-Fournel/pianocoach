"""Runtime configuration, loaded from environment / .env.

Settings are also writable at runtime from the Settings UI (Gemini key,
video-local-only toggle, weekly rotation, target tempos) and persisted to the
.env file so they survive restarts.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root = two levels up from this file (backend/app/config.py -> repo root).
REPO_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = REPO_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    video_local_only: bool = False
    data_dir: str = "./data"

    @property
    def data_path(self) -> Path:
        p = Path(self.data_dir)
        if not p.is_absolute():
            p = REPO_ROOT / p
        return p.resolve()

    @property
    def db_path(self) -> Path:
        return self.data_path / "pianocoach.db"

    @property
    def videos_path(self) -> Path:
        return self.data_path / "videos"

    @property
    def analysis_path(self) -> Path:
        return self.data_path / "analysis"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    def ensure_dirs(self) -> None:
        for p in (self.data_path, self.videos_path, self.analysis_path):
            p.mkdir(parents=True, exist_ok=True)

    @property
    def gemini_enabled(self) -> bool:
        return bool(self.gemini_api_key.strip())


settings = Settings()


def reload_settings() -> Settings:
    """Re-read settings from the .env file (after a runtime update)."""
    global settings
    settings = Settings()
    return settings


def write_env_values(values: dict[str, str]) -> Settings:
    """Upsert KEY=value lines in the .env file, then reload settings.

    Used by the Settings UI so changes (Gemini key, local-only toggle, model)
    survive restarts. Existing unrelated lines/comments are preserved.
    """
    lines: list[str] = []
    if ENV_FILE.exists():
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()

    remaining = dict(values)
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if "=" in stripped and not stripped.startswith("#"):
            key = stripped.split("=", 1)[0].strip()
            if key in remaining:
                out.append(f"{key}={remaining.pop(key)}")
                continue
        out.append(line)
    for key, val in remaining.items():
        out.append(f"{key}={val}")

    ENV_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")
    return reload_settings()
