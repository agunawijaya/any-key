/*
 * Deterministic noise for painting: hashed value noise in one and two
 * dimensions and fractal sums of it. The same coordinates and seed always
 * give the same value, so a landscape painted in tiles joins up seamlessly
 * and repaints identically.
 */

/** A well-mixed hash of two integers and a seed, in [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const hash1 = (x: number, seed = 0) => hash2(x, 0x5bd1e995, seed);

const fade = (t: number) => t * t * (3 - 2 * t);

/** Smooth noise along a line, in [-1, 1]. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const t = fade(x - i);
  const a = hash1(i, seed);
  const b = hash1(i + 1, seed);
  return (a + (b - a) * t) * 2 - 1;
}

/** Smooth noise over a plane, in [-1, 1]. */
export function noise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const tx = fade(x - ix);
  const ty = fade(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return (top + (bottom - top) * ty) * 2 - 1;
}

/** Fractal noise along a line: octaves of `noise1`, each twice as fine and half as strong. Roughly [-1, 1]. */
export function fbm1(x: number, seed = 0, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x, seed + o * 101);
    norm += amp;
    x = x * 2.03 + 17.3;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Fractal noise over a plane. Roughly [-1, 1]. */
export function fbm2(x: number, y: number, seed = 0, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x, y, seed + o * 101);
    norm += amp;
    x = x * 2.03 + 17.3;
    y = y * 1.97 + 5.1;
    amp *= 0.5;
  }
  return sum / norm;
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => fade(clamp((v - a) / (b - a)));
