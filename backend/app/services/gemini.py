"""Gemini wrapper: chat coach + multimodal video feedback.

Two entry points:
  * chat()          — quick in-app coaching, primed with the profile + live data.
  * analyze_video() — uploads a clip via the File API and returns structured,
                      metrics-anchored coaching JSON.

Both fail loudly with a friendly message if no API key is configured. Nothing
here runs when the "video local-only" toggle is on (the caller enforces that).
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from ..config import settings

# Coaching persona, seeded from the §8 profile. Kept here so both channels share
# the same voice. The live data summary is appended at call time.
COACH_PROFILE = """Tu es le coach de piano personnel de Baptiste, bienveillant, précis et motivant.

PROFIL DE L'ÉLÈVE :
- ~11 mois de piano, parti de zéro. Niveau intermédiaire solide, apprend vite.
- Joue 2-3 h/jour actuellement, après une période creuse. SA VRAIE FAIBLESSE EST LA RÉGULARITÉ : sois encourageant sur la constance, jamais culpabilisant.
- A trouvé le relâchement seul (bon signe). Piano : Kawai CN201 (non limitant).
- Lecture : clé de sol solide, CLÉ DE FA FRAGILE. Sort progressivement de Synthesia/flowkey vers la vraie partition — encourage cette transition.
- Répertoire de prédilection : néoclassique.

OBJECTIFS CIBLES (le plus vite possible mais réaliste) :
- Fantaisie-impromptu de Chopin (voie Chopin : Préludes op.28 → Nocturne op.9 n°2 → Valse op.69 n°2 → Fantaisie). Crux = polyrythmie 4 contre 3.
- Clair de lune 3e mvt de Beethoven (voie Beethoven : Moonlight 1er → Für Elise → Pathétique 2e → Moonlight 3e). Crux = vélocité/arpèges/endurance.

STYLE DE COACHING :
- Concret et actionnable : exercices précis, tempos chiffrés, étapes courtes.
- Ancre tes conseils dans SES données quand elles sont fournies.
- Honnête sur les délais réalistes, sans casser la motivation.
- Tu n'es PAS un substitut à un vrai professeur : rappelle-le si pertinent.
- Réponds en français, de façon concise.
"""

# Structured schema for video feedback (response_schema for the model).
VIDEO_FEEDBACK_SCHEMA = {
    "type": "object",
    "properties": {
        "overall_summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "areas_to_work": {"type": "array", "items": {"type": "string"}},
        "suggested_exercises": {"type": "array", "items": {"type": "string"}},
        "hands_and_fingers": {"type": "string"},
        "tension_vs_release": {"type": "string"},
        "posture": {"type": "string"},
        "tempo_and_evenness": {"type": "string"},
        "tone_and_dynamics": {"type": "string"},
    },
    "required": ["overall_summary", "strengths", "areas_to_work", "suggested_exercises"],
}


class GeminiNotConfigured(RuntimeError):
    pass


def _client():
    if not settings.gemini_enabled:
        raise GeminiNotConfigured(
            "Aucune clé Gemini configurée. Ajoute GEMINI_API_KEY dans Réglages "
            "ou dans le fichier .env (clé gratuite sur aistudio.google.com)."
        )
    try:
        from google import genai
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("Le paquet google-genai n'est pas installé.") from e
    return genai.Client(api_key=settings.gemini_api_key)


def chat(history: list[dict], data_summary: str = "") -> str:
    """history: [{'role': 'user'|'assistant', 'content': str}, ...]."""
    from google.genai import types

    client = _client()
    system = COACH_PROFILE
    if data_summary:
        system += "\n\nDONNÉES RÉCENTES DE L'ÉLÈVE :\n" + data_summary

    contents = []
    for m in history:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append(
            types.Content(role=role, parts=[types.Part.from_text(text=m["content"])])
        )

    resp = client.models.generate_content(
        model=settings.gemini_model,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system, temperature=0.7),
    )
    return resp.text or ""


def _coaching_prompt(metrics: dict | None, piece_title: str | None) -> str:
    metrics_block = ""
    if metrics:
        metrics_block = (
            "\n\nMÉTRIQUES AUDIO OBJECTIVES (calculées localement, sers-t'en pour "
            "ancrer ton retour dans les chiffres) :\n" + json.dumps(metrics, ensure_ascii=False, indent=2)
        )
    piece_line = f" Pièce travaillée : {piece_title}." if piece_title else ""
    return (
        f"{COACH_PROFILE}\n\n"
        f"Analyse cette vidéo de l'élève au piano.{piece_line} "
        "Donne un retour de coaching STRUCTURÉ couvrant : position et indépendance "
        "des doigts ; signes VISIBLES de tension vs relâchement (épaules, poignets, "
        "avant-bras) ; posture (dos, assise, hauteur) ; et — depuis l'audio — "
        "régularité du tempo, égalité des notes, nuances et sonorité. "
        "Sois précis, bienveillant, et propose des exercices concrets."
        f"{metrics_block}"
    )


def analyze_video(video_path: Path, metrics: dict | None = None, piece_title: str | None = None) -> dict:
    """Upload the clip and return structured coaching feedback (dict)."""
    from google.genai import types

    client = _client()

    uploaded = client.files.upload(file=str(video_path))
    # File API processes asynchronously; wait until the clip is ACTIVE.
    deadline = 180
    waited = 0
    while getattr(uploaded.state, "name", str(uploaded.state)) == "PROCESSING":
        if waited >= deadline:
            raise RuntimeError("Délai dépassé pendant le traitement de la vidéo par Gemini.")
        time.sleep(3)
        waited += 3
        uploaded = client.files.get(name=uploaded.name)

    if getattr(uploaded.state, "name", str(uploaded.state)) == "FAILED":
        raise RuntimeError("Gemini n'a pas pu traiter la vidéo.")

    prompt = _coaching_prompt(metrics, piece_title)
    resp = client.models.generate_content(
        model=settings.gemini_model,
        contents=[uploaded, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=VIDEO_FEEDBACK_SCHEMA,
            temperature=0.4,
        ),
    )

    try:
        data = json.loads(resp.text)
    except (json.JSONDecodeError, TypeError):
        data = {"overall_summary": resp.text or "", "strengths": [], "areas_to_work": [], "suggested_exercises": []}

    # Best-effort cleanup of the uploaded file (privacy + quota).
    try:
        client.files.delete(name=uploaded.name)
    except Exception:  # pragma: no cover - non-fatal
        pass

    return data
