from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from ..db import get_session
from ..models import PracticeSession

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionCreate(SQLModel):
    date: dt.date | None = None
    duration_min: int = 0
    focus_areas: list[str] = []
    pieces_worked: list[str] = []
    tension_level: int | None = None
    mood: str = ""
    notes: str = ""


class SessionUpdate(SQLModel):
    date: dt.date | None = None
    duration_min: int | None = None
    focus_areas: list[str] | None = None
    pieces_worked: list[str] | None = None
    tension_level: int | None = None
    mood: str | None = None
    notes: str | None = None


@router.get("", response_model=list[PracticeSession])
def list_sessions(limit: int = 200, session: Session = Depends(get_session)):
    return session.exec(
        select(PracticeSession).order_by(PracticeSession.date.desc(), PracticeSession.id.desc()).limit(limit)
    ).all()


@router.post("", response_model=PracticeSession, status_code=201)
def create_session(data: SessionCreate, session: Session = Depends(get_session)):
    payload = data.model_dump()
    if payload.get("date") is None:
        payload["date"] = dt.date.today()
    obj = PracticeSession(**payload)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{session_id}", response_model=PracticeSession)
def update_session(session_id: int, data: SessionUpdate, session: Session = Depends(get_session)):
    obj = session.get(PracticeSession, session_id)
    if not obj:
        raise HTTPException(404, "Séance introuvable")
    obj.sqlmodel_update(data.model_dump(exclude_unset=True))
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, session: Session = Depends(get_session)):
    obj = session.get(PracticeSession, session_id)
    if not obj:
        raise HTTPException(404, "Séance introuvable")
    session.delete(obj)
    session.commit()
