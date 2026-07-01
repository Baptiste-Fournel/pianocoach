import { describe, expect, it } from "vitest";
import { cycleHits, drainDue, type Hit } from "./polyrhythm";

// Simulate one cycle frame-by-frame and collect which dot index lit up per hand.
function sweep(a: number, b: number, T = 1, dt = 0.005) {
  let queue: Hit[] = cycleHits(a, b, T, 0);
  const seenL = new Set<number>();
  const seenR = new Set<number>();
  for (let now = 0; now <= T + 1e-6; now += dt) {
    const { left, right, remaining } = drainDue(queue, now);
    if (left !== -1) seenL.add(left);
    if (right !== -1) seenR.add(right);
    queue = remaining;
  }
  return { seenL: [...seenL].sort((x, y) => x - y), seenR: [...seenR].sort((x, y) => x - y) };
}

describe("polyrhythm timing", () => {
  it("cycleHits places both hands, coinciding on the downbeat", () => {
    const hits = cycleHits(2, 3, 1, 0);
    expect(hits.filter((h) => h.hand === "L").length).toBe(2);
    expect(hits.filter((h) => h.hand === "R").length).toBe(3);
    // Both downbeats at t=0
    expect(hits.find((h) => h.hand === "L" && h.idx === 0)!.time).toBe(0);
    expect(hits.find((h) => h.hand === "R" && h.idx === 0)!.time).toBe(0);
  });

  it("2:3 — EVERY pulse lights, including the RH downbeat (regression B1)", () => {
    const { seenL, seenR } = sweep(2, 3);
    expect(seenL).toEqual([0, 1]);
    expect(seenR).toEqual([0, 1, 2]); // R0 (downbeat) must appear
  });

  it("3:4 — EVERY pulse lights, including the first two RH lights (regression B1)", () => {
    const { seenL, seenR } = sweep(3, 4);
    expect(seenL).toEqual([0, 1, 2]);
    expect(seenR).toEqual([0, 1, 2, 3]); // R0 and R1 must appear
  });

  it("drainDue keeps future hits and picks the latest-due per hand", () => {
    const q: Hit[] = [
      { hand: "L", idx: 0, time: 0 },
      { hand: "L", idx: 1, time: 0.5 },
      { hand: "R", idx: 0, time: 0 },
      { hand: "R", idx: 1, time: 0.33 },
    ];
    const r = drainDue(q, 0.4);
    expect(r.left).toBe(0); // only L0 due (L1 at 0.5 is future)
    expect(r.right).toBe(1); // R0 and R1 due, latest is R1
    expect(r.remaining).toEqual([{ hand: "L", idx: 1, time: 0.5 }]);
  });
});
