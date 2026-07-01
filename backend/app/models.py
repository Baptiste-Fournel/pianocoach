"""SQLModel table definitions — the single source of truth for the schema.

Shared by the FastAPI backend and the MCP server (which imports this module),
so the two processes always agree on the shape of the data.

Note: datetime types are referenced as ``dt.date`` / ``dt.datetime`` because
several columns are named ``date`` (per the §4 spec); a bare ``date: date``
field would clash the field name with the type name and break pydantic.
"""

import datetime as dt
from enum import Enum

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _today() -> dt.date:
    return dt.datetime.now(dt.UTC).date()


# --------------------------------------------------------------------------- #
# Enums (string-valued so they round-trip cleanly through SQLite + JSON)
# --------------------------------------------------------------------------- #
class PieceStatus(str, Enum):
    target = "target"  # ultimate goal piece
    planned = "planned"  # queued on a track, not started yet
    in_progress = "in_progress"
    learned = "learned"


class Track(str, Enum):
    chopin = "chopin"
    beethoven = "beethoven"
    common = "common"
    neoclassical = "neoclassical"


class ScaleType(str, Enum):
    major = "major"
    minor_harmonic = "minor_harmonic"
    minor_melodic = "minor_melodic"


class Hands(str, Enum):
    separate = "separate"
    together = "together"


class ClefFocus(str, Enum):
    treble = "treble"
    bass = "bass"
    both = "both"


class Horizon(str, Enum):
    m3 = "3m"
    m6 = "6m"
    m12 = "12m"
    m24 = "24m"


# Allowed focus-area tags for a practice session.
FOCUS_AREAS = (
    "scales",
    "arpeggios",
    "etudes",
    "reading",
    "polyrhythm",
    "piece",
    "fun",
)


# --------------------------------------------------------------------------- #
# Tables
# --------------------------------------------------------------------------- #
class Piece(SQLModel, table=True):
    __tablename__ = "pieces"

    id: int | None = Field(default=None, primary_key=True)
    title: str
    composer: str
    status: PieceStatus = PieceStatus.in_progress
    track: Track = Track.common
    difficulty: int | None = Field(default=None, description="1-10 rough difficulty")
    date_started: dt.date | None = None
    date_completed: dt.date | None = None
    progress_pct: int = Field(default=0, ge=0, le=100)
    target_tempo: int | None = Field(default=None, description="BPM goal")
    current_clean_tempo: int | None = Field(default=None, description="cleanest BPM today")
    order_index: int = Field(default=0, index=True, description="manual ordering within a track")
    loved: bool = Field(default=False, description="pièce que j'aime jouer (pour les recommandations)")
    notes: str = ""


class PracticeSession(SQLModel, table=True):
    __tablename__ = "practice_sessions"

    id: int | None = Field(default=None, primary_key=True)
    date: dt.date = Field(default_factory=_today, index=True)
    duration_min: int = 0
    focus_areas: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    pieces_worked: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    tension_level: int | None = Field(default=None, ge=1, le=5)
    mood: str = ""
    notes: str = ""


class Scale(SQLModel, table=True):
    __tablename__ = "scales"

    id: int | None = Field(default=None, primary_key=True)
    key: str = Field(index=True, description="e.g. C, G, F#, Bb")
    type: ScaleType = ScaleType.major
    hands: Hands = Hands.separate
    current_bpm: int | None = None
    target_bpm: int = 120
    mastered: bool = False
    last_practiced: dt.date | None = None


class TempoLog(SQLModel, table=True):
    __tablename__ = "tempo_log"

    id: int | None = Field(default=None, primary_key=True)
    piece_id: int = Field(foreign_key="pieces.id", index=True)
    passage_label: str = ""
    date: dt.date = Field(default_factory=_today, index=True)
    bpm_clean: int


class ScaleBpmLog(SQLModel, table=True):
    """History of a scale's clean BPM over time (for the evolution curve)."""

    __tablename__ = "scale_bpm_log"

    id: int | None = Field(default=None, primary_key=True)
    scale_id: int = Field(foreign_key="scales.id", index=True)
    date: dt.date = Field(default_factory=_today, index=True)
    bpm: int


class ReadingLog(SQLModel, table=True):
    __tablename__ = "reading_log"

    id: int | None = Field(default=None, primary_key=True)
    date: dt.date = Field(default_factory=_today, index=True)
    clef_focus: ClefFocus = ClefFocus.both
    material: str = ""
    minutes: int = 0
    notes: str = ""


class Milestone(SQLModel, table=True):
    __tablename__ = "milestones"

    id: int | None = Field(default=None, primary_key=True)
    label: str
    horizon: Horizon = Horizon.m3
    done: bool = False
    date_done: dt.date | None = None
    order_index: int = Field(default=0)


class Video(SQLModel, table=True):
    __tablename__ = "videos"

    id: int | None = Field(default=None, primary_key=True)
    piece_id: int | None = Field(default=None, foreign_key="pieces.id", index=True)
    date: dt.datetime = Field(default_factory=_utcnow, index=True)
    file_path: str
    self_notes: str = ""
    ai_feedback: dict | None = Field(default=None, sa_column=Column(JSON))
    audio_metrics: dict | None = Field(default=None, sa_column=Column(JSON))
    analysis_status: str = Field(default="pending", description="pending|analyzing|done|error")


class GeneratorConfig(SQLModel, table=True):
    """Single-row (id=1) user config for the daily session generator: the time
    split across focus blocks + a default session length. Editable & persisted."""

    __tablename__ = "generator_config"

    id: int | None = Field(default=1, primary_key=True)
    w_scales: float = 0.15
    w_etudes: float = 0.15
    w_reading: float = 0.20
    w_piece: float = 0.30
    w_polyrhythm: float = 0.10
    w_fun: float = 0.10
    default_total_min: int = 90


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: int | None = Field(default=None, primary_key=True)
    conversation_id: str = Field(index=True, default="default")
    date: dt.datetime = Field(default_factory=_utcnow, index=True)
    role: str = "user"  # user | assistant | system
    content: str = ""
