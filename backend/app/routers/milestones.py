from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, SQLModel, select

from ..db import get_session
from ..models import Horizon, Milestone

router = APIRouter(prefix="/milestones", tags=["milestones"])


class MilestoneCreate(SQLModel):
    label: str
    horizon: Horizon = Horizon.m3


class MilestoneUpdate(SQLModel):
    label: str | None = None
    horizon: Horizon | None = None
    done: bool | None = None
    order_index: int | None = None


@router.get("", response_model=list[Milestone])
def list_milestones(session: Session = Depends(get_session)):
    return session.exec(select(Milestone).order_by(Milestone.horizon, Milestone.order_index)).all()


@router.post("", response_model=Milestone, status_code=201)
def create_milestone(data: MilestoneCreate, session: Session = Depends(get_session)):
    max_idx = session.exec(
        select(Milestone.order_index).where(Milestone.horizon == data.horizon).order_by(Milestone.order_index.desc())
    ).first()
    obj = Milestone(**data.model_dump(), order_index=(max_idx or 0) + 1)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.patch("/{milestone_id}", response_model=Milestone)
def update_milestone(milestone_id: int, data: MilestoneUpdate, session: Session = Depends(get_session)):
    obj = session.get(Milestone, milestone_id)
    if not obj:
        raise HTTPException(404, "Jalon introuvable")
    updates = data.model_dump(exclude_unset=True)
    # Toggling done auto-stamps / clears the completion date.
    if "done" in updates:
        obj.date_done = date.today() if updates["done"] else None
    obj.sqlmodel_update(updates)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: int, session: Session = Depends(get_session)):
    obj = session.get(Milestone, milestone_id)
    if not obj:
        raise HTTPException(404, "Jalon introuvable")
    session.delete(obj)
    session.commit()
