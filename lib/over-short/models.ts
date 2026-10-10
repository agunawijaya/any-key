import { GRAVITY, muzzleSpeed } from "./ballistics";

/*
 * The ballistic models behind every play style. One integrator flies every
 * shell, with a fixed step, so the picture on screen and the observer's
 * report always agree:
 *
 * - vacuum: gravity only. On level ground it lands exactly where the 1973
 *   formula says, R · sin 2θ.
 * - modified: vacuum plus the Campaign's modifiers: a target up or down a
 *   slope, and a steady wind that pushes the shell along the line of fire.
 * - air: a point mass with drag against the air, which moves with the wind.
 *   The best angle drops below 45° and complementary angles stop matching.
 *
 * Distances are metres along the line of fire from the gun, heights metres
 * above the gun.
 */

export type ModelId = "vacuum" | "modified" | "air";

export type Gun = {
  /** Greatest range in a vacuum, metres. Sets the muzzle speed. */
  vacuumRange: number;
  /** Drag per metre: deceleration = drag · speed², against the air. Zero outside the air model. */
  drag: number;
};

export type Ground = {
  /** Where the target stands, metres from the gun. */
  distance: number;
  /** How far above (+) or below (−) the gun it stands. The ground is a straight slope from the gun through it. */
  height: number;
};

/** Wind along the line of fire, m/s: positive blows from the gun towards the target. */
export type Air = { wind: number };

export type FlightSample = { t: number; x: number; y: number };

export type Flight = {
  /** Where the shell comes down, metres from the gun along the line of fire. */
  landed: number;
  /** Height of the ground where it comes down. */
  landedHeight: number;
  /** Seconds in the air. */
  time: number;
  /** Highest point above the gun. */
  apex: number;
  /** The path every `SAMPLE_EVERY` seconds, for drawing; the last sample is the impact. */
  path: FlightSample[];
};

/** The integrator's fixed step, in seconds. RK4 is exact for a vacuum and within centimetres in air at this step. */
export const STEP = 0.1;
/** The path keeps every other step for drawing. */
export const SAMPLE_EVERY = 2 * STEP;
/** In the modified model, how hard a 1 m/s wind pushes the shell along (m/s² per m/s). */
export const WIND_PUSH = 0.04;
const LONGEST_FLIGHT = 400;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

type State = { x: number; y: number; vx: number; vy: number };

function accelerate(model: ModelId, gun: Gun, air: Air, s: State): [number, number] {
  if (model === "vacuum") return [0, -GRAVITY];
  if (model === "modified") return [WIND_PUSH * air.wind, -GRAVITY];
  // Drag acts on the shell's speed through the air, not over the ground.
  const rx = s.vx - air.wind;
  const ry = s.vy;
  const speed = Math.hypot(rx, ry);
  return [-gun.drag * speed * rx, -GRAVITY - gun.drag * speed * ry];
}

function rk4(model: ModelId, gun: Gun, air: Air, s: State, dt: number): State {
  const f = (p: State): State => {
    const [ax, ay] = accelerate(model, gun, air, p);
    return { x: p.vx, y: p.vy, vx: ax, vy: ay };
  };
  const add = (p: State, d: State, h: number): State => ({ x: p.x + d.x * h, y: p.y + d.y * h, vx: p.vx + d.vx * h, vy: p.vy + d.vy * h });
  const k1 = f(s);
  const k2 = f(add(s, k1, dt / 2));
  const k3 = f(add(s, k2, dt / 2));
  const k4 = f(add(s, k3, dt));
  return {
    x: s.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: s.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
    vx: s.vx + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
    vy: s.vy + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy),
  };
}

/**
 * Seconds into a step at which the shell meets the slope, taking the step's
 * acceleration as constant: a parabola, so a shell coming in low over the
 * ground is placed to the centimetre rather than along a chord.
 */
function crossing(s: State, [ax, ay]: [number, number], slope: number) {
  const c = s.y - slope * s.x;
  const b = s.vy - slope * s.vx;
  const a = 0.5 * (ay - slope * ax);
  if (Math.abs(a) < 1e-12) return Math.min(STEP, Math.max(0, -c / b));
  const root = (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  return Math.min(STEP, Math.max(0, root));
}

/** Flies one shell fired at `elevation` degrees until it meets the ground on its way down. */
export function fly(model: ModelId, gun: Gun, elevation: number, ground: Ground, air: Air = { wind: 0 }): Flight {
  const v = muzzleSpeed(gun.vacuumRange);
  const slope = ground.distance > 0 ? ground.height / ground.distance : 0;
  const above = (s: State) => s.y - slope * s.x;
  let s: State = { x: 0, y: 0, vx: v * Math.cos(radians(elevation)), vy: v * Math.sin(radians(elevation)) };
  let t = 0;
  let apex = 0;
  const path: FlightSample[] = [{ t: 0, x: 0, y: 0 }];
  let steps = 0;
  while (t < LONGEST_FLIGHT) {
    const next = rk4(model, gun, air, s, STEP);
    // Down through the ground: find where in this step it crossed.
    if (next.vy < 0 && above(next) <= 0 && above(s) > 0) {
      const pull = accelerate(model, gun, air, s);
      const tau = crossing(s, pull, slope);
      const ax = pull[0];
      const x = s.x + s.vx * tau + 0.5 * ax * tau * tau;
      const y = slope * x;
      path.push({ t: t + tau, x, y });
      return { landed: x, landedHeight: y, time: t + tau, apex, path };
    }
    s = next;
    steps++;
    t = steps * STEP;
    apex = Math.max(apex, s.y);
    if (steps % 2 === 0) path.push({ t, x: s.x, y: s.y });
  }
  return { landed: s.x, landedHeight: slope * s.x, time: t, apex, path };
}

/** The shell's position `t` seconds into a flight, between the samples. */
export function positionAt(flight: Flight, t: number): { x: number; y: number } {
  const path = flight.path;
  if (t <= 0) return path[0];
  const last = path[path.length - 1];
  if (t >= last.t) return last;
  let i = Math.min(path.length - 2, Math.floor(t / SAMPLE_EVERY));
  while (i > 0 && path[i].t > t) i--;
  while (i < path.length - 2 && path[i + 1].t < t) i++;
  const a = path[i];
  const b = path[i + 1];
  const k = (t - a.t) / (b.t - a.t);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

const bestRanges = new Map<string, { range: number; elevation: number }>();

/** The greatest range over level ground and the elevation that reaches it, searched to 0.01°. */
export function bestRange(model: ModelId, gun: Gun, air: Air = { wind: 0 }): { range: number; elevation: number } {
  const key = `${model}/${gun.vacuumRange}/${gun.drag}/${air.wind}`;
  const known = bestRanges.get(key);
  if (known) return known;
  const found = searchBestRange(model, gun, air);
  bestRanges.set(key, found);
  return found;
}

function searchBestRange(model: ModelId, gun: Gun, air: Air) {
  const level = { distance: gun.vacuumRange, height: 0 };
  const rangeAt = (e: number) => fly(model, gun, e, level, air).landed;
  let lo = 15;
  let hi = 60;
  // Golden-section search: range against elevation has one peak.
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = hi - ratio * (hi - lo);
  let b = lo + ratio * (hi - lo);
  let ra = rangeAt(a);
  let rb = rangeAt(b);
  while (hi - lo > 0.01) {
    if (ra < rb) {
      lo = a;
      a = b;
      ra = rb;
      b = lo + ratio * (hi - lo);
      rb = rangeAt(b);
    } else {
      hi = b;
      b = a;
      rb = ra;
      a = hi - ratio * (hi - lo);
      ra = rangeAt(a);
    }
  }
  const elevation = (lo + hi) / 2;
  return { range: rangeAt(elevation), elevation };
}
