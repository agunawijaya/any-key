import { mulberry32 } from "@/lib/kit/rng";
import type { WorldId } from "./worlds";

/*
 * Free Flight terrain: one landing site, generated from a seed, used by both
 * the physics and the drawing.
 *
 * A site is about ±4 km of rough ground around the start, with ridges (or deep
 * sea) beyond. The rough ground is a zigzag of straight pieces whose slopes are
 * never gentler than 9°, laid over a large landform (boulder field, crater,
 * canyon, dunes, crags) and studded with boulders. Hidden in it are 3 to 6
 * natural flats (slope 4° or less, 12 to 60 m wide): the only places a lander
 * can stand. Nothing marks them; the player finds them by eye.
 *
 * On Earth the site is open sea with a few barges that rock on the swell.
 *
 * Distances along the ground are in km (like the lander's x), heights in metres.
 */

export type SiteKind = "boulders" | "rim" | "canyon" | "dunes" | "crags" | "sea";

/** A natural flat: from x0 to x1 (km), sloping `slope` degrees (positive = rising to the right). */
export type Flat = { x0: number; x1: number; slope: number };

/** A boulder: centre (km), half-width and height (m). */
export type Boulder = { x: number; r: number; h: number };

/** A barge at sea: centre at t = 0 (km), half deck width (m), drift (km/h), rocking amplitude (deg) and period (s). */
export type Barge = { x: number; half: number; drift: number; rock: number; period: number; phase: number };

export type Site = {
  seed: number;
  world: WorldId;
  kind: SiteKind;
  /** Breakpoints of the ground skeleton (km) and its heights there (m). */
  xs: Float64Array;
  hs: Float64Array;
  boulders: Boulder[];
  /** The widest boulder's half-width, km (for lookups). */
  reach: number;
  flats: Flat[];
  barges: Barge[];
};

/** The site proper runs ±4 km; the generated ground runs further, into ridges and highlands. */
export const SITE_HALF = 4;
const SPAN = 8;
/** Beyond the generated span the highland band (the last 3 km) repeats. */
const BAND = 3;
/** A barge deck stands this high above the sea (m). */
export const FREEBOARD = 4;
/** Rough ground is never gentler than this (degrees). */
export const ROUGH_MIN = 9;

const DEG = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------- Looking up the ground ---------- */

/** Folds positions beyond the generated span back into its outer (highland) band, so the ground goes on forever. */
function fold(x: number) {
  const ax = Math.abs(x);
  if (ax <= SPAN) return x;
  const p = (ax - (SPAN - BAND)) % (2 * BAND);
  const q = p <= BAND ? p : 2 * BAND - p;
  return Math.sign(x) * (SPAN - BAND + q);
}

function skeleton(site: Site, x: number) {
  const { xs, hs } = site;
  let lo = 0;
  let hi = xs.length - 1;
  if (x <= xs[0]) return hs[0];
  if (x >= xs[hi]) return hs[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return hs[lo] + (hs[hi] - hs[lo]) * f;
}

function boulderLift(site: Site, x: number) {
  const b = site.boulders;
  if (!b.length) return 0;
  // First boulder whose centre is at or right of x − reach.
  let lo = 0;
  let hi = b.length;
  const from = x - site.reach;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (b[mid].x < from) lo = mid + 1;
    else hi = mid;
  }
  let lift = 0;
  for (let i = lo; i < b.length && b[i].x <= x + site.reach; i++) {
    const d = (Math.abs(x - b[i].x) * 1000) / b[i].r;
    if (d < 1) lift = Math.max(lift, b[i].h * Math.sqrt(1 - d * d));
  }
  return lift;
}

/** Where a barge's deck centre is at time t (km). */
export function bargeX(b: Barge, t: number) {
  return b.x + (b.drift * t) / 3200;
}

/** A barge's deck angle at time t (degrees). */
export function bargeTilt(b: Barge, t: number) {
  return b.rock * Math.sin((2 * Math.PI * t) / b.period + b.phase);
}

function bargeBob(b: Barge, t: number) {
  return 0.35 * Math.sin((2 * Math.PI * t) / (b.period * 0.8) + b.phase * 1.7);
}

/** The sea's gentle swell (m). */
function swell(x: number, t: number) {
  return 0.3 * Math.sin(x * 70 + t * 0.9) + 0.2 * Math.sin(x * 190 - t * 1.4);
}

/** Deck height (m) of barge `b` at x and t, or null off the deck. */
export function deckAt(b: Barge, x: number, t: number) {
  const dx = (x - bargeX(b, t)) * 1000;
  if (Math.abs(dx) > b.half) return null;
  return FREEBOARD + bargeBob(b, t) + dx * Math.tan(bargeTilt(b, t) * DEG);
}

/** Ground height (m) at x (km), at time t (s): only the barges and the swell move. */
export function heightAt(site: Site, xKm: number, t = 0): number {
  if (site.kind === "sea") {
    let h = swell(xKm, t);
    for (const b of site.barges) {
      const d = deckAt(b, xKm, t);
      if (d !== null && d > h) h = d;
    }
    return h;
  }
  const x = fold(xKm);
  return skeleton(site, x) + boulderLift(site, x);
}

/** Is x (km) open water at time t? */
export function isWater(site: Site, xKm: number, t = 0) {
  return site.kind === "sea" && site.barges.every((b) => deckAt(b, xKm, t) === null);
}

/** The ground's slope at x in degrees (positive = rising to the right). */
export function slopeAt(site: Site, xKm: number, t = 0) {
  const d = 0.0002;
  return Math.atan((heightAt(site, xKm + d, t) - heightAt(site, xKm - d, t)) / (2 * d * 1000)) / DEG;
}

/**
 * The slope a footpad feels (degrees, always positive): the steepest of the
 * short pieces of ground within 0.6 m of x. Unlike a single slope reading this
 * can't be fooled by the bottom of a V, where the two sides average to zero.
 */
export function footSlope(site: Site, xKm: number, t = 0) {
  const step = 0.0003;
  let worst = 0;
  let prev = heightAt(site, xKm - 2 * step, t);
  for (let i = -1; i <= 2; i++) {
    const h = heightAt(site, xKm + i * step, t);
    worst = Math.max(worst, Math.abs(Math.atan((h - prev) / (step * 1000))) / DEG);
    prev = h;
  }
  return worst;
}

/** The barge whose deck is over x at time t. */
export function bargeUnder(site: Site, xKm: number, t = 0) {
  return site.barges.find((b) => Math.abs(xKm - bargeX(b, t)) * 1000 <= b.half) ?? null;
}

/** The flat (or barge deck) under x at time t, as a stretch of ground (km). */
export function flatUnder(site: Site, xKm: number, t = 0): Flat | null {
  if (site.kind === "sea") {
    const b = bargeUnder(site, xKm, t);
    if (!b) return null;
    const c = bargeX(b, t);
    return { x0: c - b.half / 1000, x1: c + b.half / 1000, slope: bargeTilt(b, t) };
  }
  return site.flats.find((f) => xKm >= f.x0 && xKm <= f.x1) ?? null;
}

/** Every landing spot at time t: the flats, or on Earth the barge decks. */
export function landingSpots(site: Site, t = 0): Flat[] {
  if (site.kind !== "sea") return site.flats;
  return site.barges.map((b) => {
    const c = bargeX(b, t);
    return { x0: c - b.half / 1000, x1: c + b.half / 1000, slope: bargeTilt(b, t) };
  });
}

/* ---------- Generating a site ---------- */

type Params = {
  /** Length of the rough pieces (m). */
  seg: [number, number];
  /** Their slopes (degrees). */
  slope: [number, number];
  /** How far the zigzag may wander from the landform (m). */
  band: number;
  /** Boulders per 100 m of rough ground, and their heights (m). */
  boulders: number;
  boulderH: [number, number];
  flats: [number, number];
  flatW: [number, number];
};

const PARAMS: Record<Exclude<SiteKind, "sea">, Params> = {
  boulders: { seg: [5, 28], slope: [ROUGH_MIN, 30], band: 3, boulders: 2.6, boulderH: [1, 6], flats: [4, 6], flatW: [12, 55] },
  rim: { seg: [6, 36], slope: [ROUGH_MIN, 32], band: 4, boulders: 0.9, boulderH: [1, 5], flats: [3, 5], flatW: [14, 60] },
  canyon: { seg: [6, 44], slope: [ROUGH_MIN, 30], band: 4, boulders: 0.7, boulderH: [1, 5], flats: [4, 6], flatW: [14, 60] },
  dunes: { seg: [3, 9], slope: [ROUGH_MIN, 15], band: 0.8, boulders: 0.08, boulderH: [1, 2], flats: [4, 6], flatW: [16, 60] },
  crags: { seg: [4, 32], slope: [12, 35], band: 7, boulders: 1.1, boulderH: [1, 4], flats: [3, 5], flatW: [12, 40] },
};

type Landform = { M: (x: number) => number; /** Places a flat must go (km), with a width range. */ must: { x: number; w?: [number, number] }[]; /** Stretches that can't take a flat. */ avoid: [number, number][] };

/** Smooth value noise, −1..1. */
function vnoise(rng: () => number) {
  const table = Array.from({ length: 64 }, () => rng() * 2 - 1);
  return (u: number) => {
    const i = Math.floor(u);
    const f = u - i;
    const a = table[((i % 64) + 64) % 64];
    const b = table[(((i + 1) % 64) + 64) % 64];
    return a + (b - a) * f * f * (3 - 2 * f);
  };
}

function fbm(rng: () => number, octaves: number) {
  const layers = Array.from({ length: octaves }, () => vnoise(rng));
  const shift = layers.map(() => rng() * 40);
  return (u: number) => layers.reduce((sum, n, k) => sum + n(u * 2 ** k + shift[k]) / 2 ** k, 0) / 1.9;
}

/** A crater's cross-section (m): a floor, a steep wall and a raised rim that fades outwards. */
function crater(x: number, c: number, r: number, depth: number, rim: number, floor = 0.45) {
  const d = Math.abs(x - c) / r;
  if (d < floor) return -depth;
  if (d < 1) return -depth + (depth + rim) * smooth(floor, 1, d);
  return rim * Math.exp(-(((d - 1) / 0.35) ** 2));
}

/** The edges: ridges that rise far above the site, then a high, rough plateau. */
function edges(x: number) {
  const a = Math.abs(x);
  return 620 * smooth(SITE_HALF - 0.1, SITE_HALF + 1.1, a) - 230 * smooth(SITE_HALF + 1.6, SITE_HALF + 3.4, a);
}

function landform(kind: Exclude<SiteKind, "sea">, rng: () => number): Landform {
  const roll = fbm(rng, 4);
  if (kind === "boulders") {
    const craters = Array.from({ length: 3 + Math.floor(rng() * 3) }, () => ({ c: (rng() * 2 - 1) * 3.6, r: 0.06 + rng() * 0.2 }));
    return {
      M: (x) => 32 * roll(x / 1.4) + craters.reduce((s, k) => s + crater(x, k.c, k.r, k.r * 180, k.r * 60), 0),
      must: [],
      avoid: [],
    };
  }
  if (kind === "rim") {
    const c = (rng() * 2 - 1) * 1.3;
    const r = 0.8 + rng() * 0.45;
    const small = Array.from({ length: 2 }, () => ({ c: (rng() * 2 - 1) * 3.6, r: 0.08 + rng() * 0.12 }));
    return {
      M: (x) => 18 * roll(x / 1.2) + crater(x, c, r, 150, 75) + small.reduce((s, k) => s + crater(x, k.c, k.r, k.r * 160, k.r * 50), 0),
      // One flat on the crater floor, one on the outer flank.
      must: [{ x: c + (rng() - 0.5) * r * 0.5, w: [30, 60] }, { x: c + (rng() < 0.5 ? -1 : 1) * r * (1.25 + rng() * 0.2), w: [14, 28] }],
      // Nothing on the inner wall.
      avoid: [
        [c - r * 1.05, c - r * 0.5],
        [c + r * 0.5, c + r * 1.05],
      ],
    };
  }
  if (kind === "canyon") {
    // A plateau on one side, the canyon floor 300 m down on the other, and a bench halfway down the wall.
    const side = rng() < 0.5 ? -1 : 1;
    const edge = (rng() * 2 - 1) * 0.9;
    const drop1 = 140;
    const drop2 = 160;
    const w1 = 0.13;
    const bench = 0.1 + rng() * 0.04;
    const w2 = 0.16;
    const talus = 0.35;
    const M = (x: number) => {
      const u = (x - edge) * side; // metres past the brink, into the canyon
      let h = 14 * roll(x / 1.1);
      if (u > 0) {
        h -= drop1 * smooth(0, w1, u);
        h -= drop2 * smooth(w1 + bench, w1 + bench + w2, u);
        h -= 45 * smooth(w1 + bench + w2, w1 + bench + w2 + talus, u);
      }
      return h;
    };
    return {
      M,
      must: [
        { x: edge - side * (0.12 + rng() * 0.25), w: [22, 45] },
        { x: edge + side * (w1 + bench / 2), w: [14, 22] },
        { x: edge + side * (w1 + bench + w2 + talus + 0.25 + rng() * 0.6), w: [30, 60] },
      ],
      avoid: side > 0 ? [[edge - 0.02, edge + w1 + 0.01], [edge + w1 + bench - 0.01, edge + w1 + bench + w2 + talus]] : [[edge - w1 - 0.01, edge + 0.02], [edge - w1 - bench - w2 - talus, edge - w1 - bench + 0.01]],
    };
  }
  if (kind === "dunes") {
    // Asymmetric dunes: a long gentle windward side, a steep slip face; flat corridors between them.
    const wind = rng() < 0.5 ? -1 : 1;
    const lambda = 0.3 + rng() * 0.18;
    const height = 18 + rng() * 14;
    const phase = rng();
    const M = (x: number) => {
      const u = (x * wind) / lambda + phase;
      const k = u - Math.floor(u);
      const n = Math.floor(u);
      const tall = height * (0.7 + 0.5 * Math.abs(Math.sin(n * 12.9898) % 1));
      // Rises over 72% of the wavelength, then drops down the slip face.
      const dune = k < 0.72 ? tall * (k / 0.72) ** 1.4 : tall * (1 - smooth(0.72, 0.86, k));
      return dune + 10 * roll(x / 2);
    };
    return { M, must: [], avoid: [] };
  }
  // Crags: sharp metal ridges.
  const ridge = fbm(rng, 3);
  return {
    M: (x) => 110 * (1 - Math.abs(ridge(x / 0.9))) + 40 * roll(x / 0.5) - 60,
    must: [],
    avoid: [],
  };
}

function placeFlats(p: Params, form: Landform, rng: () => number) {
  const want = p.flats[0] + Math.floor(rng() * (p.flats[1] - p.flats[0] + 1));
  const flats: { c: number; w: number }[] = [];
  const width = (range: [number, number] = p.flatW) => range[0] + rng() * (range[1] - range[0]);
  for (const m of form.must) flats.push({ c: m.x, w: width(m.w) });
  // One generous flat somewhere central, the rest anywhere.
  let generous = flats.some((f) => f.w >= 30);
  for (let tries = 0; flats.length < want && tries < 400; tries++) {
    const c = (rng() * 2 - 1) * (SITE_HALF - 0.4);
    const w = generous ? width() : width([Math.max(30, p.flatW[0]), p.flatW[1]]);
    if (flats.some((f) => Math.abs(f.c - c) < 0.3)) continue;
    if (form.avoid.some(([a, b]) => c + w / 2000 > a && c - w / 2000 < b)) continue;
    flats.push({ c, w });
    generous = true;
  }
  return flats
    .map((f) => {
      // Mostly level; some lean a little.
      const lean = rng() < 0.5 ? (rng() * 2 - 1) * 1 : (rng() * 2 - 1) * 3.6;
      return { x0: f.c - f.w / 2000, x1: f.c + f.w / 2000, slope: lean };
    })
    .sort((a, b) => a.x0 - b.x0);
}

function buildLand(seed: number, world: WorldId, kind: Exclude<SiteKind, "sea">): Site {
  const rng = mulberry32(seed * 7919 + 17);
  const p = PARAMS[kind];
  const form = landform(kind, rng);
  const flats = placeFlats(p, form, rng);
  // Around each flat the landform is levelled, so the flat sits on a natural ledge, floor or clearing.
  const M = (x: number) => {
    let h = form.M(x) + edges(x);
    for (const f of flats) {
      const c = (f.x0 + f.x1) / 2;
      const half = (f.x1 - f.x0) / 2;
      const w = 1 - smooth(half, half + 0.09, Math.abs(x - c));
      if (w > 0) h += (form.M(c) + edges(c) - h) * w;
    }
    return h;
  };

  const xs: number[] = [];
  const hs: number[] = [];
  let x = -SPAN;
  let h = M(x);
  xs.push(x);
  hs.push(h);
  let fi = 0;
  let lastSign = 1;
  const range = (r: [number, number]) => r[0] + rng() * (r[1] - r[0]);
  while (x < SPAN) {
    const flat = flats[fi];
    if (flat && flat.x0 - x < 0.003) {
      // The flat starts where the zigzag has got to.
      const w = flat.x1 - flat.x0;
      flat.x0 = x;
      flat.x1 = x + w;
      x = flat.x1;
      h += w * 1000 * Math.tan(flat.slope * DEG);
      xs.push(x);
      hs.push(h);
      fi++;
      continue;
    }
    let len = range(p.seg) / 1000;
    if (flat && flat.x0 - x < len + 0.003) len = flat.x0 - x;
    const target = M(x + len);
    const diff = target - h;
    let sign: number;
    if (diff > p.band) sign = 1;
    else if (diff < -p.band) sign = -1;
    else sign = rng() < 0.7 ? -lastSign : lastSign;
    let mag = range(p.slope);
    // Keep up with the landform: steeper when it climbs or drops fast (canyon walls may reach 60°).
    const needed = Math.atan(Math.abs(diff) / (len * 1000)) / DEG;
    if (Math.sign(diff) === sign && Math.abs(diff) > p.band) mag = Math.max(mag, Math.min(62, needed + 2 + rng() * 4));
    h += sign * len * 1000 * Math.tan(mag * DEG);
    x += len;
    xs.push(x);
    hs.push(h);
    lastSign = sign;
  }

  // Boulders: scattered over rough ground, and often a pair guarding the edges of a flat.
  const boulders: Boulder[] = [];
  const inFlat = (bx: number, r: number) => flats.some((f) => bx + r / 1000 + 0.0006 > f.x0 && bx - r / 1000 - 0.0006 < f.x1);
  const size = () => {
    const hgt = p.boulderH[0] + (p.boulderH[1] - p.boulderH[0]) * rng() ** 2.2;
    return { h: hgt, r: hgt * (0.75 + rng() * 0.45) };
  };
  for (let bx = -SPAN; bx < SPAN; ) {
    bx += (-Math.log(1 - rng()) * 0.1) / p.boulders;
    const s = size();
    if (!inFlat(bx, s.r)) boulders.push({ x: bx, ...s });
  }
  for (const f of flats) {
    for (const [edge, dir] of [
      [f.x0, -1],
      [f.x1, 1],
    ] as const) {
      if (rng() < 0.55) continue;
      const hgt = 1 + rng() * 2.2;
      const r = hgt * (0.8 + rng() * 0.3);
      boulders.push({ x: edge + (dir * (r + 0.4 + rng() * 2)) / 1000, r, h: hgt });
    }
  }
  boulders.sort((a, b) => a.x - b.x);
  const reach = boulders.reduce((m, b) => Math.max(m, b.r), 0) / 1000;
  return { seed, world, kind, xs: Float64Array.from(xs), hs: Float64Array.from(hs), boulders, reach, flats, barges: [] };
}

function buildSea(seed: number): Site {
  const rng = mulberry32(seed * 7919 + 17);
  const n = 2 + Math.floor(rng() * 3);
  const sizes = [16, 22, 30, 42, 60].sort(() => rng() - 0.5).slice(0, n);
  const barges: Barge[] = [];
  for (let tries = 0; barges.length < n && tries < 400; tries++) {
    const x = (rng() * 2 - 1) * (SITE_HALF - 0.6);
    if (barges.some((b) => Math.abs(b.x - x) < 0.45)) continue;
    const half = sizes[barges.length] / 2;
    barges.push({ x, half, drift: 0, rock: 0.8 + rng() * 2.2, period: 6 + rng() * 5, phase: rng() * Math.PI * 2 });
  }
  // One may be drifting slowly.
  if (rng() < 0.6) barges[Math.floor(rng() * barges.length)].drift = (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 1.4);
  barges.sort((a, b) => a.x - b.x);
  return { seed, world: "earth", kind: "sea", xs: new Float64Array([-SPAN, SPAN]), hs: new Float64Array([0, 0]), boulders: [], reach: 0, flats: [], barges };
}

export function defaultKind(world: WorldId, seed: number): SiteKind {
  const coin = mulberry32(seed * 31 + 5)() < 0.5;
  if (world === "earth") return "sea";
  if (world === "psyche") return "crags";
  if (world === "mars") return coin ? "canyon" : "dunes";
  return coin ? "boulders" : "rim";
}

/** The site for a seed. The same seed and world always give the same ground. */
export function buildSite(world: WorldId, seed: number, kind: SiteKind = defaultKind(world, seed)): Site {
  return kind === "sea" ? buildSea(seed) : buildLand(seed, world, kind);
}

/** A coarse profile of the whole site for the terrain strip: [x km, height m] pairs. */
export function siteProfile(site: Site, from = -SITE_HALF - 0.6, to = SITE_HALF + 0.6, n = 480, t = 0) {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = from + ((to - from) * i) / n;
    out.push([x, heightAt(site, x, t)]);
  }
  return out;
}
