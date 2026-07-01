# 🔍 PianoCoach — Audit (Phase 0)

Revue franche, feature par feature, avant les corrections. Menée par 9 relecteurs indépendants lisant le code réel, puis **recoupée à la main** (deux erreurs de relecteurs corrigées, voir la fin).

**Verdict global :** l'app est **réellement fonctionnelle**, pas une maquette — toutes les pages sont câblées à de vrais endpoints, la logique cœur est testée (33 tests), et les 3 canaux (web / desktop / MCP) marchent. Mais il y a **de vrais bugs** (dont ceux que tu as signalés), des **trous de validation/CRUD** qui bloqueront la Phase 2, et **zéro test d'intégration API / frontend**. Rien dans l'audit ne rend tes demandes irréalisables ; un seul point mérite un avertissement (MIDI matériel, voir §Faisabilité).

---

## 1. Bugs confirmés (à corriger)

| # | Bug | Preuve | Phase |
|---|-----|--------|-------|
| **B1** | **Polyrythmie** : en 2:3 la 1ʳᵉ lumière MD ne s'allume jamais ; en 3:4 les 2 premières. La file visuelle est remplie *par main* (`L0,L1,R0,R1,R2`) puis consommée par l'avant avec un gate temporel → `R0` (temps fort) est bloqué derrière `L1`. | `Polyrhythm.tsx:82-113` | 1 |
| **B2** | **Séance — plafond 4 h** : le curseur est bloqué à 240 min. | `Generator.tsx:77 max={240}` (backend `le=480`) | 1 |
| **B3** | **Solfège** : notation anglaise `Do→C` visible partout (table des gammes, seed). Les *suggestions* sont en français mais le stockage/affichage est `C/G/D/A/F`. | `Scales.tsx:212`, `seed.py:93` | 1 |
| **B4** | **ffmpeg** : détecté seulement *à l'analyse* (après upload), et via `shutil.which` — donc lancé depuis le `.app` (PATH minimal, sans `/opt/homebrew/bin`), il dit à tort « installe ffmpeg ». Aucun preflight. | `audio_analysis.py:98-105`, `videos.py` | 1 |
| **B5** | **Suppression de pièce cassée** : `TempoLog.piece_id` / `Video.piece_id` ont une FK **sans `ON DELETE`**. Avec `PRAGMA foreign_keys=ON`, supprimer une pièce référencée par un tempo/vidéo **échoue** (IntegrityError). Bloque le CRUD complet de la Phase 2. | `models.py:130,173` + `db.py` | 2 |
| **B6** | **MCP `get_progress_summary` ignore la lecture** : `reading = []` codé en dur → la composante « Lecture » des jauges est toujours 0 via MCP, incohérent avec le dashboard. | `server.py:186` | 2 |
| **B7** | **`_resolve_piece` ambigu** : le fallback « sous-chaîne » renvoie `partial[0]` sans signaler l'ambiguïté (ex. « Nocturne » → mauvaise pièce). | `server.py:58-69` | 2 |
| **B8** | **Validation d'entrée absente** : `progress_pct` (>100 possible), `difficulty`, `duration_min`/`minutes` (négatifs), BPM, `tension_level`, `limit` non bornés dans les schémas de routeurs. | routers (`pieces.py:22`, `sessions.py`, `tempo.py`…) | 2 |

---

## 2. État fonctionnel par feature

| Feature | État | Note |
|---|---|---|
| Tableau de bord | ✅ Fonctionnel | manque un fallback `isError` (Spinner éternel si l'API tombe) |
| Répertoire (échelles, drag, CRUD) | ✅ Fonctionnel | suppression cassée si tempo/vidéo liés (B5) |
| Journal | ✅ Fonctionnel | pas de validation durée/tension |
| Gammes (+ courbe BPM) | ⚠️ Partiel | notation anglaise (B3) ; édition BPM inline OK |
| Tempo par passage | ⚠️ Partiel | pas de **PATCH** (impossible de corriger un BPM) |
| Lecture | ✅ Fonctionnel | icônes « clé » métaphoriques, pas de vraies clefs |
| Jalons & jauges | ✅ Fonctionnel | jauge par défaut = poids Chopin pour piste inconnue (silencieux) |
| Générateur de séance | ✅ Fonctionnel | plafond 4 h (B2) ; répartition **figée** (Phase 2 la rend éditable) |
| Polyrythmie | 🐞 Bug | audio OK, **lumières MD** cassées (B1) |
| Ressources | ✅ Fonctionnel | statique |
| Coach IA (Gemini) | ✅ Fonctionnel | chevauche le canal MCP (voir §4) |
| Analyse vidéo | ⚠️ Partiel | librosa OK & testé ; **preflight ffmpeg manquant** (B4) ; **aucune borne taille/durée** avant Gemini ; chemin Gemini non vérifié end-to-end |
| Réglages | ✅ Fonctionnel | clé write-only, toggle local OK |
| Serveur MCP | ✅ Fonctionnel | bug lecture (B6), résolution ambiguë (B7), pas d'outil `log_reading`/`update_scale` |
| Desktop (.app) | ✅ Fonctionnel | vérifié |

**Aucun stub trompeur** dans les pages : tout ce qui est affiché est réellement câblé. Les seuls « stubs » sont des **absences** (tests d'intégration, outils MCP manquants), pas du faux.

---

## 3. Dette technique (prioritaire)

1. **Tests d'intégration = 0.** Les 33 tests couvrent la logique pure (projections, jauges, générateur, stats, métriques). **Aucun** test des 11 routeurs (CRUD, 404, validation), **aucun** test frontend (pas de vitest/jest), la logique Web Audio de la polyrythmie n'est pas testable en l'état. → risque de régression élevé pour les Phases 1-4.
2. **Intégrité référentielle** : FK sans `ON DELETE` (B5) ; `pieces_worked` stocke des **titres** (pas des `id`) → logs orphelins si renommage.
3. **`reorder_pieces`** assigne un `order_index` **global** à plat en ignorant les pistes → collisions d'index entre voies.
4. **Validation d'entrée** manquante (B8) — à combler avant de rendre tout éditable.
5. **Pas de migrations (Alembic).** *Acceptable* : `SQLModel.create_all()` crée les **nouvelles tables** et colonnes *nullable* au démarrage. Donc **Phase 3 (MIDI, compétences) faisable sans Alembic** tant que les changements restent additifs. À documenter.
6. Messages d'erreur Gemini bruts (`UNAVAILABLE`) affichés tels quels ; pas de logs des tâches de fond.

---

## 4. Superflu / minimalisme (mes propositions de coupe)

- **Coach Gemini vs MCP** : chevauchement réel (même profil, même résumé). **Je garde les deux** mais avec des rôles clairs : Gemini = coach *rapide dans l'app* (marche sans Claude ouvert) ; MCP = analyse *profonde via Claude* (gratuit). Ta Phase 4 confirme : pas de nouveau fournisseur IA.
- **Analyse vidéo IA** : avec le **MIDI** (Phase 3, données bien plus fiables), la valeur du feedback vidéo Gemini baisse. **Proposition : ne plus investir dessus** — garder les métriques locales + Gemini optionnel tel quel, sans l'étoffer.
- **Page Lecture ↔ Trainer de solfège** : le trainer de solfège (Phase 3) devient le *vrai* outil de lecture et **auto-loguera** la pratique. **Proposition : fusionner** — la page Lecture se réduit à l'historique alimenté par le trainer, plutôt que deux features déconnectées.
- Adaptateurs DTO dupliqués (`PieceLike` dans projections.py *et* gauges.py) : à mutualiser (petit refactor, non urgent).
- **Pas** de coupe de `difficulty` (voir corrections ci-dessous) ni de la grille composite de polyrythmie (utile).

---

## 5. Faisabilité des Phases 1-4

| Demande | Verdict | Note |
|---|---|---|
| **P1** naming solfège / bug polyrythmie / cap séance / preflight ffmpeg | ✅ Facile | fixes ciblés + tests |
| **P2** tout éditable (CRUD manquant, répartition éditable, préférences) | ✅ Faisable | ajouter GET/{id}, PATCH tempo, validation, `ON DELETE`, config de répartition persistée |
| **P3 — MIDI (CN201 → mido/python-rtmidi → WebSocket)** | ✅ Faisable, **1 réserve** | approche backend correcte (Web MIDI **indisponible** dans WKWebView — confirmé). Nouvelles deps `mido`+`python-rtmidi`. ⚠️ **Je ne peux pas valider le vrai handshake CN201 sans ton clavier** : je construis + teste avec un **port MIDI virtuel** (bus IAC macOS), tu valides ensuite branché. |
| **P3 — Trainer solfège** | ✅ Faisable | nécessite une lib de **notation** (VexFlow, ~60 Ko) — nouvelle dep frontend. Répétition espacée = pur code. |
| **P3 — Taxonomie de compétences + progression par pièce** | ✅ Faisable **sans migrations** | nouvelles tables `skills`, `piece_skills`, `session_skills` (additif → `create_all` suffit). |
| **P4 — Moteur de reco heuristique** | ✅ Faisable | ~80 % de la logique existe déjà (`gauges`, `projections`). Pur Python, explicable, gratuit. |

**Conclusion : rien à bloquer.** Je continue. Le seul point à connaître d'avance : **le MIDI sera construit + testé contre un port virtuel ; la validation finale avec le vrai CN201 t'incombera** (5 min : brancher en USB, ouvrir la page, jouer une note).

---

## 6. Plan des phases (proposé)

- **Phase 1 — Corrections rapides** *(fait en premier)* : naming solfège (canon interne, `Do/Ré` à l'affichage) · fix polyrythmie **+ test** (extraction de la logique pure + ajout de **vitest**) · plafond séance levé · **preflight ffmpeg** (démarrage + Réglages + `setup.sh`) + garde-fous taille/durée vidéo.
- **Phase 2 — Tout éditable** : CRUD complet (GET/{id}, **PATCH tempo**, `ON DELETE SET NULL`), validation d'entrée, **répartition de séance éditable & persistée** + reco mensuelle, **préférences** (pièces aimées). Fix B6/B7 (MCP).
- **Phase 3 — MIDI + solfège + compétences** : plomberie MIDI (rtmidi/mido + WebSocket + indicateur « piano connecté ») · trainer de solfège (VexFlow, répétition espacée clé de fa) · usages MIDI (gammes auto-loguées, capture de pièce) · taxonomie de compétences + tableau de progression pièce→compétence.
- **Phase 4 — Recommandations** : moteur heuristique transparent (quoi travailler, prochaine pièce, sous-investissement) alimentant séance du jour + reco mensuelle.

**Transverse** : chaque changement testé, non-régression protégée, MCP/Claude Desktop/`dev.sh`/`desktop.sh` intacts, commits par unité, push par phase.

---

## 7. Corrections apportées aux relecteurs (transparence)

Deux affirmations de l'audit automatique étaient **fausses** (vérifiées dans le code) et ne figurent pas ci-dessus :
1. « Enums `ChampionshipLevel` / `VideoMp4` inutilisés » → **hallucination** : ces enums n'existent pas (`PieceStatus` n'a que `target/planned/in_progress/learned`).
2. « `Piece.difficulty` est inutilisé (stub) » → **faux** : `difficulty` est bien utilisé par la **projection** (`estimate_piece_hours(difficulty, progress)` = `difficulté × 9 h`). Il n'est simplement pas utilisé par le générateur ni les jauges. → **on le garde**.
