import type { FocusArea, Horizon, PieceStatus, Track } from "../types";

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
