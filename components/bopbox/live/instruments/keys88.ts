import { isBlackKey } from "@/lib/music/theory";

/*
 * A real 88-key keyboard in centimetres: A0 to C8, 52 white keys 2.35 cm
 * wide, black keys set off-centre between them the way a piano maker cuts
 * them (C sharp leans left, D sharp right, and so on).
 */

export const WHITE_W = 2.35;
export const WHITE_LEN = 15;
export const BLACK_W = 1.37;
export const BLACK_LEN = 9.5;
export const LOWEST = 21;
export const HIGHEST = 108;
const WHITE_COUNT = 52;
export const KEYBOARD_W = WHITE_COUNT * WHITE_W;

/** Black keys sit off the line between their white neighbours, by this much of a white key. */
const BLACK_LEAN: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.16, 8: 0, 10: 0.16 };

const whiteBefore = (pitch: number) => {
  let count = 0;
  for (let p = LOWEST; p < pitch; p++) if (!isBlackKey(p)) count++;
  return count;
};

const X = new Map<number, number>();
for (let p = LOWEST; p <= HIGHEST; p++) {
  const left = -KEYBOARD_W / 2;
  X.set(p, isBlackKey(p) ? left + (whiteBefore(p) + BLACK_LEAN[p % 12]) * WHITE_W : left + (whiteBefore(p) + 0.5) * WHITE_W);
}

/** Centre of a key across the keyboard, middle of the keyboard at 0. Pitches off the end fold back an octave. */
export function keyX(pitch: number): number {
  let p = pitch;
  while (p < LOWEST) p += 12;
  while (p > HIGHEST) p -= 12;
  return X.get(p)!;
}

export const isBlack = isBlackKey;

export const KEYS = Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => LOWEST + i);
