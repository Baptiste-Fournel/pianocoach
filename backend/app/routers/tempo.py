from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from ..db import get_session
from ..models import Piece, TempoLog

router = APIRouter(prefix="/tempo", tags=["tempo"])


class TempoCreate(SQLModel):
    piece_id: int
    passage_label: str = ""
    bpm_clean: int
    date: dt.date | None = None


@router.get("", response_model=list[TempoLog])
def list_tempo(piece_id: int | None = None, session: Session = Depends(get_session)):
    q = select(TempoLog).order_by(TempoLog.date, TempoLog.id)
    if piece_id is not None:
        q = q.where(TempoLog.piece_id == piece_id)
    return session.exec(q).all()


@router.post("", response_model=TempoLog, status_code=201)
def log_tempo(data: TempoCreate, session: Session = Depends(get_session)):
    if not session.get(Piece, data.piece_id):
        raise HTTPException(404, "Pièce introuvable")
    payload = data.model_dump()
    if payload.get("date") is None:
        payload["date"] = dt.date.today()
    obj = TempoLog(**payload)
    session.add(obj)
    # Keep the piece's "current clean tempo" in sync with its best recent log.
    piece = session.get(Piece, data.piece_id)
    if piece and (piece.current_clean_tempo or 0) < data.bpm_clean:
        piece.current_clean_tempo = data.bpm_clean
        session.add(piece)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{log_id}", status_code=204)
def delete_tempo(log_id: int, session: Session = Depends(get_session)):
    obj = session.get(TempoLog, log_id)
    if not obj:
        raise HTTPException(404, "Entrée introuvable")
    session.delete(obj)
    session.commit()


@router.get("/progression")
def progression(session: Session = Depends(get_session)):
    """Tempo logs grouped per piece+passage, ready for line charts."""
    logs = session.exec(select(TempoLog).order_by(TempoLog.date, TempoLog.id)).all()
    pieces = {p.id: p for p in session.exec(select(Piece)).all()}
    grouped: dict[int, dict] = {}
    for log in logs:
        g = grouped.setdefault(
            log.piece_id,
            {
                "piece_id": log.piece_id,
                "piece_title": pieces.get(log.piece_id).title if pieces.get(log.piece_id) else "?",
                "target_tempo": pieces.get(log.piece_id).target_tempo if pieces.get(log.piece_id) else None,
                "points": [],
            },
        )
        g["points"].append(
            {
                "date": log.date.isoformat(),
                "bpm_clean": log.bpm_clean,
                "passage_label": log.passage_label,
            }
        )
    return list(grouped.values())
