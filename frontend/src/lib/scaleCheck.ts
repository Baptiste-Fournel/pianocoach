// Pure logic for MIDI scale verification: build the expected scale, check the
// played notes, and measure evenness. A run is "propre" (clean) only if the
// notes are exact AND the rhythm is even (coefficient of variation of the
// inter-attack intervals ≤ a displayed threshold). Everything here is pure and
// unit-tested; the UI (ScaleVerify.tsx) just captures MIDI and shows the result.

import { pitchClass } from "./midi";

export type ScaleKind = "major" | "minor_harmonic" | "minor_melodic";

// Semitone steps of one ascending octave (degrees 1..7), root implied at 0.
const INTERVALS: Record<ScaleKind, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor_harmonic: [0, 2, 3, 5, 7, 8, 11],
  minor_melodic: [0, 2, 3, 5, 7, 9, 11], // ascending form
};

export const DEFAULT_EVENNESS_THRESHOLD = 0.18; // CV ceiling for "even"

/** Expected ascending scale over `octaves`, ending on the top root. */
export function expectedScale(root: number, kind: ScaleKind, octaves = 1): number[] {
  const base = INTERVALS[kind];
  const notes: number[] = [];
  for (let o = 0; o < octaves; o++) for (const iv of base) notes.push(root + iv + 12 * o);
  notes.push(root + 12 * octaves);
  return notes;
}

export function interOnsetIntervals(times: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < times.length; i++) out.push(times[i] - times[i - 1]);
  return out;
}

/** std / mean. 0 = perfectly even. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

export interface ScaleCheck {
  notesCorrect: boolean;
  expectedCount: number;
  playedCount: number;
  wrongAt: number | null;
  cv: number;
  cvPct: number;
  even: boolean;
  meanIntervalMs: number | null;
  attackRatePerMin: number | null;
  clean: boolean;
  reason: string; // transparent explanation of the verdict
}

/**
 * Notes are matched by starting pitch class + relative shape, so the scale can
 * be played in any octave. Times (ms) drive the evenness measure.
 */
export function checkScale(
  playedNotes: number[],
  playedTimes: number[],
  expected: number[],
  opts: { evennessThreshold?: number } = {}
): ScaleCheck {
  const threshold = opts.evennessThreshold ?? DEFAULT_EVENNESS_THRESHOLD;
  const expectedCount = expected.length;
  const playedCount = playedNotes.length;

  let wrongAt: number | null = null;
  if (playedCount === 0) {
    wrongAt = 0;
  } else if (pitchClass(playedNotes[0]) !== pitchClass(expected[0])) {
    wrongAt = 0;
  } else {
    const n = Math.min(playedCount, expectedCount);
    for (let i = 0; i < n; i++) {
      if (playedNotes[i] - playedNotes[0] !== expected[i] - expected[0]) {
        wrongAt = i;
        break;
      }
    }
  }
  const notesCorrect = wrongAt === null && playedCount === expectedCount;

  const intervals = interOnsetIntervals(playedTimes);
  const cv = coefficientOfVariation(intervals);
  const mean = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;
  const rate = mean && mean > 0 ? 60000 / mean : null;
  const even = intervals.length >= 2 && cv <= threshold;
  const clean = notesCorrect && even;

  const thrPct = Math.round(threshold * 100);
  let reason: string;
  if (!notesCorrect) {
    reason =
      playedCount !== expectedCount
        ? `Séquence incomplète (${playedCount}/${expectedCount} notes).`
        : `Note ${(wrongAt ?? 0) + 1} incorrecte — vérifie les altérations.`;
  } else if (!even) {
    reason = `Notes exactes, mais jeu irrégulier : CV ${Math.round(cv * 100)}% > ${thrPct}%.`;
  } else {
    reason = `Propre : notes exactes + régularité CV ${Math.round(cv * 100)}% ≤ ${thrPct}%.`;
  }

  return {
    notesCorrect,
    expectedCount,
    playedCount,
    wrongAt,
    cv,
    cvPct: Math.round(cv * 100),
    even,
    meanIntervalMs: mean,
    attackRatePerMin: rate,
    clean,
    reason,
  };
}

/** Metronome BPM from the attack rate, given how many notes are played per beat. */
export function suggestedBpm(attackRatePerMin: number, notesPerBeat: number): number {
  return Math.round(attackRatePerMin / notesPerBeat);
}
