#!/usr/bin/env bash
# PianoCoach — application desktop native (pywebview).
# Build le frontend si besoin, puis ouvre la fenêtre native.
# (scripts/dev.sh — le mode web — reste inchangé.)
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# Le backend sert backend/static : on s'assure qu'il existe (sinon build + copie).
if [ ! -f "$ROOT/backend/static/index.html" ]; then
  echo "Build du frontend…"
  ( cd frontend && npm install --no-fund --no-audit && npm run build )
  rm -rf "$ROOT/backend/static"
  cp -r "$ROOT/frontend/dist" "$ROOT/backend/static"
fi

echo "Ouverture de PianoCoach (fenêtre native)…"
# uv run → env Python 3.12 où pywebview est installé (pas le Python système 3.14).
exec uv run python -m desktop.main
