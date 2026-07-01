from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..db import get_session
from ..models import GeneratorConfig, Piece, Scale
from ..services import generator

router = APIRouter(prefix="/generator", tags=["generator"])

_WEIGHT_KEYS = ["scales", "etudes", "reading", "piece", "polyrhythm", "fun"]


def _get_or_create_config(session: Session) -> GeneratorConfig:
    cfg = session.get(GeneratorConfig, 1)
    if cfg is None:
        cfg = GeneratorConfig(id=1)
        session.add(cfg)
        session.commit()
        session.refresh(cfg)
    return cfg


def _weights(cfg: GeneratorConfig) -> dict[str, float]:
    raw = {
        "scales": cfg.w_scales,
        "etudes": cfg.w_etudes,
        "reading": cfg.w_reading,
        "piece": cfg.w_piece,
        "polyrhythm": cfg.w_polyrhythm,
        "fun": cfg.w_fun,
    }
    total = sum(v for v in raw.values() if v > 0) or 1.0
    return {k: max(0.0, v) / total for k, v in raw.items()}  # normalise to sum 1


class GeneratorConfigUpdate(BaseModel):
    w_scales: float | None = Field(default=None, ge=0)
    w_etudes: float | None = Field(default=None, ge=0)
    w_reading: float | None = Field(default=None, ge=0)
    w_piece: float | None = Field(default=None, ge=0)
    w_polyrhythm: float | None = Field(default=None, ge=0)
    w_fun: float | None = Field(default=None, ge=0)
    default_total_min: int | None = Field(default=None, ge=10, le=1440)


@router.get("/config", response_model=GeneratorConfig)
def get_config(session: Session = Depends(get_session)):
    return _get_or_create_config(session)


@router.put("/config", response_model=GeneratorConfig)
def update_config(data: GeneratorConfigUpdate, session: Session = Depends(get_session)):
    cfg = _get_or_create_config(session)
    updates = data.model_dump(exclude_unset=True)
    if all(updates.get(f"w_{k}", getattr(cfg, f"w_{k}")) <= 0 for k in _WEIGHT_KEYS):
        # Refuse an all-zero split (would produce an empty session).
        updates = {k: v for k, v in updates.items() if not k.startswith("w_")}
    cfg.sqlmodel_update(updates)
    session.add(cfg)
    session.commit()
    session.refresh(cfg)
    return cfg


@router.get("/session")
def generate(
    total_min: int = Query(90, ge=10, le=1440),  # up to 24 h — no artificial 4 h cap
    weekday: int | None = Query(None, ge=0, le=6, description="0=lundi..6=dimanche; défaut = aujourd'hui"),
    session: Session = Depends(get_session),
):
    """Build today's practice session from the live repertoire + scales + config."""
    wd = weekday if weekday is not None else date.today().weekday()
    cfg = _get_or_create_config(session)
    scales = session.exec(select(Scale)).all()
    pieces = session.exec(select(Piece)).all()
    return generator.generate_session(
        total_min=total_min,
        weekday=wd,
        weights=_weights(cfg),
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
