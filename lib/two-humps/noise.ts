/*
 * Smooth randomness for drawing the Gobi: value noise in one and two
 * dimensions, and fractal sums of it. Deterministic for a given seed, so a
 * dune drawn twice is the same dune.
 */

/** A stable pseudo-random number in [0, 1) for an integer lattice point. */
export function hash1(i: number, seed: number): number {
  let h = Math.imul(i ^ Math.imul(seed, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash2(i: number, j: number, seed: number): number {
  return hash1(i + Math.imul(j, 0x27d4eb2f), seed);
}

/** Smootherstep: zero slope and zero curvature at both ends, so noise has no visible creases. */
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise in one dimension, in [0, 1). */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const t = fade(x - i);
  const a = hash1(i, seed);
  return a + (hash1(i + 1, seed) - a) * t;
}

/** Value noise in two dimensions, in [0, 1). */
export function noise2(x: number, y: number, seed: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const u = fade(x - i);
  const v = fade(y - j);
  const a = hash2(i, j, seed);
  const b = hash2(i + 1, j, seed);
  const c = hash2(i, j + 1, seed);
  const d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise: octaves of value noise, each twice as fine and half as strong. Roughly [0, 1). */
export function fbm1(x: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x, seed + o * 101);
    norm += amp;
    x *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

export function fbm2(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x, y, seed + o * 101);
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}
