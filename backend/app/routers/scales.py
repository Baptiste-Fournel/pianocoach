from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Field, Session, SQLModel, select

from ..db import get_session
from ..models import Hands, Scale, ScaleBpmLog, ScaleType

router = APIRouter(prefix="/scales", tags=["scales"])


class ScaleCreate(SQLModel):
    key: str
    type: ScaleType = ScaleType.major
    hands: Hands = Hands.separate
    current_bpm: int | None = Field(default=None, ge=0)
    target_bpm: int = Field(default=120, ge=1)
    mastered: bool = False


class ScaleUpdate(SQLModel):
    key: str | None = None
    type: ScaleType | None = None
    hands: Hands | None = None
    current_bpm: int | None = Field(default=None, ge=0)
    target_bpm: int | None = Field(default=None, ge=1)
    mastered: bool | None = None
    last_practiced: date | None = None


@router.get("", response_model=list[Scale])
def list_scales(session: Session = Depends(get_session)):
    return session.exec(select(Scale).order_by(Scale.type, Scale.key)).all()


@router.get("/bpm-history")
def bpm_history(session: Session = Depends(get_session)):
    """BPM history grouped per scale, ready for line charts."""
    logs = session.exec(select(ScaleBpmLog).order_by(ScaleBpmLog.date, ScaleBpmLog.id)).all()
    scales = {s.id: s for s in session.exec(select(Scale)).all()}
    grouped: dict[int, dict] = {}
    for log in logs:
        sc = scales.get(log.scale_id)
        g = grouped.setdefault(
            log.scale_id,
            {
                "scale_id": log.scale_id,
                "key": sc.key if sc else "?",
                "type": sc.type.value if sc else "major",
                "target_bpm": sc.target_bpm if sc else None,
                "points": [],
            },
        )
        g["points"].append({"date": log.date.isoformat(), "bpm": log.bpm})
    return list(grouped.values())


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
    # Bumping the BPM counts as practising it today + records a history point.
    new_bpm = updates.get("current_bpm")
    if "current_bpm" in updates and new_bpm is not None:
        if "last_practiced" not in updates:
            updates["last_practiced"] = date.today()
        session.add(ScaleBpmLog(scale_id=scale_id, bpm=new_bpm))
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
    # Remove the scale's BPM history first (no ON DELETE rule in the schema).
    for log in session.exec(select(ScaleBpmLog).where(ScaleBpmLog.scale_id == scale_id)).all():
        session.delete(log)
    session.flush()  # apply child deletes before removing the parent (FK order)
    session.delete(obj)
    session.commit()
