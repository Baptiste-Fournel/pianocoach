from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session, session_scope
from ..models import Piece, Video

router = APIRouter(prefix="/videos", tags=["videos"])

_ALLOWED_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}


def run_analysis(video_id: int) -> None:
    """Background: local librosa metrics (always) + optional Gemini feedback."""
    from ..services import audio_analysis

    with session_scope() as s:
        v = s.get(Video, video_id)
        if not v:
            return
        v.analysis_status = "analyzing"
        s.add(v)
        s.commit()
        file_path = v.file_path
        piece_id = v.piece_id

    try:
        wav = settings.analysis_path / f"{video_id}.wav"
        audio_analysis.extract_audio(Path(file_path), wav)
        metrics = audio_analysis.analyze_audio(wav)

        ai_feedback = None
        if not settings.video_local_only and settings.gemini_enabled:
            from ..services import gemini

            piece_title = None
            if piece_id:
                with session_scope() as s:
                    p = s.get(Piece, piece_id)
                    piece_title = p.title if p else None
            ai_feedback = gemini.analyze_video(Path(file_path), metrics, piece_title)

        with session_scope() as s:
            v = s.get(Video, video_id)
            if v:
                v.audio_metrics = metrics
                v.ai_feedback = ai_feedback
                v.analysis_status = "done"
                s.add(v)
                s.commit()
    except Exception as e:  # pragma: no cover - depends on ffmpeg/librosa/network
        with session_scope() as s:
            v = s.get(Video, video_id)
            if v:
                v.analysis_status = "error"
                v.ai_feedback = {"error": str(e)}
                s.add(v)
                s.commit()


@router.get("", response_model=list[Video])
def list_videos(piece_id: int | None = None, session: Session = Depends(get_session)):
    q = select(Video).order_by(Video.date.desc())
    if piece_id is not None:
        q = q.where(Video.piece_id == piece_id)
    return session.exec(q).all()


@router.get("/{video_id}", response_model=Video)
def get_video(video_id: int, session: Session = Depends(get_session)):
    v = session.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Vidéo introuvable")
    return v


@router.get("/{video_id}/file")
def stream_video(video_id: int, session: Session = Depends(get_session)):
    v = session.get(Video, video_id)
    if not v or not v.file_path or not Path(v.file_path).exists():
        raise HTTPException(404, "Fichier vidéo introuvable")
    return FileResponse(v.file_path)


@router.post("", response_model=Video, status_code=201)
async def upload_video(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    piece_id: int | None = Form(None),
    self_notes: str = Form(""),
    session: Session = Depends(get_session),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_EXT:
        raise HTTPException(415, f"Format vidéo non supporté ({ext}).")

    settings.ensure_dirs()
    # Create the row first to get an id, then save the file as <id><ext>.
    v = Video(piece_id=piece_id, file_path="", self_notes=self_notes, analysis_status="pending")
    session.add(v)
    session.commit()
    session.refresh(v)

    dest = settings.videos_path / f"{v.id}{ext}"
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            out.write(chunk)

    v.file_path = str(dest)
    session.add(v)
    session.commit()
    session.refresh(v)

    background.add_task(run_analysis, v.id)
    return v


class VideoUpdate(BaseModel):
    self_notes: str | None = None
    piece_id: int | None = None


@router.patch("/{video_id}", response_model=Video)
def update_video(video_id: int, data: VideoUpdate, session: Session = Depends(get_session)):
    v = session.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Vidéo introuvable")
    v.sqlmodel_update(data.model_dump(exclude_unset=True))
    session.add(v)
    session.commit()
    session.refresh(v)
    return v


@router.post("/{video_id}/analyze", response_model=Video)
def reanalyze(video_id: int, background: BackgroundTasks, session: Session = Depends(get_session)):
    v = session.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Vidéo introuvable")
    v.analysis_status = "pending"
    session.add(v)
    session.commit()
    session.refresh(v)
    background.add_task(run_analysis, video_id)
    return v


@router.delete("/{video_id}", status_code=204)
def delete_video(video_id: int, session: Session = Depends(get_session)):
    v = session.get(Video, video_id)
    if not v:
        raise HTTPException(404, "Vidéo introuvable")
    # Remove the local file too.
    try:
        if v.file_path:
            Path(v.file_path).unlink(missing_ok=True)
    except OSError:
        pass
    session.delete(v)
    session.commit()
