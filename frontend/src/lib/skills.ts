// Skill taxonomy + per-piece progression roll-up. Deliberately simple: skills
// are a fixed set, each piece is tagged with the skills it develops, and a
// skill's progress is just the average progress of the pieces that develop it
// (learned = 100%). No points, no skill graph — a readable snapshot that rises
// as pieces advance, plus recent practice minutes as the "over time" signal.

import type { Piece, PracticeSession } from "../types";

export interface Skill {
  id: string;
  label: string;
  hint: string;
}

export const SKILLS: Skill[] = [
  { id: "reading_bass", label: "Lecture clé de fa", hint: "Déchiffrage main gauche — ta priorité." },
  { id: "reading_treble", label: "Lecture clé de sol", hint: "Déchiffrage main droite." },
  { id: "velocity", label: "Vélocité", hint: "Agilité et rapidité des doigts." },
  { id: "polyrhythm_4v3", label: "4 contre 3", hint: "Indépendance polyrythmique (Fantaisie-impromptu)." },
  { id: "endurance", label: "Endurance", hint: "Tenir la durée sans se crisper." },
  { id: "voicing", label: "Voicing", hint: "Équilibre et chant des voix." },
  { id: "pedaling", label: "Pédalage", hint: "Pédale propre et musicale." },
  { id: "classical_clarity", label: "Clarté classique", hint: "Articulation nette, style classique." },
];

export const SKILL_LABEL: Record<string, string> = Object.fromEntries(SKILLS.map((s) => [s.id, s.label]));

// focus_area → skills, to attribute practice sessions that don't name pieces.
const FOCUS_SKILLS: Record<string, string[]> = {
  reading: ["reading_bass", "reading_treble"],
  polyrhythm: ["polyrhythm_4v3"],
  scales: ["velocity"],
  arpeggios: ["velocity"],
  etudes: ["velocity", "classical_clarity"],
  piece: [],
  fun: [],
};

export interface SkillProgress {
  id: string;
  label: string;
  hint: string;
  progress: number; // 0-100, avg of developing pieces (learned = 100)
  pieces: { title: string; progress: number; status: string }[];
}

export function skillProgress(pieces: Piece[]): SkillProgress[] {
  return SKILLS.map((sk) => {
    const developing = pieces.filter((p) => (p.skills ?? []).includes(sk.id) && p.status !== "planned");
    const contrib = developing.map((p) => ({
      title: p.title,
      progress: p.status === "learned" ? 100 : p.progress_pct,
      status: p.status,
    }));
    const progress = contrib.length
      ? Math.round(contrib.reduce((a, c) => a + c.progress, 0) / contrib.length)
      : 0;
    return { id: sk.id, label: sk.label, hint: sk.hint, progress, pieces: contrib };
  });
}

/** Practice minutes in the last `days` attributed to each skill (engagement over time). */
export function skillActivityMinutes(
  sessions: PracticeSession[],
  pieces: Piece[],
  days = 30,
  now = Date.now()
): Record<string, number> {
  const cutoff = now - days * 86_400_000;
  const skillsByTitle = new Map(pieces.map((p) => [p.title, p.skills ?? []]));
  const out: Record<string, number> = Object.fromEntries(SKILLS.map((s) => [s.id, 0]));
  for (const s of sessions) {
    if (new Date(s.date).getTime() < cutoff) continue;
    const touched = new Set<string>();
    for (const f of s.focus_areas) (FOCUS_SKILLS[f] ?? []).forEach((id) => touched.add(id));
    for (const t of s.pieces_worked) (skillsByTitle.get(t) ?? []).forEach((id) => touched.add(id));
    touched.forEach((id) => {
      out[id] += s.duration_min || 0;
    });
  }
  return out;
}
