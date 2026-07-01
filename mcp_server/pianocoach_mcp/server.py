"""PianoCoach MCP server.

A standalone stdio process that reads (and, with confirmation, writes) the same
local SQLite database the FastAPI backend uses. It imports the backend's models
and services directly, so the schema and the projection/readiness logic never
drift between the two processes.

Point Claude Desktop / Claude Code at it (see the README "Connexion MCP"):
    uv run --directory /path/to/pianocoach pianocoach-mcp
"""

from __future__ import annotations

import datetime as dt

from app.db import init_db, session_scope
from app.models import (
    FOCUS_AREAS,
    Milestone,
    Piece,
    PieceStatus,
    PracticeSession,
    ReadingLog,
    Scale,
    TempoLog,
)
from app.seed import seed
from app.services import gauges, projections, stats, summaries
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
from sqlmodel import select

mcp = FastMCP("PianoCoach")

READ_ONLY = ToolAnnotations(readOnlyHint=True)
WRITES = ToolAnnotations(readOnlyHint=False, destructiveHint=False)


def _ensure_db() -> None:
    init_db()
    seed()  # idempotent — guarantees data even if the backend never ran


def _piece_dict(p: Piece) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "composer": p.composer,
        "track": p.track.value,
        "status": p.status.value,
        "difficulty": p.difficulty,
        "progress_pct": p.progress_pct,
        "target_tempo": p.target_tempo,
        "current_clean_tempo": p.current_clean_tempo,
        "skills": p.skills,
        "notes": p.notes,
    }


def _resolve_piece(session, ref: str) -> Piece | None:
    """Resolve a piece by numeric id or by (case-insensitive substring) title."""
    ref = ref.strip()
    if ref.isdigit():
        return session.get(Piece, int(ref))
    pieces = session.exec(select(Piece)).all()
    low = ref.lower()
    exact = [p for p in pieces if p.title.lower() == low]
    if exact:
        return exact[0]
    partial = [p for p in pieces if low in p.title.lower()]
    # Only resolve an unambiguous single match; refuse to guess between several.
    return partial[0] if len(partial) == 1 else None


# --------------------------------------------------------------------------- #
# READ tools
# --------------------------------------------------------------------------- #
@mcp.tool(annotations=READ_ONLY)
def get_repertoire() -> list[dict]:
    """Liste tout le répertoire (pièces cibles, paliers, socle), ordonné par voie puis position."""
    _ensure_db()
    with session_scope() as s:
        pieces = s.exec(select(Piece).order_by(Piece.track, Piece.order_index)).all()
        return [_piece_dict(p) for p in pieces]


@mcp.tool(annotations=READ_ONLY)
def get_recent_sessions(n: int = 10) -> list[dict]:
    """Récupère les n dernières séances de pratique (date, durée, zones travaillées, tension, ressenti)."""
    _ensure_db()
    with session_scope() as s:
        rows = s.exec(
            select(PracticeSession).order_by(PracticeSession.date.desc(), PracticeSession.id.desc()).limit(n)
        ).all()
        return [
            {
                "id": r.id,
                "date": r.date.isoformat(),
                "duration_min": r.duration_min,
                "focus_areas": r.focus_areas,
                "pieces_worked": r.pieces_worked,
                "tension_level": r.tension_level,
                "mood": r.mood,
                "notes": r.notes,
            }
            for r in rows
        ]


@mcp.tool(annotations=READ_ONLY)
def get_scale_progress() -> list[dict]:
    """État des gammes & arpèges : tonalité, type, BPM actuel vs cible, maîtrise."""
    _ensure_db()
    with session_scope() as s:
        scales = s.exec(select(Scale).order_by(Scale.type, Scale.key)).all()
        return [
            {
                "key": sc.key,
                "type": sc.type.value,
                "hands": sc.hands.value,
                "current_bpm": sc.current_bpm,
                "target_bpm": sc.target_bpm,
                "mastered": sc.mastered,
                "last_practiced": sc.last_practiced.isoformat() if sc.last_practiced else None,
            }
            for sc in scales
        ]


@mcp.tool(annotations=READ_ONLY)
def get_tempo_progression(piece: str = "") -> list[dict]:
    """Progression de tempo (BPM joué proprement) par passage. Filtre optionnel par id ou titre de pièce."""
    _ensure_db()
    with session_scope() as s:
        q = select(TempoLog).order_by(TempoLog.date, TempoLog.id)
        target_id = None
        if piece.strip():
            p = _resolve_piece(s, piece)
            if not p:
                return [{"error": f"Pièce introuvable ou ambiguë : {piece!r} — précise l'id ou le titre exact."}]
            target_id = p.id
            q = q.where(TempoLog.piece_id == target_id)
        logs = s.exec(q).all()
        pieces = {p.id: p for p in s.exec(select(Piece)).all()}
        grouped: dict[int, dict] = {}
        for log in logs:
            pc = pieces.get(log.piece_id)
            g = grouped.setdefault(
                log.piece_id,
                {"piece": pc.title if pc else "?", "target_tempo": pc.target_tempo if pc else None, "points": []},
            )
            g["points"].append(
                {"date": log.date.isoformat(), "bpm_clean": log.bpm_clean, "passage": log.passage_label}
            )
        return list(grouped.values())


@mcp.tool(annotations=READ_ONLY)
def get_milestones() -> list[dict]:
    """Jalons (3/6/12/24 mois) avec leur état (fait ou non) et date d'accomplissement."""
    _ensure_db()
    with session_scope() as s:
        rows = s.exec(select(Milestone).order_by(Milestone.horizon, Milestone.order_index)).all()
        return [
            {
                "id": m.id,
                "label": m.label,
                "horizon": m.horizon.value,
                "done": m.done,
                "date_done": m.date_done.isoformat() if m.date_done else None,
            }
            for m in rows
        ]


@mcp.tool(annotations=READ_ONLY)
def get_progress_summary() -> dict:
    """Synthèse globale : régularité, volume de pratique, projections vers les pièces cibles, jauges de préparation.

    L'outil idéal pour démarrer un coaching : donne le contexte complet de l'élève en une fois.
    """
    _ensure_db()
    today = dt.date.today()
    with session_scope() as s:
        pieces = s.exec(select(Piece)).all()
        sessions = s.exec(select(PracticeSession)).all()
        scales = s.exec(select(Scale)).all()
        milestones = s.exec(select(Milestone)).all()
        reading = s.exec(select(ReadingLog)).all()

        proj = projections.project_all_targets(
            [summaries.piece_proj(p) for p in pieces],
            [summaries.session_proj(x) for x in sessions],
            reference_date=today,
        )
        readiness = gauges.all_readiness(
            [summaries.piece_gauge(p) for p in pieces],
            [summaries.scale_gauge(x) for x in scales],
            [summaries.milestone_gauge(m) for m in milestones],
            [summaries.reading_gauge(r) for r in reading],  # was [] — B6 fix
        )
        return {
            "text_summary": summaries.build_data_summary(s, today),
            "streak": stats.compute_streak([x.date for x in sessions], today),
            "totals": stats.practice_totals(sessions, today),
            "scales_mastered": f"{sum(1 for x in scales if x.mastered)}/{len(scales)}",
            "milestones_done": f"{sum(1 for m in milestones if m.done)}/{len(milestones)}",
            "projections": proj,
            "readiness": readiness,
        }


# --------------------------------------------------------------------------- #
# WRITE tools (Claude Desktop asks for confirmation before calling these)
# --------------------------------------------------------------------------- #
@mcp.tool(annotations=WRITES)
def log_session(
    duration_min: int,
    focus_areas: list[str] | None = None,
    pieces_worked: list[str] | None = None,
    tension_level: int | None = None,
    mood: str = "",
    notes: str = "",
    date: str | None = None,
) -> dict:
    """Enregistre une séance de pratique.

    focus_areas doit utiliser ces tags : scales, arpeggios, etudes, reading, polyrhythm, piece, fun.
    tension_level: 1 (détendu) à 5 (très tendu). date: ISO 'YYYY-MM-DD' (défaut: aujourd'hui).
    """
    _ensure_db()
    focus = [f for f in (focus_areas or []) if f in FOCUS_AREAS]
    when = dt.date.fromisoformat(date) if date else dt.date.today()
    with session_scope() as s:
        obj = PracticeSession(
            date=when,
            duration_min=duration_min,
            focus_areas=focus,
            pieces_worked=pieces_worked or [],
            tension_level=tension_level,
            mood=mood,
            notes=notes,
        )
        s.add(obj)
        s.commit()
        s.refresh(obj)
        return {"ok": True, "id": obj.id, "date": obj.date.isoformat(), "duration_min": obj.duration_min}


@mcp.tool(annotations=WRITES)
def update_piece_progress(
    piece: str,
    progress_pct: int | None = None,
    status: str | None = None,
    current_clean_tempo: int | None = None,
) -> dict:
    """Met à jour une pièce (par id ou titre) : % d'avancement, statut, tempo propre actuel.

    status valides : target, planned, in_progress, learned.
    """
    _ensure_db()
    with session_scope() as s:
        p = _resolve_piece(s, piece)
        if not p:
            return {"error": f"Pièce introuvable ou ambiguë : {piece!r} — précise l'id ou le titre exact."}
        if progress_pct is not None:
            p.progress_pct = max(0, min(100, progress_pct))
        if current_clean_tempo is not None:
            p.current_clean_tempo = current_clean_tempo
        if status is not None:
            try:
                p.status = PieceStatus(status)
            except ValueError:
                return {"error": f"Statut invalide : {status!r}"}
            if p.status == PieceStatus.learned:
                p.progress_pct = 100
                p.date_completed = p.date_completed or dt.date.today()
        s.add(p)
        s.commit()
        s.refresh(p)
        return {"ok": True, "piece": _piece_dict(p)}


@mcp.tool(annotations=WRITES)
def log_tempo(piece: str, bpm_clean: int, passage_label: str = "", date: str | None = None) -> dict:
    """Enregistre un tempo joué proprement pour un passage d'une pièce (par id ou titre).

    Met aussi à jour le 'tempo propre actuel' de la pièce si ce BPM est un nouveau record. date: ISO (défaut: aujourd'hui).
    """
    _ensure_db()
    when = dt.date.fromisoformat(date) if date else dt.date.today()
    with session_scope() as s:
        p = _resolve_piece(s, piece)
        if not p:
            return {"error": f"Pièce introuvable ou ambiguë : {piece!r} — précise l'id ou le titre exact."}
        log = TempoLog(piece_id=p.id, bpm_clean=bpm_clean, passage_label=passage_label, date=when)
        s.add(log)
        if (p.current_clean_tempo or 0) < bpm_clean:
            p.current_clean_tempo = bpm_clean
            s.add(p)
        s.commit()
        s.refresh(log)
        return {"ok": True, "id": log.id, "piece": p.title, "bpm_clean": bpm_clean, "date": when.isoformat()}


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
