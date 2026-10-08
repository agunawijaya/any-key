import { STYLES, type StyleId } from "./arrange";
import { hasFull, songs } from "./songs";

/*
 * Bop Box's achievements. Listening is recorded per tune and per style; a
 * full-length piece counts as heard when it plays through to its last note.
 */

export type Listening = { tunesPlayed: string[]; stylesTried: string[]; fullHeard: string[] };

/** The tunes that have a full-length version as well as the 1981 excerpt. */
export const FULL_PIECES = songs.filter((s) => hasFull(s.id)).map((s) => s.id);

const add = (list: string[], item: string) => (list.includes(item) ? list : [...list, item]);

/** A tune starts playing in a style. */
export function listened<T extends Listening>(record: T, songId: string, styleId: StyleId): { record: T; badges: string[] } {
  const next = { ...record, tunesPlayed: add(record.tunesPlayed, songId), stylesTried: add(record.stylesTried, styleId) };
  const badges = ["first-note"];
  if (styleId === "pc81") badges.push("beep-beep");
  if (songs.every((s) => next.tunesPlayed.includes(s.id))) badges.push("whole-jukebox");
  if (STYLES.every((s) => next.stylesTried.includes(s.id))) badges.push("style-hopper");
  return { record: next, badges };
}

/** A full-length piece reached its last note. */
export function heardToTheEnd<T extends Listening>(record: T, songId: string): { record: T; badges: string[] } {
  const next = { ...record, fullHeard: add(record.fullHeard, songId) };
  const badges = ["long-version"];
  if (FULL_PIECES.every((id) => next.fullHeard.includes(id))) badges.push("concert-hall");
  return { record: next, badges };
}
