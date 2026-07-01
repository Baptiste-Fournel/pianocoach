import { blackLeftPct, keyboardLayout, noteName, pitchClass, whiteLeftPct } from "../lib/midi";

// A responsive piano keyboard, parameterised by range (compact vs full 88 keys).
// `active` = currently-held MIDI notes (highlighted). `onKeyDown` (optional)
// makes keys clickable — used ONLY as the small no-MIDI fallback in the solfège
// trainer; the 88-key display passes no handler (display-only).
export function PianoKeyboard({
  active,
  low = 48,
  high = 84,
  onKeyDown,
  height = 150,
}: {
  active: Set<number>;
  low?: number;
  high?: number;
  onKeyDown?: (note: number) => void;
  height?: number;
}) {
  const layout = keyboardLayout(low, high);
  const { whites, blacks, whiteWidthPct: ww } = layout;
  const clickable = Boolean(onKeyDown);
  // Text labels only when keys are wide enough; the 88-key view is too dense.
  const showLabels = ww >= 2.4;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-border bg-surface-2" style={{ height }}>
      {whites.map((n, i) => (
        <button
          key={n}
          type="button"
          disabled={!clickable}
          onMouseDown={onKeyDown ? () => onKeyDown(n) : undefined}
          className="absolute top-0 bottom-0 border-r border-border transition-colors"
          style={{
            left: `${whiteLeftPct(i, layout)}%`,
            width: `${ww}%`,
            background: active.has(n) ? "var(--color-primary)" : "#eef1f8",
            cursor: clickable ? "pointer" : "default",
          }}
          aria-label={noteName(n)}
        >
          {showLabels && pitchClass(n) === 0 && (
            <span className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold text-faint">
              {noteName(n)}
            </span>
          )}
          {/* middle-C reference marker (helps orient on the dense 88-key view) */}
          {n === 60 && (
            <span
              className="pointer-events-none absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              style={{ background: "var(--color-accent)" }}
              title="Do central (Do4)"
            />
          )}
        </button>
      ))}
      {blacks.map((n) => (
        <button
          key={n}
          type="button"
          disabled={!clickable}
          onMouseDown={onKeyDown ? () => onKeyDown(n) : undefined}
          className="absolute top-0 z-10 rounded-b transition-colors"
          style={{
            left: `${blackLeftPct(n, layout)}%`,
            width: `${ww * 0.64}%`,
            height: "62%",
            background: active.has(n) ? "var(--color-primary-deep)" : "#151b28",
            border: "1px solid #05070c",
            cursor: clickable ? "pointer" : "default",
          }}
          aria-label={noteName(n)}
        />
      ))}
    </div>
  );
}
