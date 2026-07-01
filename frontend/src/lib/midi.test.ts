import { describe, expect, it } from "vitest";
import { isBlackKey, noteName, noteNameShort, octave, pitchClass } from "./midi";

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
