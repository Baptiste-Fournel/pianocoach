#!/usr/bin/env bash
# PianoCoach — dev mode: FastAPI (8000, autoreload) + Vite (5173, proxy /api).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }

cleanup() {
  bold "Arrêt…"
  [ -n "${BACK_PID:-}" ] && kill "$BACK_PID" 2>/dev/null || true
  [ -n "${FRONT_PID:-}" ] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

bold "Backend → http://localhost:8000  (API docs: /api/docs)"
uv run uvicorn app.main:app --reload --port 8000 &
BACK_PID=$!

bold "Frontend → http://localhost:5173"
( cd frontend && npm run dev ) &
FRONT_PID=$!

cat <<EOF

────────────────────────────────────────────────────────────
PianoCoach tourne :
  • UI (dev)  : http://localhost:5173
  • API       : http://localhost:8000/api
  • API docs  : http://localhost:8000/api/docs

Serveur MCP (pour Claude Desktop / Claude Code), dans un autre terminal :
  uv run pianocoach-mcp
Configuration Claude Desktop : voir le README (section « Connexion MCP »).
────────────────────────────────────────────────────────────

Ctrl+C pour tout arrêter.
EOF

wait
