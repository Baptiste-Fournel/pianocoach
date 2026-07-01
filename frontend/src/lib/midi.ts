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
