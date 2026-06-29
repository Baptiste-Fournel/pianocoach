#!/usr/bin/env bash
# PianoCoach — one-shot setup: deps, env, DB seed, frontend build.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

case "$(uname -s)" in
  Darwin) OS="macOS" ;;
  Linux)  OS="Linux" ;;
  *)      OS="$(uname -s)" ;;
esac
bold "PianoCoach setup ($OS)"

# ---- Prerequisites ----
bold "1/5 · Vérification des prérequis"
command -v uv   >/dev/null || { echo "uv manquant. Installe-le : https://docs.astral.sh/uv/ (brew install uv)"; exit 1; }
ok "uv $(uv --version | awk '{print $2}')"
command -v node >/dev/null || { echo "Node.js manquant (≥20). https://nodejs.org"; exit 1; }
ok "node $(node --version)"
if command -v ffmpeg >/dev/null; then ok "ffmpeg présent"; else warn "ffmpeg absent — l'analyse vidéo locale ne marchera pas (brew install ffmpeg)"; fi

# ---- Python env (pinned to 3.12 via uv) ----
bold "2/5 · Environnement Python (backend + MCP)"
uv sync --all-packages
ok "Dépendances Python installées (.venv)"

# ---- .env ----
bold "3/5 · Configuration"
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  ok ".env créé depuis .env.example — ajoute ta clé Gemini (optionnel) dans Réglages ou ce fichier"
else
  ok ".env déjà présent"
fi

# ---- DB init + seed ----
bold "4/5 · Base de données (création + seed depuis le profil §8)"
uv run python -m app.seed
ok "Base SQLite prête dans ./data/"

# ---- Frontend ----
bold "5/5 · Frontend (install + build)"
cd "$ROOT/frontend"
npm install --no-fund --no-audit
npm run build
rm -rf "$ROOT/backend/static"
cp -r "$ROOT/frontend/dist" "$ROOT/backend/static"
ok "Frontend buildé et copié dans backend/static (servi par le backend)"

cd "$ROOT"
bold "Terminé ✅"
echo "Lance l'appli :   ./scripts/dev.sh"
echo "Ou en prod local : uv run uvicorn app.main:app --port 8000   puis ouvre http://localhost:8000"
