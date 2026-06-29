#!/usr/bin/env bash
# Double-clique ce fichier dans le Finder pour ouvrir PianoCoach en fenêtre native.
# (Niveau « facile » : réutilise l'env uv du dépôt, n'empaquette pas Python.)
cd "$(dirname "$0")" || exit 1
exec ./scripts/desktop.sh
