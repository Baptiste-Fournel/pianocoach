// Pure MIDI helpers (note-number → French note name, key colour). Shared by the
// live piano monitor and the solfège trainer, so it's unit-tested on its own.

export const NOTE_NAMES_FR = [
  "Do",
  "Do♯",
  "Ré",
  "Ré♯",
  "Mi",
  "Fa",
  "Fa♯",
  "Sol",
  "Sol♯",
  "La",
  "La♯",
  "Si",
] as const;

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** Pitch class 0-11 (C..B) from a MIDI note number. */
export function pitchClass(note: number): number {
  return ((note % 12) + 12) % 12;
}

/** Scientific octave: MIDI 60 → 4 (middle C = C4 / "Do4"). */
export function octave(note: number): number {
  return Math.floor(note / 12) - 1;
}

/** French note name with octave, e.g. 60 → "Do4", 61 → "Do♯4". */
export function noteName(note: number): string {
  return `${NOTE_NAMES_FR[pitchClass(note)]}${octave(note)}`;
}

/** French note name without octave, e.g. 61 → "Do♯". */
export function noteNameShort(note: number): string {
  return NOTE_NAMES_FR[pitchClass(note)];
}

export function isBlackKey(note: number): boolean {
  return BLACK_PITCH_CLASSES.has(pitchClass(note));
}

// --- Keyboard layout (shared by the compact display, the 88-key display, and
// the clickable fallback in the solfège trainer). Convention confirmed:
// Do4 = middle C = MIDI 60, La4 = A440 = MIDI 69 → La0 = 21, Do8 = 108.
export const FULL_KEYBOARD = { low: 21, high: 108 }; // A0 → C8 (the full 88 keys)
export const COMPACT_KEYBOARD = { low: 36, high: 84 }; // Do2 → Do6 (compact display)

export interface KeyboardLayout {
  whites: number[];
  blacks: number[];
  whiteWidthPct: number; // width of one white key as a % of the container
}

export function keyboardLayout(low: number, high: number): KeyboardLayout {
  const whites: number[] = [];
  const blacks: number[] = [];
  for (let n = low; n <= high; n++) (isBlackKey(n) ? blacks : whites).push(n);
  return { whites, blacks, whiteWidthPct: whites.length ? 100 / whites.length : 0 };
}

/** Left offset (%) of the i-th white key. */
export function whiteLeftPct(whiteIndex: number, layout: KeyboardLayout): number {
  return whiteIndex * layout.whiteWidthPct;
}

/** Left offset (%) of a black key — straddling the gap after the whites below it. */
export function blackLeftPct(note: number, layout: KeyboardLayout): number {
  const whitesBefore = layout.whites.filter((w) => w < note).length;
  return whitesBefore * layout.whiteWidthPct - layout.whiteWidthPct * 0.32;
}

/** Which display range to show: full 88 keys when a piano is connected. */
export function displayRange(connected: boolean): { low: number; high: number } {
  return connected ? FULL_KEYBOARD : COMPACT_KEYBOARD;
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class (0-11) of a canonical English key like "C", "F#", "Bb". */
export function keyToPitchClass(key: string): number | null {
  const m = key.trim().match(/^([A-Ga-g])\s*([#♯b♭]?)/);
  if (!m) return null;
  let pc = LETTER_PC[m[1].toUpperCase()];
  if (m[2] === "#" || m[2] === "♯") pc += 1;
  else if (m[2] === "b" || m[2] === "♭") pc -= 1;
  return ((pc % 12) + 12) % 12;
}
