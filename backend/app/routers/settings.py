from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings, write_env_values

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsOut(BaseModel):
    gemini_configured: bool
    gemini_model: str
    video_local_only: bool
    data_dir: str


class SettingsUpdate(BaseModel):
    gemini_api_key: str | None = None  # write-only; never echoed back
    gemini_model: str | None = None
    video_local_only: bool | None = None


def _current() -> SettingsOut:
    return SettingsOut(
        gemini_configured=settings.gemini_enabled,
        gemini_model=settings.gemini_model,
        video_local_only=settings.video_local_only,
        data_dir=str(settings.data_path),
    )


@router.get("", response_model=SettingsOut)
def get_settings():
    return _current()


@router.put("", response_model=SettingsOut)
def update_settings(data: SettingsUpdate):
    values: dict[str, str] = {}
    if data.gemini_api_key is not None:
        values["GEMINI_API_KEY"] = data.gemini_api_key.strip()
    if data.gemini_model is not None:
        values["GEMINI_MODEL"] = data.gemini_model.strip()
    if data.video_local_only is not None:
        values["VIDEO_LOCAL_ONLY"] = "true" if data.video_local_only else "false"
    if values:
        write_env_values(values)
    return _current()
