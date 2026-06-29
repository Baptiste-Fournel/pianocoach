"""Database engine + session helpers.

Single SQLite file under data/. WAL mode so the FastAPI backend and the MCP
server can read/write the same file concurrently without locking each other out.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

# import models so SQLModel.metadata is populated before create_all
from . import models  # noqa: F401
from .config import settings

_engine: Engine | None = None


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


def init_db() -> None:
    """Create all tables if they don't exist."""
    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    """FastAPI dependency: yields a session per request."""
    with Session(get_engine()) as session:
        yield session


def session_scope() -> Session:
    """Standalone session (for scripts / MCP server)."""
    return Session(get_engine())
