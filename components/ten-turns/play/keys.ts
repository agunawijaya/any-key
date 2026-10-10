/*
 * Which keys move you. The letters form the same three-by-three square on
 * every keyboard (the key under your middle finger is the one you don't
 * press); the setting says which letters those are on yours. The number pad
 * and the arrows (two together for a diagonal) always work.
 */

import { DIRECTIONS, type Direction } from "@/lib/ten-turns/geometry";
import type { Settings } from "@/lib/ten-turns/progress";

const [E, NE, N, NW, W, SW, S, SE] = DIRECTIONS;

const LETTERS: Record<Settings["keys"], Record<string, Direction>> = {
  qwerty: { q: NW, w: N, e: NE, a: W, d: E, z: SW, x: S, c: SE },
  azerty: { a: NW, z: N, e: NE, q: W, d: E, w: SW, x: S, c: SE },
  qwertz: { q: NW, w: N, e: NE, a: W, d: E, y: SW, x: S, c: SE },
};

const NUMPAD: Record<string, Direction> = { Numpad7: NW, Numpad8: N, Numpad9: NE, Numpad4: W, Numpad6: E, Numpad1: SW, Numpad2: S, Numpad3: SE };

export const ARROWS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: 1 },
  ArrowDown: { dx: 0, dy: -1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
};

/** The direction a letter or number-pad key means, if any. */
export function directionForKey(event: KeyboardEvent, layout: Settings["keys"]): Direction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  return NUMPAD[event.code] ?? LETTERS[layout][event.key.toLowerCase()] ?? null;
}

/** Arrows held together make a diagonal. */
export function directionFromArrows(held: Set<string>): Direction | null {
  let dx = 0;
  let dy = 0;
  for (const key of held) {
    dx += ARROWS[key]?.dx ?? 0;
    dy += ARROWS[key]?.dy ?? 0;
  }
  dx = Math.sign(dx);
  dy = Math.sign(dy);
  return DIRECTIONS.find((d) => d.dx === dx && d.dy === dy) ?? null;
}

/** The letters for the help text: "Q W E / A D / Z X C". */
export function keyRows(layout: Settings["keys"]): string {
  const rows: Record<Settings["keys"], string> = { qwerty: "Q W E · A D · Z X C", azerty: "A Z E · Q D · W X C", qwertz: "Q W E · A D · Y X C" };
  return rows[layout];
}
