import { describe, expect, it } from "vitest";
import {
  accuracyPct,
  chooseNext,
  diatonicIndex,
  isCorrect,
  isNatural,
  ledgerSteps,
  notePool,
  scoreCandidate,
  staffStepsFromMiddle,
  statKey,
} from "./solfege";

describe("solfège staff placement", () => {
  it("diatonic index of key naturals", () => {
    expect(diatonicIndex(60)).toBe(28); // Do4
    expect(diatonicIndex(71)).toBe(34); // Si4 (treble middle line)
    expect(diatonicIndex(50)).toBe(22); // Ré3 (bass middle line)
  });

  it("middle C sits one ledger line off each staff (+6 treble / -6 bass)", () => {
    expect(staffStepsFromMiddle(60, "treble")).toBe(6);
    expect(staffStepsFromMiddle(60, "bass")).toBe(-6);
    expect(ledgerSteps(6)).toEqual([6]);
    expect(ledgerSteps(-6)).toEqual([-6]);
  });

  it("staff-line notes land on lines (±4) with no ledgers", () => {
    expect(staffStepsFromMiddle(64, "treble")).toBe(4); // Mi4 = bottom line
    expect(staffStepsFromMiddle(77, "treble")).toBe(-4); // Fa5 = top line
    expect(ledgerSteps(4)).toEqual([]);
    expect(ledgerSteps(-4)).toEqual([]);
  });

  it("ledgerSteps stacks multiple lines outward", () => {
    expect(ledgerSteps(8)).toEqual([6, 8]);
    expect(ledgerSteps(-8)).toEqual([-6, -8]);
    expect(ledgerSteps(0)).toEqual([]);
  });

  it("isNatural rejects black keys", () => {
    expect(isNatural(60)).toBe(true); // Do
    expect(isNatural(61)).toBe(false); // Do♯
  });
});

describe("solfège level ranges", () => {
  it("level 1 = 9 on-staff notes; middle C only appears from level 2 (treble)", () => {
    const l1 = notePool("treble", 1);
    expect(l1.length).toBe(9); // 5 lines + 4 spaces
    expect(l1).not.toContain(60); // middle C is a ledger note
    expect(l1).toContain(64); // Mi4
    expect(l1).toContain(77); // Fa5
    expect(notePool("treble", 2)).toContain(60);
  });

  it("higher levels widen the range", () => {
    expect(notePool("bass", 3).length).toBeGreaterThan(notePool("bass", 1).length);
  });
});

describe("solfège spaced repetition", () => {
  it("favours unseen, then error-prone, then bass", () => {
    const unseen = scoreCandidate(undefined, "treble");
    const mastered = scoreCandidate({ seen: 10, wrong: 0 }, "treble");
    const errorProne = scoreCandidate({ seen: 10, wrong: 5 }, "treble");
    expect(unseen).toBeGreaterThan(mastered);
    expect(errorProne).toBeGreaterThan(mastered);
    // bass biased above treble, all else equal
    expect(scoreCandidate({ seen: 4, wrong: 1 }, "bass")).toBeGreaterThan(
      scoreCandidate({ seen: 4, wrong: 1 }, "treble")
    );
  });

  it("chooseNext is deterministic with a fixed rng and honours weights", () => {
    const cands = [
      { midi: 64, clef: "treble" as const },
      { midi: 65, clef: "treble" as const },
    ];
    // rng=0 → picks the first candidate
    expect(chooseNext(cands, {}, { rng: () => 0 }).midi).toBe(64);
    // Make the first candidate "mastered" so the (unseen) second dominates the weight.
    const stats = { [statKey("treble", 64)]: { seen: 20, wrong: 0 } };
    // rng≈1 → lands in the last (heaviest) bucket
    expect(chooseNext(cands, stats, { rng: () => 0.999 }).midi).toBe(65);
  });
});

describe("solfège answer checking", () => {
  it("requires the exact written pitch (octave included)", () => {
    expect(isCorrect(60, 60)).toBe(true);
    expect(isCorrect(60, 72)).toBe(false); // same note class, wrong octave
    expect(isCorrect(60, 61)).toBe(false);
  });

  it("accuracy percentage", () => {
    expect(accuracyPct(3, 4)).toBe(75);
    expect(accuracyPct(0, 0)).toBe(0);
  });
});
