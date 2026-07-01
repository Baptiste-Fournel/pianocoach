"""Seed the database from the §8 profile.

Idempotent: each table is only populated if it is currently empty, so running
setup again never duplicates rows. No practice/reading/tempo history is
fabricated — those start empty and reflect only what you actually log.

Repertoire is organised as two "tracks" (ladders) toward the target pieces,
plus a common technical/reading base. `order_index` defines the rung order.
"""

from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from .db import get_engine, init_db
from .models import (
    Horizon,
    Milestone,
    Piece,
    PieceStatus,
    Scale,
    ScaleType,
    Track,
)

# --------------------------------------------------------------------------- #
# Repertoire — ladders toward the two target pieces
# --------------------------------------------------------------------------- #
# (title, composer, track, status, difficulty, progress, target_tempo, current_clean, notes)
_PIECES: list[dict] = [
    # ---- Voie Chopin: Préludes -> Nocturne -> Valse -> Fantaisie-impromptu ----
    dict(title="Prélude op. 28 n° 7 (La majeur)", composer="Chopin", track=Track.chopin,
         status=PieceStatus.in_progress, difficulty=2, progress_pct=10, target_tempo=70,
         date_started=date(2026, 6, 1),
         notes="Porte d'entrée Chopin : court, harmonie pure, travail du chant et du rubato."),
    dict(title="Prélude op. 28 n° 6 (Si mineur)", composer="Chopin", track=Track.chopin,
         status=PieceStatus.planned, difficulty=4, progress_pct=0, target_tempo=60,
         notes="Mélodie à la main gauche — indépendance des mains."),
    dict(title="Prélude op. 28 n° 4 (Mi mineur)", composer="Chopin", track=Track.chopin,
         status=PieceStatus.planned, difficulty=4, progress_pct=0, target_tempo=54,
         notes="Conduite des voix à la main gauche, legato et nuances."),
    dict(title="Prélude op. 28 n° 20 (Do mineur)", composer="Chopin", track=Track.chopin,
         status=PieceStatus.planned, difficulty=3, progress_pct=0, target_tempo=60,
         notes="Accords, contrôle dynamique, lecture d'accords plaqués."),
    dict(title="Prélude op. 28 n° 15 « Raindrop » (Réb majeur)", composer="Chopin",
         track=Track.chopin, status=PieceStatus.planned, difficulty=6, progress_pct=0,
         target_tempo=60,
         notes="Note répétée, endurance, section centrale dense — gros palier."),
    dict(title="Nocturne op. 9 n° 2 (Mib majeur)", composer="Chopin", track=Track.chopin,
         status=PieceStatus.planned, difficulty=6, progress_pct=0, target_tempo=132,
         notes="Chant à la main droite, ornements, pédale. Étape phare avant la Fantaisie."),
    dict(title="Valse op. 69 n° 2 (Si mineur)", composer="Chopin", track=Track.chopin,
         status=PieceStatus.planned, difficulty=5, progress_pct=0, target_tempo=160,
         notes="Souplesse de la main gauche en valse, agilité."),
    dict(title="Fantaisie-impromptu op. 66", composer="Chopin", track=Track.chopin,
         status=PieceStatus.target, difficulty=9, progress_pct=0, target_tempo=84,
         notes="PIÈCE CIBLE. Polyrythmie 4 contre 3 omniprésente, traits rapides MD."),

    # ---- Voie Beethoven: Moonlight I -> Für Elise -> Pathétique II -> Moonlight III ----
    dict(title="Sonate « Clair de lune » op. 27 n° 2 — 1er mvt", composer="Beethoven",
         track=Track.beethoven, status=PieceStatus.in_progress, difficulty=4, progress_pct=15,
         target_tempo=56, current_clean_tempo=46, date_started=date(2026, 5, 20),
         notes="En cours. Triolets réguliers main droite, legato, contrôle pp soutenu."),
    dict(title="Für Elise (WoO 59)", composer="Beethoven", track=Track.beethoven,
         status=PieceStatus.planned, difficulty=4, progress_pct=0, target_tempo=120,
         notes="Sections B/C plus exigeantes (gammes, traits)."),
    dict(title="Sonate « Pathétique » op. 13 — 2e mvt (Adagio cantabile)", composer="Beethoven",
         track=Track.beethoven, status=PieceStatus.planned, difficulty=5, progress_pct=0,
         target_tempo=54,
         notes="Chant et accompagnement, équilibre des voix, lecture clé de fa."),
    dict(title="Sonate « Clair de lune » op. 27 n° 2 — 3e mvt (Presto agitato)",
         composer="Beethoven", track=Track.beethoven, status=PieceStatus.target, difficulty=9,
         progress_pct=0, target_tempo=168,
         notes="PIÈCE CIBLE. Arpèges brisés rapides, sauts, endurance, vélocité."),

    # ---- Socle commun: technique + lecture ----
    dict(title="Clementi — Sonatines op. 36", composer="Clementi", track=Track.common,
         status=PieceStatus.in_progress, difficulty=3, progress_pct=20, target_tempo=120,
         date_started=date(2026, 5, 1),
         notes="Socle classique : Alberti, gammes, articulation, lecture régulière."),
    dict(title="Bach — Petit Livre d'Anna Magdalena", composer="J.S. Bach", track=Track.common,
         status=PieceStatus.in_progress, difficulty=3, progress_pct=15, target_tempo=100,
         date_started=date(2026, 5, 1),
         notes="Indépendance des mains, polyphonie, lecture des deux clés."),
]


# --------------------------------------------------------------------------- #
# Scales — starting set (majors), to follow
# --------------------------------------------------------------------------- #
# Skills each seeded piece develops (ids match the frontend taxonomy).
_SKILLS: dict[str, list[str]] = {
    "Prélude op. 28 n° 7 (La majeur)": ["reading_treble", "voicing", "pedaling"],
    "Prélude op. 28 n° 6 (Si mineur)": ["reading_bass", "voicing", "pedaling"],
    "Prélude op. 28 n° 4 (Mi mineur)": ["voicing", "reading_bass", "pedaling"],
    "Prélude op. 28 n° 20 (Do mineur)": ["voicing", "reading_bass", "pedaling"],
    "Prélude op. 28 n° 15 « Raindrop » (Réb majeur)": ["endurance", "voicing", "pedaling"],
    "Nocturne op. 9 n° 2 (Mib majeur)": ["voicing", "pedaling", "reading_treble"],
    "Valse op. 69 n° 2 (Si mineur)": ["velocity", "reading_treble", "pedaling"],
    "Fantaisie-impromptu op. 66": ["polyrhythm_4v3", "velocity", "endurance"],
    "Sonate « Clair de lune » op. 27 n° 2 — 1er mvt": ["voicing", "pedaling", "endurance"],
    "Für Elise (WoO 59)": ["reading_treble", "velocity"],
    "Sonate « Pathétique » op. 13 — 2e mvt (Adagio cantabile)": ["voicing", "pedaling", "reading_bass"],
    "Sonate « Clair de lune » op. 27 n° 2 — 3e mvt (Presto agitato)": ["velocity", "endurance", "reading_bass"],
    "Clementi — Sonatines op. 36": ["reading_treble", "reading_bass", "velocity", "classical_clarity"],
    "Bach — Petit Livre d'Anna Magdalena": ["reading_bass", "reading_treble", "voicing", "classical_clarity"],
}

_SCALE_KEYS = ["C", "G", "D", "A", "F"]


# --------------------------------------------------------------------------- #
# Milestones — checklist (3 / 6 / 12 / 24 months)
# --------------------------------------------------------------------------- #
_MILESTONES: list[tuple[str, Horizon]] = [
    # 3 months
    ("Lecture en clé de fa fluide", Horizon.m3),
    ("Gammes C / G / D / F / A mains ensemble", Horizon.m3),
    ("Une pièce apprise de A à Z entièrement sur partition", Horizon.m3),
    ("Clair de lune 1er mvt en route", Horizon.m3),
    # 6 months
    ("Toutes les gammes majeures + arpèges", Horizon.m6),
    ("Lecture intermédiaire correcte", Horizon.m6),
    ("Une pièce de Bach terminée", Horizon.m6),
    ("Polyrythmie 2 contre 3 maîtrisée", Horizon.m6),
    # 12 months
    ("Préludes de Chopin / Clementi joués proprement", Horizon.m12),
    ("Polyrythmie 3 contre 4 en chantier", Horizon.m12),
    ("Lecture de partition = mode par défaut (sortie de Synthesia/flowkey)", Horizon.m12),
    # 24 months
    ("Ouverture des deux pièces cibles abordée", Horizon.m24),
    ("Fondations techniques solides en place", Horizon.m24),
]


def seed(session: Session | None = None) -> dict[str, int]:
    """Populate empty tables. Returns a count of rows inserted per table."""
    init_db()
    own_session = session is None
    if session is None:
        session = Session(get_engine())

    inserted: dict[str, int] = {}
    try:
        # Pieces (tagged with the skills they develop — see _SKILLS)
        if not session.exec(select(Piece)).first():
            for i, p in enumerate(_PIECES):
                session.add(Piece(order_index=i, skills=_SKILLS.get(p["title"], []), **p))
            inserted["pieces"] = len(_PIECES)

        # Scales
        if not session.exec(select(Scale)).first():
            for key in _SCALE_KEYS:
                session.add(
                    Scale(
                        key=key,
                        type=ScaleType.major,
                        target_bpm=120,
                        mastered=False,
                    )
                )
            inserted["scales"] = len(_SCALE_KEYS)

        # Milestones
        if not session.exec(select(Milestone)).first():
            for i, (label, horizon) in enumerate(_MILESTONES):
                session.add(Milestone(label=label, horizon=horizon, order_index=i))
            inserted["milestones"] = len(_MILESTONES)

        session.commit()
    finally:
        if own_session:
            session.close()

    return inserted


def backfill_seed_skills(session: Session | None = None) -> dict:
    """One-off, idempotent: tag recognised seed pieces that are still untagged
    (e.g. seeded before skills existed). NEVER overwrites an existing tag and
    NEVER touches user-added pieces (titles absent from the seed map)."""
    own_session = session is None
    if session is None:
        session = Session(get_engine())
    updated: list[str] = []
    try:
        for p in session.exec(select(Piece)).all():
            default = _SKILLS.get(p.title)
            if default and not p.skills:  # recognised seed piece, currently untagged
                p.skills = list(default)
                session.add(p)
                updated.append(p.title)
        session.commit()
    finally:
        if own_session:
            session.close()
    return {"updated": len(updated), "titles": updated}


if __name__ == "__main__":
    import sys

    if "--backfill-skills" in sys.argv:
        r = backfill_seed_skills()
        print(f"Backfill : {r['updated']} pièce(s) taguée(s)." + (f" {r['titles']}" if r["updated"] else ""))
    else:
        result = seed()
        if result:
            print("Seeded:", ", ".join(f"{v} {k}" for k, v in result.items()))
        else:
            print("Database already seeded — nothing to do.")
