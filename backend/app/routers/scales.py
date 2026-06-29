from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from ..db import get_session
from ..models import Hands, Scale, ScaleType

router = APIRouter(prefix="/scales", tags=["scales"])


class ScaleCreate(SQLModel):
    key: str
    type: ScaleType = ScaleType.major
    hands: Hands = Hands.separate
    current_bpm: int | None = None
    target_bpm: int = 120
    mastered: bool = False


class ScaleUpdate(SQLModel):
    key: str | None = None
    type: ScaleType | None = None
    hands: Hands | None = None
    current_bpm: int | None = None
    target_bpm: int | None = None
    mastered: bool | None = None
    last_practiced: date | None = None


@router.get("", response_model=list[Scale])
def list_scales(session: Session = Depends(get_session)):
    return session.exec(select(Scale).order_by(Scale.type, Scale.key)).all()


@router.post("", response_model=Scale, status_code=201)
def create_scale(data: ScaleCreate, session: Session = Depends(get_session)):
    obj = Scale(**data.model_dump())
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{scale_id}", response_model=Scale)
def update_scale(scale_id: int, data: ScaleUpdate, session: Session = Depends(get_session)):
    obj = session.get(Scale, scale_id)
    if not obj:
        raise HTTPException(404, "Gamme introuvable")
    updates = data.model_dump(exclude_unset=True)
    # Bumping the BPM counts as practising it today.
    if "current_bpm" in updates and "last_practiced" not in updates:
        updates["last_practiced"] = date.today()
    obj.sqlmodel_update(updates)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{scale_id}", status_code=204)
def delete_scale(scale_id: int, session: Session = Depends(get_session)):
    obj = session.get(Scale, scale_id)
    if not obj:
        raise HTTPException(404, "Gamme introuvable")
    session.delete(obj)
    session.commit()
