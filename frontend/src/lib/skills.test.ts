import { describe, expect, it } from "vitest";
import { SKILLS, SKILL_LABEL, skillActivityMinutes, skillProgress } from "./skills";
import type { Piece, PracticeSession } from "../types";

function piece(over: Partial<Piece>): Piece {
  return {
    id: 1,
    title: "P",
    composer: "C",
    status: "in_progress",
    track: "chopin",
    difficulty: 5,
    date_started: null,
    date_completed: null,
    progress_pct: 0,
    target_tempo: null,
    current_clean_tempo: null,
    order_index: 0,
    loved: false,
    skills: [],
    notes: "",
    ...over,
  };
}

function session(over: Partial<PracticeSession>): PracticeSession {
  return {
    id: 1,
    date: "2026-07-01",
    duration_min: 30,
    focus_areas: [],
    pieces_worked: [],
    tension_level: null,
    mood: "",
    notes: "",
    ...over,
  };
}

describe("skill taxonomy", () => {
  it("has the 8 expected skills incl. bass reading + 4-against-3", () => {
    expect(SKILLS.length).toBe(8);
    expect(SKILL_LABEL["reading_bass"]).toBe("Lecture clé de fa");
    expect(SKILL_LABEL["polyrhythm_4v3"]).toBe("4 contre 3");
  });
});

describe("skillProgress", () => {
  it("averages progress of developing pieces (learned = 100), ignores planned", () => {
    const pieces = [
      piece({ id: 1, title: "A", skills: ["velocity"], status: "in_progress", progress_pct: 40 }),
      piece({ id: 2, title: "B", skills: ["velocity"], status: "learned", progress_pct: 0 }),
      piece({ id: 3, title: "C", skills: ["velocity"], status: "planned", progress_pct: 90 }), // ignored
    ];
    const velocity = skillProgress(pieces).find((s) => s.id === "velocity")!;
    expect(velocity.pieces.length).toBe(2); // planned excluded
    expect(velocity.progress).toBe(70); // (40 + 100) / 2
  });

  it("is 0 with no developing pieces", () => {
    const endurance = skillProgress([piece({ skills: ["velocity"] })]).find((s) => s.id === "endurance")!;
    expect(endurance.progress).toBe(0);
    expect(endurance.pieces).toEqual([]);
  });
});

describe("skillActivityMinutes", () => {
  const now = new Date("2026-07-10").getTime();

  it("attributes minutes via focus areas and worked pieces", () => {
    const pieces = [piece({ title: "Fantaisie", skills: ["polyrhythm_4v3"] })];
    const sessions = [
      session({ date: "2026-07-09", duration_min: 20, focus_areas: ["reading"] }),
      session({ date: "2026-07-08", duration_min: 30, pieces_worked: ["Fantaisie"] }),
    ];
    const m = skillActivityMinutes(sessions, pieces, 30, now);
    expect(m["reading_bass"]).toBe(20); // from focus 'reading'
    expect(m["reading_treble"]).toBe(20);
    expect(m["polyrhythm_4v3"]).toBe(30); // from worked piece
    expect(m["pedaling"]).toBe(0);
  });

  it("excludes sessions outside the window", () => {
    const old = [session({ date: "2026-05-01", duration_min: 60, focus_areas: ["reading"] })];
    const m = skillActivityMinutes(old, [], 30, now);
    expect(m["reading_bass"]).toBe(0);
  });
});
