import type { FocusArea, Horizon, PieceStatus, Track } from "../types";

// --- Solfège (French note names) --------------------------------------------
// Canonical keys are stored in English (C, F#, Bb) internally; the UI shows
// French syllables everywhere. noteFr(canonical) → "Do"/"Fa♯"; noteToCanonical
// parses French OR English input back to the canonical form for storage.
const _LETTER_TO_FR: Record<string, string> = {
  C: "Do",
  D: "Ré",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Si",
};
const _FR_TO_LETTER: Record<string, string> = {
  do: "C",
  ré: "D",
  re: "D",
  mi: "E",
  fa: "F",
  sol: "G",
  la: "A",
  si: "B",
};

export function noteFr(key: string): string {
  if (!key) return key;
  const m = key.trim().match(/^([A-Ga-g])\s*([#♯b♭]?)/);
  if (!m) return key;
  const acc = m[2] === "#" || m[2] === "♯" ? "♯" : m[2] === "b" || m[2] === "♭" ? "♭" : "";
  return (_LETTER_TO_FR[m[1].toUpperCase()] ?? m[1].toUpperCase()) + acc;
}

export function noteToCanonical(input: string): string {
  const s = input.trim();
  if (!s) return s;
  const fr = s.match(/^(do|ré|re|mi|fa|sol|la|si)\s*([#♯b♭]?)/i);
  if (fr) {
    const letter = _FR_TO_LETTER[fr[1].toLowerCase()];
    if (letter) return letter + (fr[2] === "♯" ? "#" : fr[2] === "♭" ? "b" : fr[2] || "");
  }
  const en = s.match(/^([A-Ga-g])\s*([#♯b♭]?)/);
  if (en) return en[1].toUpperCase() + (en[2] === "♯" ? "#" : en[2] === "♭" ? "b" : en[2] || "");
  return s;
}

export const TRACKS: Record<Track, { label: string; short: string; color: string }> = {
  chopin: { label: "Voie Chopin", short: "Chopin", color: "var(--color-chopin)" },
  beethoven: { label: "Voie Beethoven", short: "Beethoven", color: "var(--color-beethoven)" },
  common: { label: "Socle commun", short: "Socle", color: "var(--color-common)" },
  neoclassical: { label: "Néoclassique", short: "Néoclassique", color: "var(--color-neoclassical)" },
};

export const STATUS: Record<PieceStatus, { label: string; color: string }> = {
  target: { label: "Cible", color: "var(--color-accent)" },
  planned: { label: "À venir", color: "var(--color-faint)" },
  in_progress: { label: "En cours", color: "var(--color-primary)" },
  learned: { label: "Apprise", color: "var(--color-good)" },
};

export const FOCUS_LABELS: Record<FocusArea, string> = {
  scales: "Gammes",
  arpeggios: "Arpèges",
  etudes: "Études",
  reading: "Lecture",
  polyrhythm: "Polyrythmie",
  piece: "Pièce",
  fun: "Plaisir",
};

export const FOCUS_ORDER: FocusArea[] = [
  "scales",
  "arpeggios",
  "etudes",
  "reading",
  "polyrhythm",
  "piece",
  "fun",
];

export const HORIZONS: Horizon[] = ["3m", "6m", "12m", "24m"];
export const HORIZON_LABELS: Record<Horizon, string> = {
  "3m": "3 mois",
  "6m": "6 mois",
  "12m": "12 mois",
  "24m": "24 mois",
};

export const CLEF_LABELS = { treble: "Clé de sol", bass: "Clé de fa", both: "Deux clés" } as const;

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m.toString().padStart(2, "0")}` : `${h} h`;
}

export function frenchDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const CHART_COLORS = [
  "#818cf8",
  "#f5b955",
  "#6ee7b7",
  "#f0a6c8",
  "#7dd3fc",
  "#c4b5fd",
  "#fbbf24",
];
