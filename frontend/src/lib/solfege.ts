// Pure logic for the solfège (note-reading) trainer: staff placement, the
// spaced-repetition scheduler, level ranges, and answer checking. All pure and
// unit-tested — the UI (Staff.tsx / Solfege.tsx) is a thin layer on top.
//
// Single NATURAL notes only for now (no accidentals): the reliable core. Reading
// is position-specific, so an answer must match the exact pitch (octave included).

import { octave, pitchClass } from "./midi";

export type Clef = "treble" | "bass";

// Natural pitch classes → diatonic step within an octave (C=0 … B=6).
const PC_TO_STEP: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

export function isNatural(midi: number): boolean {
  return PC_TO_STEP[pitchClass(midi)] !== undefined;
}

/** Diatonic index = white-note steps from C-1. Do4 (MIDI 60) → 28. */
export function diatonicIndex(midi: number): number {
  const step = PC_TO_STEP[pitchClass(midi)];
  if (step === undefined) throw new Error(`diatonicIndex: ${midi} is not a natural note`);
  return octave(midi) * 7 + step;
}

// Diatonic index of each clef's MIDDLE (3rd) staff line.
//   treble middle line = Si4 (B4, MIDI 71); bass middle line = Ré3 (D3, MIDI 50).
const CLEF_MIDDLE_DIATONIC: Record<Clef, number> = {
  treble: diatonicIndex(71),
  bass: diatonicIndex(50),
};

/**
 * Position of a note relative to the middle staff line, in HALF-line-gaps.
 * Positive = below the middle line (lower pitch); each staff line is 2 units apart,
 * so the 5 lines sit at {-4,-2,0,2,4}. Middle C → +6 (treble) / -6 (bass).
 */
export function staffStepsFromMiddle(midi: number, clef: Clef): number {
  return CLEF_MIDDLE_DIATONIC[clef] - diatonicIndex(midi);
}

/** Ledger-line positions (in half-gaps) needed for a note at `steps`. */
export function ledgerSteps(steps: number): number[] {
  const out: number[] = [];
  for (let s = 6; s <= steps; s += 2) out.push(s); // below the staff
  for (let s = -6; s >= steps; s -= 2) out.push(s); // above the staff
  return out;
}

/**
 * Natural notes available at a given level for a clef. Level 1 = notes on the
 * staff (±4 half-gaps: 5 lines + 4 spaces); each further level adds one ledger
 * position above and below (widening tessitura).
 */
export function notePool(clef: Clef, level: number): number[] {
  const maxSteps = 4 + Math.max(0, level - 1) * 2;
  const mid = CLEF_MIDDLE_DIATONIC[clef];
  const notes: number[] = [];
  for (let midi = 21; midi <= 108; midi++) {
    if (!isNatural(midi)) continue;
    if (Math.abs(mid - diatonicIndex(midi)) <= maxSteps) notes.push(midi);
  }
  return notes;
}

// --- Spaced repetition -----------------------------------------------------
export interface NoteStat {
  seen: number;
  wrong: number;
}
export type StatMap = Record<string, NoteStat>;
export interface Candidate {
  midi: number;
  clef: Clef;
}

export function statKey(clef: Clef, midi: number): string {
  return `${clef}:${midi}`;
}

/**
 * Selection weight: unseen notes and error-prone notes are favoured, and the
 * bass clef is biased up (the known weak spot). Higher = more likely.
 */
export function scoreCandidate(stat: NoteStat | undefined, clef: Clef, bassBias = 1.6): number {
  const seen = stat?.seen ?? 0;
  const wrong = stat?.wrong ?? 0;
  const novelty = seen === 0 ? 2 : 1;
  const errorBoost = seen > 0 ? 1 + 2 * (wrong / seen) : 1;
  const clefWeight = clef === "bass" ? bassBias : 1;
  return novelty * errorBoost * clefWeight;
}

export function chooseNext(
  candidates: Candidate[],
  stats: StatMap,
  opts: { bassBias?: number; rng?: () => number } = {}
): Candidate {
  const rng = opts.rng ?? Math.random;
  const weights = candidates.map((c) => scoreCandidate(stats[statKey(c.clef, c.midi)], c.clef, opts.bassBias));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** A read is correct only if the exact written pitch (octave included) is played. */
export function isCorrect(targetMidi: number, playedMidi: number): boolean {
  return playedMidi === targetMidi;
}

export function accuracyPct(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}
