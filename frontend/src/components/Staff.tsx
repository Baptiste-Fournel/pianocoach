import { type Clef, ledgerSteps, staffStepsFromMiddle } from "../lib/solfege";

// Minimal, dependency-free music staff: 5 lines, a clef, the target note head,
// and ledger lines — all placed from the pure solfège geometry (see solfege.ts).
const HALF = 8; // half a line-gap, px
const NOTE_X = 220;
const W = 320;
const H = 168;

export function Staff({ midi, clef, state = "idle" }: { midi: number; clef: Clef; state?: "idle" | "correct" | "wrong" }) {
  const midY = H / 2;
  const steps = staffStepsFromMiddle(midi, clef);
  const noteY = midY + steps * HALF;
  const lineYs = [-4, -2, 0, 2, 4].map((s) => midY + s * HALF);
  const ledgerYs = ledgerSteps(steps).map((s) => midY + s * HALF);
  const clefGlyph = clef === "treble" ? "𝄞" : "𝄢";
  const noteColor =
    state === "correct" ? "var(--color-good)" : state === "wrong" ? "var(--color-bad)" : "var(--color-accent)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 380 }} role="img" aria-label={`Portée ${clef === "treble" ? "clé de sol" : "clé de fa"}`}>
      {lineYs.map((y, i) => (
        <line key={i} x1={16} x2={W - 16} y1={y} y2={y} stroke="#8b97ac" strokeWidth={1.4} />
      ))}
      <text x={46} y={midY + 18} fontSize={58} textAnchor="middle" fill="#e8ebf2">
        {clefGlyph}
      </text>
      {ledgerYs.map((y, i) => (
        <line key={`l${i}`} x1={NOTE_X - 20} x2={NOTE_X + 20} y1={y} y2={y} stroke="#8b97ac" strokeWidth={1.4} />
      ))}
      <ellipse cx={NOTE_X} cy={noteY} rx={10} ry={7} fill={noteColor} transform={`rotate(-18 ${NOTE_X} ${noteY})`} />
    </svg>
  );
}
