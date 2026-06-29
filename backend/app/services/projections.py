"""Transparent "time remaining before the target" heuristic.

This is intentionally a simple, explainable model — NOT false precision. Every
projection ships with the assumptions that produced it so the UI can show the
reasoning. The estimate recalculates from your *real* recent practice rate.

Model
-----
1. Each remaining rung on a track has an estimated learning cost in hours,
   derived from its difficulty and how far along it already is.
2. Your weekly practice budget is measured from recent sessions (falling back
   to a conservative assumption when there's no history yet).
3. weeks = remaining_hours / weekly_hours, with an optimistic/pessimistic band
   reflecting how consistent the recent practice has been.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

# Hours of focused work to take a piece from 0% to learned, per difficulty point.
HOURS_PER_DIFFICULTY = 9.0
# Used when a piece has no difficulty set.
DEFAULT_DIFFICULTY = 5
# Conservative weekly practice budget assumed before any sessions are logged.
FALLBACK_WEEKLY_HOURS = 7.0


@dataclass
class PieceLike:
    """Minimal piece view the projector needs (keeps the function pure)."""

    title: str
    track: str
    status: str
    difficulty: int | None
    progress_pct: int
    order_index: int


@dataclass
class SessionLike:
    date: date
    duration_min: int


@dataclass
class Projection:
    target_title: str
    track: str
    remaining_hours: float
    weekly_hours: float
    weeks_remaining: float
    weeks_low: float
    weeks_high: float
    eta_date: str | None
    eta_low: str | None
    eta_high: str | None
    assumptions: list[str] = field(default_factory=list)
    rungs: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "target_title": self.target_title,
            "track": self.track,
            "remaining_hours": round(self.remaining_hours, 1),
            "weekly_hours": round(self.weekly_hours, 1),
            "weeks_remaining": round(self.weeks_remaining, 1),
            "months_remaining": round(self.weeks_remaining / 4.345, 1),
            "weeks_low": round(self.weeks_low, 1),
            "weeks_high": round(self.weeks_high, 1),
            "eta_date": self.eta_date,
            "eta_low": self.eta_low,
            "eta_high": self.eta_high,
            "assumptions": self.assumptions,
            "rungs": self.rungs,
        }


def estimate_piece_hours(difficulty: int | None, progress_pct: int) -> float:
    """Remaining learning hours for one piece, given difficulty + progress."""
    diff = difficulty if difficulty is not None else DEFAULT_DIFFICULTY
    total = diff * HOURS_PER_DIFFICULTY
    remaining_fraction = max(0.0, 1.0 - (progress_pct / 100.0))
    return total * remaining_fraction


def weekly_practice_hours(
    sessions: list[SessionLike],
    *,
    reference_date: date,
    weeks: int = 4,
) -> float | None:
    """Average weekly practice hours over the last `weeks`, or None if no data."""
    if not sessions:
        return None
    cutoff = reference_date - timedelta(weeks=weeks)
    recent = [s for s in sessions if cutoff < s.date <= reference_date]
    if not recent:
        return None
    total_min = sum(s.duration_min for s in recent)
    return (total_min / 60.0) / weeks


def consistency_factor(
    sessions: list[SessionLike],
    *,
    reference_date: date,
    window_days: int = 28,
) -> float:
    """Fraction of recent days with at least one session (0..1).

    Drives the optimistic/pessimistic band: steady practice tightens the range.
    """
    if not sessions:
        return 0.5  # neutral assumption
    cutoff = reference_date - timedelta(days=window_days)
    practiced_days = {s.date for s in sessions if cutoff < s.date <= reference_date}
    return min(1.0, len(practiced_days) / window_days)


def project_target(
    target: PieceLike,
    track_pieces: list[PieceLike],
    sessions: list[SessionLike],
    *,
    reference_date: date,
) -> Projection:
    """Estimate time to reach one target piece, including its preceding rungs."""
    # Rungs = every piece on the track not yet learned, ordered, up to the target.
    ladder = sorted(
        [p for p in track_pieces if p.track == target.track],
        key=lambda p: p.order_index,
    )
    rungs: list[PieceLike] = []
    for p in ladder:
        if p.status == "learned":
            continue
        rungs.append(p)
        if p.order_index >= target.order_index:
            break

    rung_details: list[dict] = []
    remaining_hours = 0.0
    for p in rungs:
        h = estimate_piece_hours(p.difficulty, p.progress_pct)
        remaining_hours += h
        rung_details.append(
            {
                "title": p.title,
                "difficulty": p.difficulty,
                "progress_pct": p.progress_pct,
                "remaining_hours": round(h, 1),
            }
        )

    measured = weekly_practice_hours(sessions, reference_date=reference_date)
    cons = consistency_factor(sessions, reference_date=reference_date)
    # Blend the measured rate with a conservative prior when there's little
    # history: a single logged session must not imply a decade-long ETA.
    # Full trust in the measured rate only once ~8 days have been logged.
    window_start = reference_date - timedelta(weeks=4)
    practiced_days = len({s.date for s in sessions if window_start < s.date <= reference_date})
    if measured and measured > 0:
        confidence = min(1.0, practiced_days / 8.0)
        weekly = confidence * measured + (1 - confidence) * FALLBACK_WEEKLY_HOURS
    else:
        weekly = FALLBACK_WEEKLY_HOURS

    weeks = remaining_hours / weekly if weekly > 0 else float("inf")
    # Band: with high consistency the estimate is tight; low consistency widens
    # the pessimistic tail (real life: missed days stretch the timeline).
    low = weeks * (0.85 + 0.10 * cons)
    high = weeks * (1.6 - 0.5 * cons)

    def eta(w: float) -> str | None:
        if w == float("inf"):
            return None
        return (reference_date + timedelta(weeks=w)).isoformat()

    assumptions = [
        f"{HOURS_PER_DIFFICULTY:.0f} h de travail par point de difficulté (0→appris).",
        (
            f"Rythme estimé : {weekly:.1f} h/semaine "
            f"(mesuré {measured:.1f} h sur {practiced_days} jour(s) récents, lissé avec une hypothèse prudente)."
            if measured
            else f"Aucune séance loggée encore → hypothèse prudente de {weekly:.0f} h/semaine."
        ),
        f"Régularité récente : {cons * 100:.0f}% des jours avec pratique.",
        f"{len(rungs)} palier(s) restant(s) sur la voie avant la cible.",
        "Estimation indicative, recalculée à chaque nouvelle séance.",
    ]

    return Projection(
        target_title=target.title,
        track=target.track,
        remaining_hours=remaining_hours,
        weekly_hours=weekly,
        weeks_remaining=weeks,
        weeks_low=low,
        weeks_high=high,
        eta_date=eta(weeks),
        eta_low=eta(low),
        eta_high=eta(high),
        assumptions=assumptions,
        rungs=rung_details,
    )


def project_all_targets(
    pieces: list[PieceLike],
    sessions: list[SessionLike],
    *,
    reference_date: date,
) -> list[dict]:
    targets = [p for p in pieces if p.status == "target"]
    return [
        project_target(t, pieces, sessions, reference_date=reference_date).to_dict()
        for t in targets
    ]
