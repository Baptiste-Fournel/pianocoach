"""Adapters (ORM rows -> pure-service inputs) + the coach data summary.

Keeps the pure services (projections/gauges/stats) decoupled from SQLModel,
and produces the compact natural-language snapshot that primes the Gemini chat
and the MCP `get_progress_summary` tool.
"""

from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from ..models import Milestone, Piece, PracticeSession, ReadingLog, Scale
from . import gauges, projections, stats


# ---- Adapters ------------------------------------------------------------- #
def piece_proj(p: Piece) -> projections.PieceLike:
    return projections.PieceLike(
        title=p.title, track=p.track.value, status=p.status.value,
        difficulty=p.difficulty, progress_pct=p.progress_pct, order_index=p.order_index,
    )


def session_proj(s: PracticeSession) -> projections.SessionLike:
    return projections.SessionLike(date=s.date, duration_min=s.duration_min)


def piece_gauge(p: Piece) -> gauges.PieceLike:
    return gauges.PieceLike(
        title=p.title, track=p.track.value, status=p.status.value,
        progress_pct=p.progress_pct, order_index=p.order_index,
    )


def scale_gauge(s: Scale) -> gauges.ScaleLike:
    return gauges.ScaleLike(
        key=s.key, mastered=s.mastered, current_bpm=s.current_bpm, target_bpm=s.target_bpm
    )


def milestone_gauge(m: Milestone) -> gauges.MilestoneLike:
    return gauges.MilestoneLike(label=m.label, horizon=m.horizon.value, done=m.done)


def reading_gauge(r: ReadingLog) -> gauges.ReadingLike:
    return gauges.ReadingLike(minutes=r.minutes)


# ---- Coach summary -------------------------------------------------------- #
def build_data_summary(session: Session, reference_date: date | None = None) -> str:
    ref = reference_date or date.today()
    pieces = session.exec(select(Piece)).all()
    sessions = session.exec(select(PracticeSession)).all()
    scales = session.exec(select(Scale)).all()
    milestones = session.exec(select(Milestone)).all()

    totals = stats.practice_totals(sessions, ref)
    streak = stats.compute_streak([s.date for s in sessions], ref)
    mastered = sum(1 for s in scales if s.mastered)
    done_ms = sum(1 for m in milestones if m.done)

    lines = [
        f"Date du jour : {ref.isoformat()}.",
        f"Pratique : {totals['week_hours']} h cette semaine, {totals['month_hours']} h ce mois.",
        f"Série de régularité : {streak['current_streak']} jour(s) d'affilée "
        f"(record {streak['longest_streak']}).",
        f"Gammes maîtrisées : {mastered}/{len(scales)}.",
        f"Jalons franchis : {done_ms}/{len(milestones)}.",
    ]

    in_prog = [p for p in pieces if p.status.value == "in_progress"]
    if in_prog:
        lines.append("Pièces en cours : " + "; ".join(
            f"{p.title} ({p.progress_pct}%)" for p in in_prog
        ))

    # Projection toward each target.
    proj = projections.project_all_targets(
        [piece_proj(p) for p in pieces], [session_proj(s) for s in sessions], reference_date=ref
    )
    for pr in proj:
        lines.append(
            f"Projection « {pr['target_title']} » : ~{pr['months_remaining']} mois "
            f"(fourchette {pr['weeks_low']}–{pr['weeks_high']} sem.)."
        )

    return "\n".join(lines)
