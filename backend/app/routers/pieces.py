from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from ..db import get_session
from ..models import Piece, PieceStatus, Track

router = APIRouter(prefix="/pieces", tags=["pieces"])


class PieceCreate(SQLModel):
    title: str
    composer: str
    status: PieceStatus = PieceStatus.planned
    track: Track = Track.common
    difficulty: int | None = None
    date_started: date | None = None
    date_completed: date | None = None
    progress_pct: int = 0
    target_tempo: int | None = None
    current_clean_tempo: int | None = None
    notes: str = ""


class PieceUpdate(SQLModel):
    title: str | None = None
    composer: str | None = None
    status: PieceStatus | None = None
    track: Track | None = None
    difficulty: int | None = None
    date_started: date | None = None
    date_completed: date | None = None
    progress_pct: int | None = None
    target_tempo: int | None = None
    current_clean_tempo: int | None = None
    order_index: int | None = None
    notes: str | None = None


@router.get("", response_model=list[Piece])
def list_pieces(session: Session = Depends(get_session)):
    return session.exec(select(Piece).order_by(Piece.track, Piece.order_index)).all()


@router.post("", response_model=Piece, status_code=201)
def create_piece(data: PieceCreate, session: Session = Depends(get_session)):
    # Append to the end of its track.
    max_idx = session.exec(
        select(Piece.order_index).where(Piece.track == data.track).order_by(Piece.order_index.desc())
    ).first()
    piece = Piece(**data.model_dump(), order_index=(max_idx or 0) + 1)
    session.add(piece)
    session.commit()
    session.refresh(piece)
    return piece


@router.get("/{piece_id}", response_model=Piece)
def get_piece(piece_id: int, session: Session = Depends(get_session)):
    piece = session.get(Piece, piece_id)
    if not piece:
        raise HTTPException(404, "Pièce introuvable")
    return piece


@router.patch("/{piece_id}", response_model=Piece)
def update_piece(piece_id: int, data: PieceUpdate, session: Session = Depends(get_session)):
    piece = session.get(Piece, piece_id)
    if not piece:
        raise HTTPException(404, "Pièce introuvable")
    updates = data.model_dump(exclude_unset=True)
    # Auto-stamp completion date when marked learned.
    if updates.get("status") == PieceStatus.learned and not piece.date_completed:
        updates.setdefault("date_completed", date.today())
        updates.setdefault("progress_pct", 100)
    piece.sqlmodel_update(updates)
    session.add(piece)
    session.commit()
    session.refresh(piece)
    return piece


@router.delete("/{piece_id}", status_code=204)
def delete_piece(piece_id: int, session: Session = Depends(get_session)):
    piece = session.get(Piece, piece_id)
    if not piece:
        raise HTTPException(404, "Pièce introuvable")
    session.delete(piece)
    session.commit()


@router.post("/reorder", response_model=list[Piece])
def reorder_pieces(ordered_ids: list[int], session: Session = Depends(get_session)):
    """Persist a new ordering (drag-and-drop). Body: [id, id, ...]."""
    for idx, pid in enumerate(ordered_ids):
        piece = session.get(Piece, pid)
        if piece:
            piece.order_index = idx
            session.add(piece)
    session.commit()
    return session.exec(select(Piece).order_by(Piece.track, Piece.order_index)).all()
