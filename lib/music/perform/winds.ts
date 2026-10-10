/*
 * Fingerings for the winds, so a player's hands match the note: the valves
 * a trumpet presses, the slide position a trombone takes, how many tone
 * holes a woodwind closes.
 */

/** Trumpet valves for each written pitch class, first valve 1 (a B-flat trumpet reads a tone above concert pitch). */
const TRUMPET_VALVES: number[][] = [[], [1, 2, 3], [1, 3], [2, 3], [1, 2], [1], [2], [], [2, 3], [1, 2], [1], [2]];

export function valvesFor(pitch: number): number[] {
  return TRUMPET_VALVES[(((pitch + 2) % 12) + 12) % 12];
}

/** Harmonics of a B-flat tenor trombone with the slide closed (MIDI). */
const TROMBONE_PARTIALS = [34, 46, 53, 58, 62, 65, 68, 70, 72, 74];

/** Slide position, 1 (closed) to 7 (fully out): the nearest harmonic at or above the note, then down a semitone per position. */
export function slidePosition(pitch: number): number {
  const partial = TROMBONE_PARTIALS.find((p) => p - pitch >= 0 && p - pitch <= 6) ?? TROMBONE_PARTIALS[TROMBONE_PARTIALS.length - 1];
  return Math.min(7, Math.max(1, partial - pitch + 1));
}

/** How many of six tone holes are closed: all for the lowest note of the octave, fewer as it rises. */
export function closedHoles(pitch: number): number {
  return 6 - Math.floor(((((pitch - 60) % 12) + 12) % 12) / 2);
}
