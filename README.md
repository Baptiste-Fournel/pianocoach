# 🎹 PianoCoach

Application **locale-first, assistée par IA**, pour suivre et optimiser ma progression au piano — du suivi de répertoire au coaching personnalisé, jusqu'à l'analyse de mes vidéos de jeu.

Objectifs cibles : la *Fantaisie-impromptu* de Chopin et le 3ᵉ mouvement de la *Sonate au clair de lune* de Beethoven, abordés par deux « voies » progressives.

![CI](https://github.com/Baptiste-Fournel/pianocoach/actions/workflows/ci.yml/badge.svg)

> **Tout reste sur ma machine.** La base de données et les vidéos ne quittent jamais le PC. Seuls le chat coach et (optionnellement) l'analyse vidéo IA appellent l'API Gemini — et l'analyse vidéo peut être désactivée d'un interrupteur.

---

## Fonctionnalités

- **Répertoire & objectifs** — deux voies (Chopin / Beethoven) + socle commun + néoclassique, en « échelle » visuelle vers chaque pièce cible. Statut, % d'avancement, tempo cible vs tempo propre, glisser-déposer pour réordonner.
- **Journal de pratique** — durée, zones travaillées, pièces, niveau de tension, ressenti, notes.
- **Gammes & arpèges** — grille par tonalité, BPM actuel vs cible, maîtrise, courbe d'évolution du BPM.
- **Tempo par passage** — j'enregistre le BPM auquel je joue *proprement* ; courbe de progression dans le temps.
- **Lecture** — sessions de déchiffrage avec focus clé de fa (ma faiblesse).
- **Tableau de bord** — temps de pratique, **série de régularité** (streak bienveillant), répartition des focus, et **projection « temps restant avant la cible »** (heuristique transparente, recalculée selon le rythme réel).
- **Générateur de séance** — construit la séance du jour (gammes en rotation, étude, lecture, passage de pièce, polyrythmie, plaisir) selon la durée et le jour.
- **Jalons & jauges** — checklist 3/6/12/24 mois + jauges « prêt pour [pièce cible] » calculées depuis les prérequis.
- **Trainer de polyrythmie** — métronome visuel + audio (Web Audio) jouant le motif composite des deux mains, pour le 2 contre 3 et le 4 contre 3.
- **Coaching IA** — (a) **serveur MCP** pour Claude Desktop / Claude Code qui lit mes données en direct ; (b) **chat intégré** via Gemini, amorcé par mon profil et mes données récentes.
- **Analyse vidéo** — upload local → métriques objectives **librosa** (tempo + courbe, régularité des attaques, dynamique) **+** feedback Gemini multimodal (doigté, tension/relâchement, posture, sonorité), ancré dans les chiffres. Bascule « 100 % local » pour ne calculer que les métriques sans rien envoyer.

---

## Architecture

```
┌──────────────┐   REST /api    ┌─────────────────────────┐
│  Frontend     │ ─────────────▶ │  Backend FastAPI         │
│  React + Vite │                │  (sert l'API + le SPA)   │
└──────────────┘                │   • SQLModel / SQLite    │
                                 │   • ffmpeg + librosa     │
┌──────────────┐                 │   • Gemini (chat/vidéo)  │
│ Claude Desktop│  stdio (MCP)   └───────────┬─────────────┘
│  / Claude Code│ ─────────────▶              │ lit/écrit
└──────────────┘   serveur MCP ──────────────▶ data/pianocoach.db (SQLite, WAL)
                                                data/videos/  (vidéos locales)
```

- **Backend** (`backend/`) : FastAPI, SQLModel + SQLite, logique métier (projections, générateur, jauges, analyse audio), appels Gemini. Sert aussi le frontend buildé.
- **Frontend** (`frontend/`) : React + TypeScript + Vite + TailwindCSS + Recharts.
- **Serveur MCP** (`mcp_server/`) : process distinct (stdio) qui lit/écrit la **même** base SQLite en réutilisant les modèles du backend → aucun risque de divergence de schéma.

Python **3.12** est épinglé via `uv` (les roues binaires de `librosa`/`numba` ne sont pas encore fiables sur 3.14). Ton Python système n'est pas touché.

---

## Prérequis

| Outil | Version | Pour |
|-------|---------|------|
| [uv](https://docs.astral.sh/uv/) | récent | Python 3.12 + dépendances (installé/géré par uv) |
| Node.js | ≥ 20 | frontend |
| ffmpeg | récent | extraction audio des vidéos (`brew install ffmpeg`) |
| [gh](https://cli.github.com/) | — | (optionnel) opérations GitHub |
| Clé Gemini | gratuite | (optionnel) chat coach + analyse vidéo IA — [Google AI Studio](https://aistudio.google.com/app/apikey) |

> ffmpeg et la clé Gemini sont **optionnels** : sans eux, tout le suivi fonctionne, seules l'analyse vidéo et l'IA sont indisponibles.

---

## Installation & lancement

```bash
# 1. Tout installer (deps Python + npm, build frontend, init + seed de la base)
./scripts/setup.sh

# 2. Lancer en développement (backend :8000 + frontend :5173, autoreload)
./scripts/dev.sh
#   → UI :   http://localhost:5173
#   → API :  http://localhost:8000/api  (docs : /api/docs)
```

**Mode production local** (le backend sert le frontend buildé sur un seul port) :

```bash
uv run uvicorn app.main:app --port 8000
# puis ouvre http://localhost:8000
```

La clé Gemini se règle dans l'app (**Réglages**) ou dans le fichier `.env` (`GEMINI_API_KEY=…`). `.env` n'est **jamais** committé.

---

## Application desktop (fenêtre native)

Pour ouvrir PianoCoach comme une **vraie app**, sans onglet de navigateur (fenêtre WebKit native via [pywebview](https://pywebview.flowrl.com/)) :

```bash
./scripts/desktop.sh           # build si besoin, puis ouvre la fenêtre
```

Ou **double-clique `PianoCoach.command`** dans le Finder (niveau « facile », voir Packaging plus bas).

Comment ça marche : le launcher (`desktop/main.py`) choisit un **port libre sur `127.0.0.1`** (jamais exposé sur le réseau), lance le backend FastAPI dans un thread, attend `/api/health`, puis ouvre la fenêtre Cocoa. Fermer la fenêtre **arrête proprement** uvicorn. Le mode web (`scripts/dev.sh`), les tests et le serveur MCP sont inchangés.

```bash
PIANOCOACH_DEBUG=1 ./scripts/desktop.sh                 # active les devtools de la webview
PIANOCOACH_SELFTEST=1 uv run python -m desktop.main      # vérif headless (sans fenêtre)
```

> Le launcher **doit** tourner dans l'env `uv` Python 3.12 (où pywebview/pyobjc sont installés), d'où `uv run`. `pywebview` est une dépendance **macOS uniquement** (marqueur `sys_platform == 'darwin'`) : la CI Linux ne l'installe jamais.

### Packaging

- **Niveau facile (fourni)** — double-clic : `PianoCoach.command` ouvre la fenêtre en réutilisant ton env `uv`. Aucun empaquetage de Python. Suffisant pour un usage perso. Pour un look « app », tu peux créer un raccourci Automator « Exécuter un script shell » → `cd … && ./scripts/desktop.sh`.
- **Niveau difficile (non implémenté — sur demande)** — `.app` 100 % autonome distribuable (py2app/PyInstaller). Pièges connus : empaqueter Python + `librosa`/`numba`/`llvmlite` (hooks et `.dylib` à inclure à la main), embarquer un binaire **`ffmpeg`** et le retrouver au runtime, **signer + notariser** pour Gatekeeper, et une taille de plusieurs centaines de Mo. À ne lancer que si tu veux distribuer l'app — dis-le-moi.

---

## Connexion MCP (coaching via Claude — sans coût API)

Le serveur MCP expose mes données à Claude, qui peut alors me conseiller en lisant tout en direct, sans rien re-saisir, **couvert par mon abonnement** (pas d'appel API facturé).

### Claude Code

```bash
claude mcp add pianocoach -- uv run --directory /Users/baptiste/pianocoach pianocoach-mcp
```

### Claude Desktop

Édite `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) :

```json
{
  "mcpServers": {
    "pianocoach": {
      "command": "/opt/homebrew/bin/uv",
      "args": ["run", "--directory", "/Users/baptiste/pianocoach", "pianocoach-mcp"]
    }
  }
}
```

> ⚠️ Utilise le **chemin absolu** vers `uv` (`which uv`). Claude Desktop lance les
> serveurs MCP sans le `PATH` de ton shell, donc un simple `"uv"` échoue souvent
> par « command not found ».

Redémarre Claude Desktop (Cmd+Q puis rouvre). Outils disponibles :

| Lecture | Écriture (confirmation demandée) |
|---------|----------------------------------|
| `get_repertoire`, `get_recent_sessions`, `get_scale_progress`, `get_tempo_progression`, `get_milestones`, `get_progress_summary` | `log_session`, `update_piece_progress`, `log_tempo` |

> Exemple de prompt : *« Regarde get_progress_summary et propose-moi un plan pour les 2 prochaines semaines vers la Fantaisie-impromptu. »*

---

## Confidentialité

- **Locale-first** : `data/` (base SQLite + `data/videos/`) est **gitignoré** et ne quitte jamais la machine.
- Aucun secret committé : `.env`, `data/`, `node_modules`, venv sont exclus.
- **Chat coach** : envoie à Gemini ton profil + un résumé de tes données récentes (texte) uniquement quand une clé est configurée.
- **Analyse vidéo** : par défaut, la vidéo est envoyée à Gemini (File API) pour le feedback. Active **« Vidéo 100 % locale »** dans les Réglages pour **ne jamais** envoyer la vidéo — seules les métriques `librosa` sont calculées, et tu peux les faire analyser via le canal MCP/Claude.

---

## Démo en ligne (frontend seul)

Une démo statique est déployée sur **GitHub Pages** : <https://baptiste-fournel.github.io/pianocoach/>

Elle tourne avec des **données d'exemple en mémoire, en lecture seule**. Le coach IA et l'analyse vidéo nécessitent le backend local (impossible sur un hébergement statique).

---

## Structure

```
pianocoach/
├── backend/        FastAPI · SQLModel · services (projections, générateur, jauges,
│                   analyse audio, Gemini) · seed (§profil) · tests
├── frontend/       Vite/React/TS · 13 pages · design system · client API typé
├── mcp_server/     serveur MCP stdio (lit/écrit la même base)
├── desktop/        launcher fenêtre native (pywebview) — main.py
├── scripts/        setup.sh · dev.sh · desktop.sh
├── PianoCoach.command   double-clic Finder → fenêtre native
├── data/           SQLite + videos/  (gitignoré)
└── .github/workflows/  ci.yml (lint+tests+build) · pages.yml (démo)
```

## Tests & qualité

```bash
uv run pytest                       # logique cœur : projection, générateur, jauges, métriques audio, stats
uv run ruff check backend mcp_server
cd frontend && npm run typecheck && npm run build
```

La CI GitHub Actions rejoue lint + tests (backend) et typecheck + build (frontend) à chaque push.

## Dépannage

- **`ffmpeg introuvable`** → `brew install ffmpeg` (l'analyse vidéo en a besoin ; le reste fonctionne sans).
- **Python 3.14 sur la machine** → normal, `uv` installe et utilise un Python 3.12 isolé pour ce projet.
- **Le chat répond « aucune clé »** → ajoute ta clé Gemini dans Réglages.
- **MCP non visible dans Claude Desktop** → vérifie le chemin absolu dans la config et redémarre l'app.

---

> ⚠️ Les retours IA (chat et vidéo) sont **indicatifs** et ne remplacent pas un professeur de piano.
