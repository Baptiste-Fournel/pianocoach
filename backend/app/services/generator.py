"""Daily practice-session generator.

Builds a balanced session from a configurable weekly rotation:
warmup scales/arpeggios (rotating key), technique/etude, reading (bass-clef
biased — the known weak spot), a targeted piece passage, polyrhythm
(2:3 / 3:4 alternating), and a "fun" block to stay motivated.

Deterministic given the weekday, so the same day always yields the same plan
(stable to test and reassuring to use).
"""

from __future__ import annotations

from dataclasses import dataclass

# Default block weights (fractions of total time). Reading is boosted because
# bass-clef reading is the priority weakness; piece work gets the largest share.
DEFAULT_WEIGHTS: dict[str, float] = {
    "scales": 0.15,
    "etudes": 0.15,
    "reading": 0.20,
    "piece": 0.30,
    "polyrhythm": 0.10,
    "fun": 0.10,
}

WEEKDAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


@dataclass
class ScaleLike:
    key: str
    type: str
    mastered: bool
    current_bpm: int | None = None
    target_bpm: int = 120


@dataclass
class PieceLike:
    title: str
    status: str
    progress_pct: int
    target_tempo: int | None = None
    current_clean_tempo: int | None = None


def _largest_remainder_round(weights: dict[str, float], total: int) -> dict[str, int]:
    """Distribute `total` minutes across blocks, preserving the sum exactly."""
    raw = {k: w * total for k, w in weights.items()}
    floored = {k: int(v) for k, v in raw.items()}
    remainder = total - sum(floored.values())
    # Hand out the leftover minutes to the largest fractional parts.
    order = sorted(weights, key=lambda k: raw[k] - floored[k], reverse=True)
    for i in range(remainder):
        floored[order[i % len(order)]] += 1
    return floored


def _rotate(items: list, index: int):
    return items[index % len(items)] if items else None


def generate_session(
    *,
    total_min: int,
    weekday: int,
    scales: list[ScaleLike],
    pieces: list[PieceLike],
    weights: dict[str, float] | None = None,
) -> dict:
    """Return a structured session plan.

    weekday: 0=Monday .. 6=Sunday (matches Python's date.weekday()).
    """
    weights = weights or DEFAULT_WEIGHTS
    minutes = _largest_remainder_round(weights, max(0, total_min))

    # Rotate the scale of the day among not-yet-mastered scales (fall back to all).
    pool = [s for s in scales if not s.mastered] or scales
    scale = _rotate(pool, weekday)

    # Rotate the focus piece among the in-progress / target pieces.
    active = [p for p in pieces if p.status in ("in_progress", "target")] or pieces
    piece = _rotate(active, weekday)

    # Alternate polyrhythm pattern: even weekdays → 2:3, odd → 3:4.
    poly = "2 contre 3" if weekday % 2 == 0 else "3 contre 4"

    # Clef focus rotates but stays bass-heavy (4 of 7 days bass).
    clef_cycle = ["bass", "bass", "both", "bass", "treble", "bass", "both"]
    clef = clef_cycle[weekday % 7]

    blocks = [
        {
            "focus": "scales",
            "label": f"Gammes & arpèges — {scale.key} majeur" if scale else "Gammes & arpèges",
            "minutes": minutes["scales"],
            "detail": (
                f"Mains séparées puis ensemble. Cible {scale.target_bpm} BPM, "
                f"monte par paliers de 4 BPM en jouant proprement."
                if scale
                else "Travail des gammes/arpèges en rotation."
            ),
        },
        {
            "focus": "etudes",
            "label": "Technique / étude",
            "minutes": minutes["etudes"],
            "detail": "Hanon / Czerny ou difficulté technique extraite d'une pièce.",
        },
        {
            "focus": "reading",
            "label": f"Lecture à vue ({_clef_fr(clef)})",
            "minutes": minutes["reading"],
            "detail": (
                "Déchiffrage lent, sur partition. Priorité clé de fa : "
                "nomme les notes à voix haute, pas de Synthesia."
            ),
        },
        {
            "focus": "piece",
            "label": f"Pièce : {piece.title}" if piece else "Travail de pièce",
            "minutes": minutes["piece"],
            "detail": (
                "Passage ciblé en boucle, mains séparées si besoin, "
                "métronome lent puis +BPM quand c'est propre."
                if piece
                else "Passage ciblé d'une pièce en cours."
            ),
        },
        {
            "focus": "polyrhythm",
            "label": f"Polyrythmie {poly}",
            "minutes": minutes["polyrhythm"],
            "detail": "Avec le trainer : motif composite lent, puis accélère. Reste relâché.",
        },
        {
            "focus": "fun",
            "label": "Plaisir / impro",
            "minutes": minutes["fun"],
            "detail": "Rejoue ce que tu aimes, improvise, ré-explore une pièce apprise.",
        },
    ]
    blocks = [b for b in blocks if b["minutes"] > 0]

    return {
        "weekday": weekday,
        "weekday_name": WEEKDAY_NAMES[weekday % 7],
        "total_min": sum(b["minutes"] for b in blocks),
        "scale_of_day": scale.key if scale else None,
        "piece_of_day": piece.title if piece else None,
        "polyrhythm": poly,
        "blocks": blocks,
    }


def _clef_fr(clef: str) -> str:
    return {"bass": "clé de fa", "treble": "clé de sol", "both": "deux clés"}.get(clef, clef)
