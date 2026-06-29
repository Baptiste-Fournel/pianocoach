"""PianoCoach FastAPI app — serves the REST API and the built frontend.

Run:  uv run uvicorn app.main:app --reload  (from backend/, via scripts/dev.sh)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import init_db
from .routers import (
    chat,
    dashboard,
    generator,
    milestones,
    pieces,
    reading,
    scales,
    sessions,
    tempo,
    videos,
)
from .routers import (
    settings as settings_router,
)
from .seed import seed

# Built frontend lives here after `npm run build` (see scripts/setup.sh).
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    seed()  # idempotent — only fills empty tables
    yield


app = FastAPI(title="PianoCoach", version="0.1.0", lifespan=lifespan)

# Dev: Vite runs on :5173 and proxies /api here, but allow direct CORS too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = FastAPI(title="PianoCoach API")
for r in (
    pieces.router,
    sessions.router,
    scales.router,
    tempo.router,
    reading.router,
    milestones.router,
    dashboard.router,
    generator.router,
    settings_router.router,
    chat.router,
    videos.router,
):
    api.include_router(r)


@api.get("/health")
def health():
    return {"status": "ok", "gemini_configured": settings.gemini_enabled,
            "video_local_only": settings.video_local_only}


app.mount("/api", api)


# ---- Serve the built SPA (production) ------------------------------------- #
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # Serve real files when present, otherwise fall back to index.html
        # so client-side routing works on refresh/deep links.
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
else:

    @app.get("/")
    def dev_root():
        return {
            "app": "PianoCoach",
            "note": "Frontend non buildé. Lance `npm run dev` (port 5173) "
            "ou `scripts/setup.sh` pour builder le frontend servi ici.",
            "api_docs": "/api/docs",
        }
