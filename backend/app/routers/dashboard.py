from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import Milestone, Piece, PracticeSession, ReadingLog, Scale
from ..services import gauges, projections, stats, summaries

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(session: Session = Depends(get_session)):
    ref = date.today()
    pieces = session.exec(select(Piece)).all()
    sessions = session.exec(select(PracticeSession)).all()
    scales = session.exec(select(Scale)).all()
    milestones = session.exec(select(Milestone)).all()
    reading = session.exec(select(ReadingLog)).all()

    proj = projections.project_all_targets(
        [summaries.piece_proj(p) for p in pieces],
        [summaries.session_proj(s) for s in sessions],
        reference_date=ref,
    )
    readiness = gauges.all_readiness(
        [summaries.piece_gauge(p) for p in pieces],
        [summaries.scale_gauge(s) for s in scales],
        [summaries.milestone_gauge(m) for m in milestones],
        [summaries.reading_gauge(r) for r in reading],
    )

    return {
        "totals": stats.practice_totals(sessions, ref),
        "streak": stats.compute_streak([s.date for s in sessions], ref),
        "focus_distribution": stats.focus_distribution(sessions),
        "daily_minutes": stats.daily_minutes(sessions, ref, days=84),
        "projections": proj,
        "readiness": readiness,
        "scale_bpm": [
            {
                "key": s.key,
                "type": s.type.value,
                "current_bpm": s.current_bpm,
                "target_bpm": s.target_bpm,
                "mastered": s.mastered,
            }
            for s in scales
        ],
        "repertoire_counts": {
            "target": sum(1 for p in pieces if p.status.value == "target"),
            "in_progress": sum(1 for p in pieces if p.status.value == "in_progress"),
            "planned": sum(1 for p in pieces if p.status.value == "planned"),
            "learned": sum(1 for p in pieces if p.status.value == "learned"),
        },
        "milestone_progress": {
            "done": sum(1 for m in milestones if m.done),
            "total": len(milestones),
        },
    }
