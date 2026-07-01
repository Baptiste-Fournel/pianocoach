import { isBlackKey, noteName, pitchClass } from "../lib/midi";

// A responsive piano keyboard. `active` = currently-held MIDI notes (highlighted).
// `onKeyDown` (optional) makes keys clickable — used as the no-MIDI fallback in
// the solfège trainer.
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
  const notes: number[] = [];
  for (let n = low; n <= high; n++) notes.push(n);
  const whites = notes.filter((n) => !isBlackKey(n));
  const blacks = notes.filter(isBlackKey);
  const ww = 100 / whites.length;
  const whitesBefore = (n: number) => whites.filter((w) => w < n).length;
  const clickable = Boolean(onKeyDown);

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
            left: `${i * ww}%`,
            width: `${ww}%`,
            background: active.has(n) ? "var(--color-primary)" : "#eef1f8",
            cursor: clickable ? "pointer" : "default",
          }}
          aria-label={noteName(n)}
        >
          {pitchClass(n) === 0 && (
            <span className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[9px] font-semibold text-faint">
              {noteName(n)}
            </span>
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
            left: `${whitesBefore(n) * ww - ww * 0.32}%`,
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
