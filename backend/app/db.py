"""Database engine + session helpers.

Single SQLite file under data/. WAL mode so the FastAPI backend and the MCP
server can read/write the same file concurrently without locking each other out.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import event, inspect, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

# import models so SQLModel.metadata is populated before create_all
from . import models  # noqa: F401
from .config import settings

_engine: Engine | None = None

# Minimal, dependency-free "migration" for ADDITIVE columns on existing tables.
# SQLModel.create_all() creates missing tables but never ALTERs existing ones,
# and we intentionally avoid Alembic for this local-first app. New *tables* are
# handled by create_all; new *columns* on existing tables are added here.
# Each entry: (table, column, column DDL incl. type + default).
_ADDITIVE_COLUMNS: list[tuple[str, str, str]] = [
    ("pieces", "loved", "BOOLEAN NOT NULL DEFAULT 0"),
]


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        settings.ensure_dirs()
        _engine = create_engine(
            settings.database_url,
            echo=False,
            connect_args={"check_same_thread": False},
        )

        @event.listens_for(_engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _rec):  # pragma: no cover - thin glue
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA busy_timeout=5000")
            cur.close()

    return _engine


def _ensure_columns(engine: Engine) -> None:
    """Add any missing additive columns to existing tables (see _ADDITIVE_COLUMNS)."""
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    for table, column, ddl in _ADDITIVE_COLUMNS:
        if table not in tables:
            continue  # brand-new table → create_all already made it with the column
        existing = {c["name"] for c in insp.get_columns(table)}
        if column not in existing:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def init_db() -> None:
    """Create missing tables, then patch in any additive columns."""
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    _ensure_columns(engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: yields a session per request."""
    with Session(get_engine()) as session:
        yield session


def session_scope() -> Session:
    """Standalone session (for scripts / MCP server)."""
    return Session(get_engine())
