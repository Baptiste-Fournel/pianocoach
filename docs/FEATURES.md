# 🎹 PianoCoach — Guide des fonctionnalités

Comment marche **chaque** fonctionnalité : à quoi elle sert, comment l'utiliser, et ce qui se passe « sous le capot » (surtout pour les calculs qui ne sont pas évidents). Toutes les données restent **locales** (voir [Données & confidentialité](#données--confidentialité)).

> Pour installer/lancer l'app, voir le [README](../README.md). Ce document décrit l'usage.

## Sommaire

- [Vue d'ensemble](#vue-densemble)
- [1. Tableau de bord](#1-tableau-de-bord)
- [2. Répertoire & objectifs](#2-répertoire--objectifs)
- [3. Journal de pratique](#3-journal-de-pratique)
- [4. Gammes & arpèges](#4-gammes--arpèges)
- [5. Tempo par passage](#5-tempo-par-passage)
- [6. Lecture](#6-lecture)
- [7. Jalons & jauges de préparation](#7-jalons--jauges-de-préparation)
- [8. Générateur de séance](#8-générateur-de-séance)
- [9. Trainer de polyrythmie](#9-trainer-de-polyrythmie)
- [10. Hub de ressources](#10-hub-de-ressources)
- [11. Coach IA (chat Gemini)](#11-coach-ia-chat-gemini)
- [12. Analyse vidéo](#12-analyse-vidéo)
- [13. Réglages](#13-réglages)
- [14. Serveur MCP (coaching via Claude)](#14-serveur-mcp-coaching-via-claude)
- [Les calculs en détail](#les-calculs-en-détail)
- [Données & confidentialité](#données--confidentialité)
- [Trois façons de lancer l'app](#trois-façons-de-lancer-lapp)

---

## Vue d'ensemble

PianoCoach centralise ton suivi pianistique autour de **deux pièces cibles** — la *Fantaisie-impromptu* (Chopin) et le 3ᵉ mvt du *Clair de lune* (Beethoven) — atteintes via deux « voies » de paliers progressifs, plus un socle commun.

Au premier lancement, la base est **pré-remplie** (seed) depuis ton profil : 14 pièces réparties en voies Chopin / Beethoven / socle, 5 gammes majeures de départ (Do, Sol, Ré, La, Fa), et 13 jalons sur 3/6/12/24 mois. L'historique (séances, tempos, lecture) démarre **vide** : il ne reflète que ce que tu saisis réellement.

---

## 1. Tableau de bord

**Route :** `/` · **API :** `GET /api/dashboard`

**À quoi ça sert :** ta progression d'un coup d'œil.

**Ce que tu y vois :**
- **Série de régularité (streak)** en haut : nombre de jours consécutifs de pratique, avec un ton bienveillant (jamais culpabilisant — la régularité est le point à travailler).
- **Stats** : heures cette semaine / ce mois / total cumulé, jalons franchis.
- **Temps estimé avant les pièces cibles** : une carte par cible avec le nombre de **mois estimés**, une fourchette, une date approximative, et un bouton « Comment c'est calculé » qui déplie les hypothèses + les paliers restants.
- **Régularité (12 dernières semaines)** : une heatmap façon « contributions » — chaque case = un jour, l'intensité = les minutes pratiquées.
- **Pratique quotidienne** (aire) et **Répartition du travail** (camembert des minutes par zone).
- **Préparation aux pièces cibles** : jauges de readiness (détail dans [Jalons](#7-jalons--jauges-de-préparation)).

**Sous le capot :** tout est recalculé à la volée depuis tes séances. Voir [Les calculs en détail](#les-calculs-en-détail) pour le streak, la projection et les jauges.

---

## 2. Répertoire & objectifs

**Route :** `/repertoire` · **API :** `GET/POST/PATCH/DELETE /api/pieces`, `POST /api/pieces/reorder`

**À quoi ça sert :** gérer tes pièces, organisées en « échelles » vers chaque cible.

**Comment l'utiliser :**
- Chaque **voie** (Chopin, Beethoven) + le **socle commun** + le **néoclassique** s'affichent en échelle verticale : la barre colorée = la voie, chaque barreau = une pièce, la cible en haut entourée d'un liseré accent.
- **Glisser-déposer** (poignée à gauche) pour réordonner les paliers d'une voie.
- Chaque carte montre : statut, **% d'avancement** (barre), difficulté /10, **tempo propre actuel vs tempo cible**, date de début, notes.
- **Statut** modifiable directement via le menu déroulant : `À venir` (planned), `En cours` (in_progress), `Apprise` (learned), `Cible` (target). Passer une pièce en « Apprise » fixe automatiquement 100 % et la date du jour.
- **✏️** pour éditer (titre, compositeur, voie, difficulté, tempos, notes), **🗑** pour supprimer (avec confirmation).

> Le statut `planned` (« À venir ») a été ajouté pour distinguer les paliers en file d'attente des pièces réellement en cours — sinon tout afficherait « en cours ».

---

## 3. Journal de pratique

**Route :** `/journal` · **API :** `GET/POST/PATCH/DELETE /api/sessions`

**À quoi ça sert :** noter chaque séance, même courte. La régularité prime sur la durée.

**Comment l'utiliser :** formulaire « Nouvelle session » → date (défaut aujourd'hui), **durée** (min), **axes de travail** (puces : Gammes, Arpèges, Études, Lecture, Polyrythmie, Pièce, Plaisir — multi-sélection), **pièces travaillées**, **niveau de tension** (1–5), **humeur**, **notes**. Les séances passées s'affichent en liste (récentes d'abord) avec suppression.

**Effet ailleurs :** chaque séance alimente le **streak**, la **heatmap**, la **répartition des focus**, les **totaux** et la **projection** (qui mesure ton vrai rythme à partir d'ici).

---

## 4. Gammes & arpèges

**Route :** `/gammes` · **API :** `GET/POST/PATCH/DELETE /api/scales`, `GET /api/scales/bpm-history`

**À quoi ça sert :** suivre la montée en tempo de chaque tonalité.

**Comment l'utiliser :**
- Grille par tonalité : type (Majeure / Mineure harmonique / Mineure mélodique), mains (Séparées / Ensemble), **BPM actuel** (éditable en ligne), **BPM cible**, **maîtrisée** (interrupteur), dernière pratique. Une barre montre `actuel / cible`.
- « Ajouter une gamme » pour étendre la grille (toutes majeures, mineures, arpèges…).
- **Courbe d'évolution du BPM** : chaque fois que tu mets à jour le BPM actuel d'une gamme, un point d'historique est enregistré (table `scale_bpm_log`), et le graphe multi-lignes trace la progression par tonalité.

---

## 5. Tempo par passage

**Route :** `/tempo` · **API :** `GET/POST/DELETE /api/tempo`, `GET /api/tempo/progression`

**À quoi ça sert :** mesurer objectivement les progrès sur un passage difficile — le BPM auquel tu le joues **proprement**.

**Comment l'utiliser :** choisis une pièce, nomme le passage (ex. « mesures 1–16 »), saisis le **BPM propre** du jour. Un graphe par pièce trace la courbe dans le temps, avec une **ligne de référence « Cible »** au tempo visé. Loguer un BPM met aussi à jour le « tempo propre actuel » de la pièce s'il bat le précédent record.

---

## 6. Lecture

**Route :** `/lecture` · **API :** `GET/POST/PATCH/DELETE /api/reading`

**À quoi ça sert :** travailler le déchiffrage, en insistant sur la **clé de fa** (le point faible) et la sortie de Synthesia/flowkey vers la vraie partition.

**Comment l'utiliser :** logue une session de lecture → date, **focus de clé** (Sol / Fa / Deux clés — défaut Fa), matériel, **minutes**, notes. Des stats montrent le total et la **part de clé de fa** (pour t'encourager à l'augmenter), avec un graphe des minutes par clé.

---

## 7. Jalons & jauges de préparation

**Route :** `/jalons` · **API :** `GET/POST/PATCH/DELETE /api/milestones` (+ readiness via `/api/dashboard`)

**À quoi ça sert :** une feuille de route bienveillante + une estimation « suis-je prêt pour la pièce cible ? ».

**Comment l'utiliser :**
- **« Prêt pour… »** : une jauge radiale par pièce cible (0–100 %) avec le **détail pondéré** des prérequis (gammes, lecture, polyrythmie, paliers). Indicatif, jamais un jugement.
- **Checklist** groupée par horizon (3 / 6 / 12 / 24 mois) : coche les jalons (barré + daté quand fait), ajoute les tiens, supprime. Compteur par horizon.

**Sous le capot :** voir [les jauges de préparation](#jauges-de-préparation-readiness).

---

## 8. Générateur de séance

**Route :** `/seance` · **API :** `GET /api/generator/session?total_min=&weekday=`

**À quoi ça sert :** construire la séance du jour, équilibrée et adaptée à tes priorités.

**Comment l'utiliser :** règle la **durée totale** (curseur + presets) et le **jour** (par défaut aujourd'hui). L'app produit un déroulé de blocs (gammes, technique, lecture, pièce, polyrythmie, plaisir) avec une durée pour chacun, plus la gamme du jour, la pièce du jour et le motif de polyrythmie.

**Sous le capot :** répartition par défaut — Pièce 30 %, Lecture 20 %, Gammes 15 %, Études 15 %, Polyrythmie 10 %, Plaisir 10 % (la lecture est volontairement renforcée). Les minutes sont arrondies pour **tomber pile** sur le total. La séance est **déterministe selon le jour** : la gamme tourne parmi les non-maîtrisées, la pièce parmi celles en cours/cible, la polyrythmie alterne **2 contre 3** (jours pairs) / **3 contre 4** (jours impairs), et la lecture est biaisée clé de fa (4 jours sur 7).

---

## 9. Trainer de polyrythmie

**Route :** `/polyrythmie` · 100 % côté navigateur (Web Audio), pas de backend.

**À quoi ça sert :** entraîner le **2 contre 3** et le **3 contre 4** (le cœur technique de la Fantaisie-impromptu).

**Comment l'utiliser :** choisis le motif (2:3 ou 3:4) et le **tempo du cycle**, puis Lecture. Tu entends le **motif composite** des deux mains (deux timbres distincts, un accent sur le temps fort commun) et tu vois deux rangées de points (main gauche / main droite) qui s'allument en rythme, plus une grille temporelle du cycle. Des aides mnémotechniques sont affichées. Tout s'arrête proprement à l'arrêt / en quittant la page.

**Sous le capot :** un seul `AudioContext`, ordonnanceur à anticipation (lookahead ~100 ms) pour un timing précis ; sur un cycle de durée T, la main à *a* frappes joue à `i·T/a`, celle à *b* frappes à `j·T/b`.

---

## 10. Hub de ressources

**Route :** `/ressources` · statique.

**À quoi ça sert :** accès rapide aux liens utiles : partitions **IMSLP** (Fantaisie-impromptu op. 66, Sonate op. 27 n° 2, Préludes op. 28, Nocturnes op. 9), **théorie** (musictheory.net, teoria), **métronome/polyrythmie** (le trainer intégré + apps), et un rappel de tes docs de plan + le coach intégré.

---

## 11. Coach IA (chat Gemini)

**Route :** `/coach` · **API :** `GET/POST/DELETE /api/chat...`

**À quoi ça sert :** poser des questions rapides à un coach qui **connaît tes données**.

**Comment l'utiliser :** tape ta question (Entrée pour envoyer, Maj+Entrée pour un saut de ligne). L'historique est conservé ; « Effacer la conversation » repart à zéro. Si aucune clé Gemini n'est configurée, un encart te renvoie aux Réglages.

**Sous le capot :** chaque message part à **Gemini** (modèle Flash) avec un *system prompt* de coach amorcé par **ton profil** (11 mois, clé de fa fragile, régularité à travailler, pièces cibles…) **+ un résumé live de tes données** (streak, heures, gammes maîtrisées, jalons, pièces en cours, projections). Les erreurs transitoires de l'offre gratuite (503/429) sont **réessayées** automatiquement.

> ⚠️ Le coach est **indicatif** et ne remplace pas un professeur.

---

## 12. Analyse vidéo

**Route :** `/videos` · **API :** `POST /api/videos`, `GET /api/videos[/{id}]`, `POST /api/videos/{id}/analyze`, `GET /api/videos/{id}/file`

**À quoi ça sert :** filmer ton jeu et obtenir un retour, sur deux niveaux.

**Comment l'utiliser :** upload (fichier vidéo + pièce + notes perso). La vidéo est stockée **localement** (`data/videos/`). L'analyse tourne en tâche de fond ; le statut passe `À traiter → Analyse… → Terminé`. En sélectionnant une vidéo : lecteur intégré, tes notes (éditables), les **métriques objectives** (graphes) et, le cas échéant, le **retour IA structuré**.

**Deux niveaux d'analyse :**
1. **Métriques objectives (toujours, 100 % local)** via `ffmpeg` + `librosa` : tempo estimé + **courbe de tempo**, **régularité des attaques** (écart-type des intervalles entre notes), **enveloppe de dynamique** (RMS, plage en dB). Détail dans [les métriques audio](#métriques-audio-locales).
2. **Feedback IA (si la bascule « local » est désactivée)** : la vidéo est envoyée à **Gemini** (File API) avec une grille de coaching ; il retourne un JSON structuré — points forts, axes de travail, exercices, position/indépendance des doigts, **tension vs relâchement**, posture, régularité/égalité, nuances/sonorité — **ancré dans les métriques** locales.

**Bascule « Vidéo 100 % locale »** (Réglages) : si active, la vidéo n'est **jamais** envoyée ; seules les métriques `librosa` sont calculées (tu peux les faire analyser via le canal MCP/Claude).

> ⚠️ Feedback indicatif, pas un substitut à un professeur.

---

## 13. Réglages

**Route :** `/reglages` · **API :** `GET/PUT /api/settings`

**À quoi ça sert :** configurer l'IA et la confidentialité.

**Comment l'utiliser :**
- **Clé Gemini** (champ masqué, en écriture seule) — clé gratuite sur [Google AI Studio](https://aistudio.google.com/app/apikey). Le statut indique « Clé configurée » sans jamais ré-afficher la clé.
- **Modèle Gemini** (défaut `gemini-2.5-flash`).
- **Vidéo 100 % locale** (interrupteur) — voir [Analyse vidéo](#12-analyse-vidéo).
- Emplacement des données (lecture seule).

Tout est persisté dans le fichier `.env` (jamais committé).

---

## 14. Serveur MCP (coaching via Claude)

**Process séparé :** `uv run pianocoach-mcp` (stdio).

**À quoi ça sert :** donner à **Claude Desktop / Claude Code** un accès direct à tes données — il te conseille en lisant tout en live, sans rien re-saisir, **sans coût API** (couvert par ton abonnement).

**Outils exposés :**

| Lecture | Écriture (Claude demande confirmation) |
|---|---|
| `get_repertoire`, `get_recent_sessions`, `get_scale_progress`, `get_tempo_progression`, `get_milestones`, `get_progress_summary` | `log_session`, `update_piece_progress`, `log_tempo` |

Le serveur lit/écrit la **même** base SQLite que l'app web : ce que tu logues d'un côté est visible de l'autre. Branchement détaillé dans le [README » Connexion MCP](../README.md#connexion-mcp-coaching-via-claude--sans-coût-api). En session Claude Code, tape `/mcp` pour voir les outils.

---

## Les calculs en détail

Tous ces calculs sont **transparents et testés** (`backend/app/services/`, suite de tests dans `backend/tests/`). Aucune fausse précision : les estimations affichent leurs hypothèses.

### Série de régularité (streak)

- **Streak actuel** = nombre de jours consécutifs avec au moins une séance, en remontant depuis aujourd'hui. **Tolérance d'un jour** : si tu n'as pas (encore) joué aujourd'hui mais que tu as joué hier, la série reste vivante.
- **Record** = la plus longue suite de jours consécutifs jamais réalisée.

### Projection « temps restant avant la cible »

Modèle simple et explicable :
1. **Heures restantes** = somme, sur tous les paliers non-appris de la voie jusqu'à la cible, de `difficulté × 9 h × (1 − avancement %)` (difficulté par défaut : 5).
2. **Rythme hebdo** = mesuré sur ~4 semaines, **lissé** avec une hypothèse prudente de 7 h/semaine, pondéré par la confiance `min(1, jours_pratiqués / 8)`. → Une seule petite séance ne fait donc pas exploser l'estimation.
3. **Semaines = heures / rythme**, avec une **fourchette** (optimiste/pessimiste) qui se resserre quand la régularité récente est bonne.
4. **Date cible** ≈ aujourd'hui + semaines. Recalculé à chaque nouvelle séance.

### Jauges de préparation (readiness)

Score 0–100 % par pièce cible = somme pondérée de 4 composantes (chaque composante a son propre sous-score 0–100, et le détail est affiché) :

| Composante | Fantaisie (Chopin) | Moonlight 3 (Beethoven) | Calcul |
|---|---|---|---|
| Gammes & arpèges | 20 % | 30 % | 60 % maîtrise + 40 % progression de tempo moyenne |
| Lecture (clé de fa) | 20 % | 15 % | 70 % jalons lecture faits + 30 % minutes de lecture loguées (plafond ~10 h) |
| Polyrythmie | 30 % (4 c. 3) | 10 % (2 c. 3) | jalons de polyrythmie pertinents faits |
| Paliers du répertoire | 30 % | 45 % | avancement moyen des paliers précédents (appris = 100 %) |

### Métriques audio locales

Calculées avec `librosa` sur l'audio extrait par `ffmpeg` (mono, 22050 Hz) :
- **Tempo** : tempo global + courbe de tempo dans le temps ; un **score de stabilité** = `100 × exp(−3 × CV)` où CV est le coefficient de variation de la courbe (0 = parfaitement stable → 100).
- **Régularité des attaques** : détection des onsets → intervalles entre notes → même formule de score (notes bien régulières → score élevé).
- **Dynamique** : enveloppe RMS → niveaux en dB → **plage dynamique** (max − min).
- Les courbes sont sous-échantillonnées (≤ 200 points) pour des graphes légers. La logique de scoring est en stdlib pur (testée sans audio).

---

## Données & confidentialité

- **Locale-first** : tout vit dans `./data/` — base SQLite `pianocoach.db` (mode WAL), vidéos dans `data/videos/`, artefacts d'analyse dans `data/analysis/`. Ce dossier est **gitignoré** et ne quitte jamais ta machine.
- **Aucun secret committé** : `.env` (dont la clé Gemini), `data/`, `node_modules`, l'environnement Python sont exclus.
- **Sorties externes**, uniquement si tu les actives :
  - *Chat coach* → envoie à Gemini ton profil + un résumé **texte** de tes données (quand une clé est configurée).
  - *Analyse vidéo IA* → envoie la **vidéo** à Gemini, **sauf** si « Vidéo 100 % locale » est activé.
- Le **serveur MCP** reste local (Claude lit la base sur ta machine).

### Modèle de données (résumé)

`pieces` · `practice_sessions` · `scales` (+ `scale_bpm_log`) · `tempo_log` · `reading_log` · `milestones` · `videos` (chemin local + métriques + feedback) · `chat_messages`.

---

## Trois façons de lancer l'app

| Mode | Commande | Pour |
|---|---|---|
| **Web (dev)** | `./scripts/dev.sh` → http://localhost:5173 | développer, hot-reload |
| **Desktop (fenêtre native)** | `./scripts/desktop.sh` ou l'icône **PianoCoach.app** | usage quotidien, comme une vraie app |
| **Coaching Claude** | `uv run pianocoach-mcp` branché à Claude | demander conseil sur tes données |

Les trois partagent la même base locale. Détails d'installation et de packaging dans le [README](../README.md).
