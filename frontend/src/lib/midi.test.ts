import { describe, expect, it } from "vitest";
import {
  COMPACT_KEYBOARD,
  FULL_KEYBOARD,
  blackLeftPct,
  displayRange,
  isBlackKey,
  keyboardLayout,
  noteName,
  noteNameShort,
  octave,
  pitchClass,
  whiteLeftPct,
} from "./midi";

describe("midi note helpers", () => {
  it("names middle C and A440 in French", () => {
    expect(noteName(60)).toBe("Do4"); // middle C
    expect(noteName(69)).toBe("La4"); // A440
  });

  it("handles sharps", () => {
    expect(noteName(61)).toBe("Do♯4");
    expect(noteNameShort(66)).toBe("Fa♯");
  });

  it("wraps octaves correctly", () => {
    expect(noteName(48)).toBe("Do3");
    expect(noteName(72)).toBe("Do5");
    expect(octave(60)).toBe(4);
  });

  it("classifies black vs white keys", () => {
    expect(isBlackKey(60)).toBe(false); // Do
    expect(isBlackKey(61)).toBe(true); // Do♯
    expect(isBlackKey(66)).toBe(true); // Fa♯
    expect(isBlackKey(65)).toBe(false); // Fa
  });

  it("pitchClass is 0..11 regardless of octave", () => {
    expect(pitchClass(60)).toBe(0);
    expect(pitchClass(72)).toBe(0);
    expect(pitchClass(61)).toBe(1);
  });
});

describe("keyboard layout", () => {
  it("the full range is exactly the 88 keys (52 white + 36 black)", () => {
    const l = keyboardLayout(FULL_KEYBOARD.low, FULL_KEYBOARD.high);
    expect(l.whites.length).toBe(52);
    expect(l.blacks.length).toBe(36);
    expect(l.whites.length + l.blacks.length).toBe(88);
  });

  it("the 88-key extremes are the right white notes (La0, Do8) with correct MIDI", () => {
    expect(FULL_KEYBOARD).toEqual({ low: 21, high: 108 });
    const l = keyboardLayout(21, 108);
    expect(l.whites[0]).toBe(21); // A0
    expect(noteName(21)).toBe("La0");
    expect(l.whites[l.whites.length - 1]).toBe(108); // C8
    expect(noteName(108)).toBe("Do8");
    expect(noteName(60)).toBe("Do4"); // middle C
    expect(noteName(66)).toBe("Fa♯4"); // a black key
  });

  it("a black key (Fa♯4) sits between its neighbouring white keys", () => {
    const l = keyboardLayout(21, 108);
    const fSharp4 = 66;
    const f4Index = l.whites.indexOf(65); // Fa4 (white, just below)
    const g4Index = l.whites.indexOf(67); // Sol4 (white, just above)
    const black = blackLeftPct(fSharp4, l);
    expect(black).toBeGreaterThan(whiteLeftPct(f4Index, l));
    expect(black).toBeLessThan(whiteLeftPct(g4Index, l));
  });

  it("whiteWidthPct fills the container (52 keys → 100/52%)", () => {
    const l = keyboardLayout(21, 108);
    expect(l.whiteWidthPct).toBeCloseTo(100 / 52, 6);
  });

  it("displayRange switches full ↔ compact with connection", () => {
    expect(displayRange(true)).toEqual(FULL_KEYBOARD);
    expect(displayRange(false)).toEqual(COMPACT_KEYBOARD);
  });
});
