// Pure, testable timing logic for the polyrhythm trainer.
// Kept out of the React component so the scheduling can be unit-tested without
// Web Audio / rAF. See Polyrhythm.tsx for the audio + visual wiring.

export interface Hit {
  hand: "L" | "R";
  idx: number;
  time: number; // absolute AudioContext time (seconds)
}

/**
 * Every hit of ONE a:b cycle of duration T starting at `start`.
 * Left hand fires at start + i*T/a (i in [0,a)), right at start + j*T/b.
 * They coincide on the downbeat (idx 0).
 */
export function cycleHits(a: number, b: number, T: number, start: number): Hit[] {
  const hits: Hit[] = [];
  for (let i = 0; i < a; i++) hits.push({ hand: "L", idx: i, time: start + (i * T) / a });
  for (let j = 0; j < b; j++) hits.push({ hand: "R", idx: j, time: start + (j * T) / b });
  return hits;
}

/**
 * Given a queue of scheduled hits and the current time, return the active dot
 * index per hand (the most recent hit whose time has passed, -1 if none this
 * frame) plus the hits still in the future.
 *
 * Unlike a naive front-gated FIFO, this scans the WHOLE queue, so hits that are
 * not in time order (the queue is filled per-hand: all L then all R) are handled
 * correctly — this is the fix for the bug where the right-hand downbeat light
 * (and the first RH lights in 3:4) never lit.
 */
export function drainDue(queue: Hit[], now: number): { left: number; right: number; remaining: Hit[] } {
  let left = -1;
  let right = -1;
  let lt = -Infinity;
  let rt = -Infinity;
  const remaining: Hit[] = [];
  for (const h of queue) {
    if (h.time <= now) {
      if (h.hand === "L") {
        if (h.time >= lt) {
          lt = h.time;
          left = h.idx;
        }
      } else if (h.time >= rt) {
        rt = h.time;
        right = h.idx;
      }
    } else {
      remaining.push(h);
    }
  }
  return { left, right, remaining };
}
