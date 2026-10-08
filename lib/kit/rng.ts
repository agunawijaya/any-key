/*
 * Seeded randomness for every game. Two generators live here:
 *
 * - mulberry32, the one the first four games were built on. Their daily
 *   puzzles, campaign screens and Free Flight sites are all derived from it,
 *   so it must keep producing exactly the same numbers for the same seed.
 * - sfc32 behind `createRng`, for new code: a longer period, string seeds,
 *   and `fork` for independent streams that don't shift when the parent
 *   draws one number more or less.
 */

export type RandomSource = () => number;

/** Floats in [0, 1). Same seed, same sequence, on every machine. */
export function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Four 32-bit words from any string, spread well enough to seed sfc32. */
function hashSeed(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): RandomSource {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export type Rng = {
  /** The seed this stream was made from, for logs and share texts. */
  readonly seed: string;
  /** A float in [0, 1). */
  float(): number;
  /** A whole number from `min` to `max`, both included. */
  int(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  /** A shuffled copy; the input is left alone. */
  shuffle<T>(list: readonly T[]): T[];
  /** An independent stream for one part of a game ("terrain", "weather"). */
  fork(label: string): Rng;
};

export function createRng(seed: number | string): Rng {
  const name = String(seed);
  const next = sfc32(...hashSeed(name));
  // A few warm-up draws so seeds that differ by one character diverge at once.
  for (let i = 0; i < 12; i++) next();

  const rng: Rng = {
    seed: name,
    float: next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle: (list) => {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    fork: (label) => createRng(`${name}/${label}`),
  };
  return rng;
}
