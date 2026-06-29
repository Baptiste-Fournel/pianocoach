from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from ..db import get_session
from ..models import Piece, Scale
from ..services import generator

router = APIRouter(prefix="/generator", tags=["generator"])


@router.get("/session")
def generate(
    total_min: int = Query(90, ge=10, le=480),
    weekday: int | None = Query(None, ge=0, le=6, description="0=lundi..6=dimanche; défaut = aujourd'hui"),
    session: Session = Depends(get_session),
):
    """Build today's practice session from the live repertoire + scales."""
    wd = weekday if weekday is not None else date.today().weekday()
    scales = session.exec(select(Scale)).all()
    pieces = session.exec(select(Piece)).all()
    return generator.generate_session(
        total_min=total_min,
        weekday=wd,
        scales=[
            generator.ScaleLike(
                key=s.key, type=s.type.value, mastered=s.mastered,
                current_bpm=s.current_bpm, target_bpm=s.target_bpm,
            )
            for s in scales
        ],
        pieces=[
            generator.PieceLike(
                title=p.title, status=p.status.value, progress_pct=p.progress_pct,
                target_tempo=p.target_tempo, current_clean_tempo=p.current_clean_tempo,
            )
            for p in pieces
        ],
    )
