"""Objective local audio metrics (always computed, never leaves the machine).

Pipeline: ffmpeg extracts a mono wav from the uploaded video, then librosa
computes tempo + a tempo-over-time curve, an RMS dynamics envelope, and onset
times. The *interpretation* of those raw arrays (regularity, stability,
dynamic range, 0-100 scores) lives in small stdlib-only pure functions below
so the scoring logic is fully unit-testable without audio or librosa.
"""

from __future__ import annotations

import math
import shutil
import statistics
import subprocess
from pathlib import Path


# --------------------------------------------------------------------------- #
# Pure, testable metric interpreters (stdlib only)
# --------------------------------------------------------------------------- #
def coefficient_of_variation(values: list[float]) -> float:
    """std / mean. 0 = perfectly even. Returns 0 for <2 points or zero mean."""
    vals = [v for v in values if v is not None]
    if len(vals) < 2:
        return 0.0
    mean = statistics.fmean(vals)
    if mean == 0:
        return 0.0
    return statistics.pstdev(vals) / abs(mean)


def _cv_to_score(cv: float) -> float:
    """Map a coefficient of variation to a 0-100 score (lower cv → higher)."""
    return round(max(0.0, min(100.0, 100.0 * math.exp(-3.0 * cv))), 1)


def compute_onset_regularity(onset_times: list[float]) -> dict:
    """From note-onset timestamps (seconds), measure rhythmic evenness."""
    if len(onset_times) < 3:
        return {
            "onset_count": len(onset_times),
            "mean_interval_s": None,
            "interval_cv": None,
            "regularity_score": None,
        }
    intervals = [b - a for a, b in zip(onset_times, onset_times[1:], strict=False) if b > a]
    cv = coefficient_of_variation(intervals)
    return {
        "onset_count": len(onset_times),
        "mean_interval_s": round(statistics.fmean(intervals), 4),
        "interval_cv": round(cv, 4),
        "regularity_score": _cv_to_score(cv),
    }


def summarize_tempo_curve(bpms: list[float]) -> dict:
    """From a tempo-over-time curve, measure how steady the tempo is."""
    clean = [b for b in bpms if b and b > 0]
    if not clean:
        return {"mean_bpm": None, "bpm_cv": None, "stability_score": None}
    cv = coefficient_of_variation(clean)
    return {
        "mean_bpm": round(statistics.fmean(clean), 1),
        "min_bpm": round(min(clean), 1),
        "max_bpm": round(max(clean), 1),
        "bpm_cv": round(cv, 4),
        "stability_score": _cv_to_score(cv),
    }


def summarize_dynamics(rms: list[float]) -> dict:
    """From an RMS envelope, derive loudness range in dB."""
    vals = [v for v in rms if v and v > 0]
    if not vals:
        return {"mean_db": None, "dynamic_range_db": None}
    db = [20.0 * math.log10(v) for v in vals]
    return {
        "mean_db": round(statistics.fmean(db), 1),
        "min_db": round(min(db), 1),
        "max_db": round(max(db), 1),
        "dynamic_range_db": round(max(db) - min(db), 1),
    }


def _downsample(seq: list[float], max_points: int = 200) -> list[float]:
    """Reduce a long series to <= max_points for compact plotting/JSON."""
    n = len(seq)
    if n <= max_points:
        return [round(float(x), 5) for x in seq]
    step = n / max_points
    return [round(float(seq[int(i * step)]), 5) for i in range(max_points)]


# --------------------------------------------------------------------------- #
# ffmpeg + librosa orchestration (the heavy part)
# --------------------------------------------------------------------------- #
def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def extract_audio(video_path: Path, out_wav: Path, sr: int = 22050) -> Path:
    """Extract mono wav audio from a video with ffmpeg."""
    if not ffmpeg_available():
        raise RuntimeError("ffmpeg introuvable — installe-le (brew install ffmpeg).")
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-ac", "1", "-ar", str(sr), "-vn", str(out_wav),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Échec extraction audio ffmpeg: {proc.stderr[-500:]}")
    return out_wav


def analyze_audio(wav_path: Path) -> dict:
    """Compute objective metrics from a wav file using librosa.

    Returns a JSON-serialisable dict: scalar summaries + downsampled curves for
    plotting. librosa is imported lazily so this module stays cheap to import.
    """
    import librosa  # lazy: heavy import, not needed for the pure helpers
    import numpy as np

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))

    # Global + dynamic tempo (librosa 0.11: librosa.feature.tempo)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo = float(np.atleast_1d(librosa.feature.tempo(onset_envelope=onset_env, sr=sr))[0])
    dyn_tempo = librosa.feature.tempo(onset_envelope=onset_env, sr=sr, aggregate=None)
    tempo_times = librosa.times_like(dyn_tempo, sr=sr).tolist()
    dyn_tempo_list = [float(x) for x in np.atleast_1d(dyn_tempo)]

    # Onsets (note attacks) for rhythmic regularity
    onset_times = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, units="time"
    ).tolist()

    # RMS dynamics envelope
    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.times_like(rms, sr=sr).tolist()
    rms_list = [float(x) for x in rms]

    return {
        "duration_s": round(duration, 2),
        "tempo_bpm_global": round(tempo, 1),
        "tempo": {
            **summarize_tempo_curve(dyn_tempo_list),
            "times": _downsample(tempo_times),
            "bpm": _downsample(dyn_tempo_list),
        },
        "onsets": compute_onset_regularity(onset_times),
        "dynamics": {
            **summarize_dynamics(rms_list),
            "times": _downsample(rms_times),
            "rms": _downsample(rms_list),
        },
    }
