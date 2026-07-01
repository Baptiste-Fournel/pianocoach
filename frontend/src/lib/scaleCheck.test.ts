import { describe, expect, it } from "vitest";
import {
  checkScale,
  coefficientOfVariation,
  expectedScale,
  interOnsetIntervals,
  suggestedBpm,
} from "./scaleCheck";

// Evenly-spaced timestamps for n notes at `step` ms apart.
const evenTimes = (n: number, step = 100) => Array.from({ length: n }, (_, i) => i * step);

describe("expectedScale", () => {
  it("Do major, 1 octave, ends on the top root", () => {
    expect(expectedScale(60, "major", 1)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });
  it("2 octaves has 15 notes (7×2 + top root)", () => {
    expect(expectedScale(60, "major", 2).length).toBe(15);
  });
  it("harmonic minor raises the 7th", () => {
    expect(expectedScale(57, "minor_harmonic", 1)).toEqual([57, 59, 60, 62, 64, 65, 68, 69]);
  });
});

describe("evenness", () => {
  it("coefficient of variation is 0 for even intervals", () => {
    expect(coefficientOfVariation([100, 100, 100])).toBe(0);
    expect(coefficientOfVariation(interOnsetIntervals(evenTimes(8)))).toBe(0);
  });
  it("grows with irregularity", () => {
    expect(coefficientOfVariation([100, 200, 50, 180])).toBeGreaterThan(0.3);
  });
});

describe("checkScale", () => {
  const expected = expectedScale(60, "major", 1);

  it("clean when notes exact and rhythm even", () => {
    const r = checkScale(expected, evenTimes(expected.length), expected);
    expect(r.notesCorrect).toBe(true);
    expect(r.even).toBe(true);
    expect(r.clean).toBe(true);
    expect(r.reason).toContain("Propre");
  });

  it("octave-independent (same shape one octave up is still clean)", () => {
    const up = expected.map((n) => n + 12);
    const r = checkScale(up, evenTimes(up.length), expected);
    expect(r.clean).toBe(true);
  });

  it("wrong note → not clean, reports position, nothing loggable", () => {
    const bad = [...expected];
    bad[3] = bad[3] + 1; // sharp the 4th degree
    const r = checkScale(bad, evenTimes(bad.length), expected);
    expect(r.notesCorrect).toBe(false);
    expect(r.wrongAt).toBe(3);
    expect(r.clean).toBe(false);
  });

  it("exact notes but irregular timing → not clean (evenness gate)", () => {
    const times = [0, 100, 400, 500, 600, 1100, 1200, 1300]; // very uneven
    const r = checkScale(expected, times, expected);
    expect(r.notesCorrect).toBe(true);
    expect(r.even).toBe(false);
    expect(r.clean).toBe(false);
    expect(r.reason).toContain("irrégulier");
  });

  it("incomplete sequence is not clean", () => {
    const r = checkScale(expected.slice(0, 5), evenTimes(5), expected);
    expect(r.notesCorrect).toBe(false);
    expect(r.reason).toContain("incomplète");
  });

  it("attack rate reflects the tempo; suggestedBpm divides by notes-per-beat", () => {
    // 8 notes 125ms apart → 480 attacks/min → at 4 notes/beat → 120 BPM
    const r = checkScale(expected, evenTimes(expected.length, 125), expected);
    expect(Math.round(r.attackRatePerMin!)).toBe(480);
    expect(suggestedBpm(r.attackRatePerMin!, 4)).toBe(120);
  });
});
