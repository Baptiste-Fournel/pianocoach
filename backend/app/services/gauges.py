"""Readiness gauges: "how ready am I for [target piece]?"

Computes a 0-100 readiness score per target from weighted prerequisites
(scales/arpeggios, reading, the relevant polyrhythm, and progress on the
preceding rungs). Every gauge returns its component breakdown so the UI can
explain *why* the number is what it is — no black box.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ScaleLike:
    key: str
    mastered: bool
    current_bpm: int | None = None
    target_bpm: int = 120


@dataclass
class MilestoneLike:
    label: str
    horizon: str
    done: bool


@dataclass
class PieceLike:
    title: str
    track: str
    status: str
    progress_pct: int
    order_index: int


@dataclass
class ReadingLike:
    minutes: int


# Per-target prerequisite weights. The Fantaisie-impromptu hinges on 4-against-3;
# the Moonlight 3rd hinges on velocity/scales-arpeggios and endurance.
TARGET_PREREQS: dict[str, dict[str, float]] = {
    "chopin": {
        "scales": 0.20,
        "reading": 0.20,
        "polyrhythm": 0.30,  # 4-against-3 is the crux
        "repertoire": 0.30,
    },
    "beethoven": {
        "scales": 0.30,  # arpeggios / velocity heavy
        "reading": 0.15,
        "polyrhythm": 0.10,
        "repertoire": 0.45,
    },
}

# Milestone label keywords that indicate a prerequisite is satisfied.
_READING_KW = ("lecture", "clé de fa", "déchiffr")
_POLY_KW = {
    "chopin": ("3 contre 4", "4 contre 3"),
    "beethoven": ("2 contre 3",),
}


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


def _scales_score(scales: list[ScaleLike]) -> float:
    if not scales:
        return 0.0
    # Blend "mastered fraction" with average tempo progress toward target.
    mastered = sum(1 for s in scales if s.mastered) / len(scales)
    tempo_bits = [
        min(1.0, (s.current_bpm or 0) / s.target_bpm) for s in scales if s.target_bpm
    ]
    tempo = sum(tempo_bits) / len(tempo_bits) if tempo_bits else 0.0
    return _clamp(100.0 * (0.6 * mastered + 0.4 * tempo))


def _reading_score(milestones: list[MilestoneLike], reading_logs: list[ReadingLike]) -> float:
    reading_ms = [m for m in milestones if any(k in m.label.lower() for k in _READING_KW)]
    ms_score = (
        sum(1 for m in reading_ms if m.done) / len(reading_ms) if reading_ms else 0.0
    )
    # A bit of credit for accumulated reading practice (caps at ~10h logged).
    total_min = sum(r.minutes for r in reading_logs)
    practice_score = min(1.0, total_min / 600.0)
    return _clamp(100.0 * (0.7 * ms_score + 0.3 * practice_score))


def _polyrhythm_score(milestones: list[MilestoneLike], track: str) -> float:
    kws = _POLY_KW.get(track, ())
    poly_ms = [m for m in milestones if any(k in m.label.lower() for k in kws)]
    if not poly_ms:
        return 0.0
    return _clamp(100.0 * sum(1 for m in poly_ms if m.done) / len(poly_ms))


def _repertoire_score(target: PieceLike, pieces: list[PieceLike]) -> float:
    rungs = [
        p
        for p in pieces
        if p.track == target.track and p.order_index < target.order_index
    ]
    if not rungs:
        return 0.0
    # Learned pieces count as 100%; others contribute their progress_pct.
    scores = [100.0 if p.status == "learned" else float(p.progress_pct) for p in rungs]
    return _clamp(sum(scores) / len(scores))


def readiness_for_target(
    target: PieceLike,
    pieces: list[PieceLike],
    scales: list[ScaleLike],
    milestones: list[MilestoneLike],
    reading_logs: list[ReadingLike],
) -> dict:
    weights = TARGET_PREREQS.get(target.track, TARGET_PREREQS["chopin"])

    components = {
        "scales": _scales_score(scales),
        "reading": _reading_score(milestones, reading_logs),
        "polyrhythm": _polyrhythm_score(milestones, target.track),
        "repertoire": _repertoire_score(target, pieces),
    }
    overall = sum(components[k] * weights[k] for k in weights)

    labels = {
        "scales": "Gammes & arpèges",
        "reading": "Lecture (clé de fa)",
        "polyrhythm": "Polyrythmie (4 contre 3)"
        if target.track == "chopin"
        else "Polyrythmie (2 contre 3)",
        "repertoire": "Paliers du répertoire",
    }

    return {
        "target_title": target.title,
        "track": target.track,
        "readiness_pct": round(_clamp(overall), 1),
        "components": [
            {
                "key": k,
                "label": labels[k],
                "score": round(components[k], 1),
                "weight": weights[k],
            }
            for k in weights
        ],
    }


def all_readiness(
    pieces: list[PieceLike],
    scales: list[ScaleLike],
    milestones: list[MilestoneLike],
    reading_logs: list[ReadingLike],
) -> list[dict]:
    targets = [p for p in pieces if p.status == "target"]
    return [
        readiness_for_target(t, pieces, scales, milestones, reading_logs) for t in targets
    ]
