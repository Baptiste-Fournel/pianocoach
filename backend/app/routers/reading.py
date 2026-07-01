from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Field, Session, SQLModel, select

from ..db import get_session
from ..models import ClefFocus, ReadingLog

router = APIRouter(prefix="/reading", tags=["reading"])


class ReadingCreate(SQLModel):
    date: dt.date | None = None
    clef_focus: ClefFocus = ClefFocus.both
    material: str = ""
    minutes: int = Field(default=0, ge=0)
    notes: str = ""


class ReadingUpdate(SQLModel):
    date: dt.date | None = None
    clef_focus: ClefFocus | None = None
    material: str | None = None
    minutes: int | None = Field(default=None, ge=0)
    notes: str | None = None


@router.get("", response_model=list[ReadingLog])
def list_reading(limit: int = Query(200, ge=1, le=1000), session: Session = Depends(get_session)):
    return session.exec(
        select(ReadingLog).order_by(ReadingLog.date.desc(), ReadingLog.id.desc()).limit(limit)
    ).all()


@router.post("", response_model=ReadingLog, status_code=201)
def create_reading(data: ReadingCreate, session: Session = Depends(get_session)):
    payload = data.model_dump()
    if payload.get("date") is None:
        payload["date"] = dt.date.today()
    obj = ReadingLog(**payload)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{log_id}", response_model=ReadingLog)
def update_reading(log_id: int, data: ReadingUpdate, session: Session = Depends(get_session)):
    obj = session.get(ReadingLog, log_id)
    if not obj:
        raise HTTPException(404, "Entrée introuvable")
    obj.sqlmodel_update(data.model_dump(exclude_unset=True))
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{log_id}", status_code=204)
def delete_reading(log_id: int, session: Session = Depends(get_session)):
    obj = session.get(ReadingLog, log_id)
    if not obj:
        raise HTTPException(404, "Entrée introuvable")
    session.delete(obj)
    session.commit()
