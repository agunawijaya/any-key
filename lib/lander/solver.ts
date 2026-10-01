import { advance, gravityAt, hoverThrottle, SECONDS_PER_HOUR_1979, type FlightState, type Setup } from "./physics";
import { DRY_MASS } from "./worlds";

/*
 * The fuel-cheapest way down is a "hoverslam": fall freely for as long as you
 * dare, then burn at full power so the speed reaches zero exactly at the
 * ground. Everything here measures a flight against that ideal.
 */

export type StopPoint = { stops: true; alt: number; t: number } | { stops: false; impact: number; t: number };

/** Where a full burn starting now would bring the lander to a halt. */
export function stopPoint(setup: Setup, state: FlightState, dt = 0.1): StopPoint {
  let s = state;
  if (s.speed <= 0) return { stops: true, alt: s.alt, t: 0 };
  for (let i = 0; i < 40_000; i++) {
    const r = advance(setup, s, 100, dt, dt);
    if (r.touchdown) return { stops: false, impact: r.touchdown.speed, t: r.state.t - state.t };
    if (r.state.speed <= 0) {
      // Interpolate the moment the speed crossed zero.
      const f = s.speed / (s.speed - r.state.speed);
      return { stops: true, alt: s.alt + (r.state.alt - s.alt) * f, t: s.t + dt * f - state.t };
    }
    s = r.state;
  }
  return { stops: false, impact: s.speed, t: s.t - state.t };
}

/** Coasts without thrust for `seconds` (or until the ground). */
export function coast(setup: Setup, state: FlightState, seconds: number, dt = 0.25) {
  return advance(setup, state, 0, seconds, dt);
}

/** Seconds of free fall left before a full burn can no longer stop you in time (0 = burn now or it's too late). */
export function burnDeadline(setup: Setup, state: FlightState): number {
  const now = stopPoint(setup, state);
  if (!now.stops || now.alt <= 0) return 0;
  // Upper bound: the time it takes to fall to the ground without burning.
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const c = coast(setup, state, hi);
    if (c.touchdown) break;
    hi *= 2;
  }
  let lo = 0;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    const c = coast(setup, state, mid);
    const ok = !c.touchdown && (() => {
      const p = stopPoint(setup, c.state, 0.2);
      return p.stops && p.alt > 0;
    })();
    if (ok) lo = mid;
    else hi = mid;
  }
  return lo;
}

export type IdealPlan = {
  coastSeconds: number;
  burnStartAlt: number;
  fuelLeft: number;
  duration: number;
  /** Altitude and speed every second, for the flight recorder. */
  path: { t: number; alt: number; speed: number; throttle: number }[];
  possible: boolean;
};

/** The perfect hoverslam from the start of a flight. */
export function idealPlan(setup: Setup, start: FlightState): IdealPlan {
  const tau = burnDeadline(setup, start);
  const path: IdealPlan["path"] = [];
  let s = start;
  let throttle = 0;
  const possible = tau > 0 || (() => {
    const p = stopPoint(setup, start);
    return p.stops && p.alt >= 0;
  })();
  let burnStartAlt = start.alt;
  for (let i = 0; i < 20_000; i++) {
    path.push({ t: s.t, alt: s.alt, speed: s.speed, throttle });
    if (throttle === 0 && s.t >= start.t + tau - 1e-6) {
      throttle = 100;
      burnStartAlt = s.alt;
    }
    const step = throttle === 0 ? Math.max(1e-3, Math.min(1, start.t + tau - s.t)) : 1;
    const r = advance(setup, s, throttle, step);
    s = r.state;
    if (r.touchdown || s.speed <= 0) {
      path.push({ t: s.t, alt: Math.max(0, s.alt), speed: Math.max(0, s.speed), throttle });
      break;
    }
  }
  return { coastSeconds: tau, burnStartAlt, fuelLeft: s.fuel, duration: s.t - start.t, path, possible };
}

/* ---------- Landing assist ---------- */

/** The assist plans on braking at this throttle, leaving the rest for corrections. */
export const ASSIST_THROTTLE = 85;
/** The soft line aims a little under 5 km/h and allows a second to see it and react. */
const SOFT_TARGET = 4;
const REACTION_S = 1;

export type LandingLines = {
  /** Soft line: lowest height (km) from which braking at the planned throttle lands at 5 km/h or less. */
  five: number | null;
  /** Limit line: lowest height from which even full power lands at 20 km/h or less. Below it, you crash. */
  twenty: number | null;
  /** A soft landing now needs full power: the soft line comes from a full-power plan. */
  strained: boolean;
};

/**
 * Distance (km) needed to slow from the current speed to 20 km/h and to the soft
 * target at a steady throttle, braking down to the ground. `from` is the height
 * the braking starts at, so gravity can follow the height along the way.
 */
function brakingPass(setup: Setup, state: FlightState, throttle: number, from: number) {
  const out: { five: number | null; twenty: number | null } = { five: null, twenty: null };
  if (state.speed <= 20) out.twenty = 0;
  if (state.speed <= SOFT_TARGET) out.five = 0;
  if (out.five !== null) return out;
  const mass = DRY_MASS + setup.cargo;
  let v = state.speed;
  let fuel = state.fuel;
  let d = 0;
  for (let i = 0; i < 400_000; i++) {
    const dt = v > 300 ? 0.05 : 0.01;
    const burn = fuel > 0 ? Math.min(throttle, fuel / dt) : 0;
    const next = Math.max(0, fuel - burn * dt);
    const guess = (v * dt) / SECONDS_PER_HOUR_1979;
    const g = gravityAt(setup.world, Math.max(0, from - d - guess / 2));
    const a = g - (burn * setup.world.thrust) / (mass + (fuel + next) / 2);
    const v2 = v + a * dt;
    const step = ((v + v2) / 2) * (dt / SECONDS_PER_HOUR_1979);
    for (const [key, s] of [["twenty", 20], ["five", SOFT_TARGET]] as const) {
      if (out[key] === null && v > s && v2 <= s) out[key] = d + step * ((v - s) / (v - v2));
    }
    d += step;
    v = v2;
    fuel = next;
    if (out.five !== null || (a >= 0 && fuel <= 0)) break;
  }
  return out;
}

/** Two passes: the first finds roughly where braking must start, the second follows gravity down from there. */
function brakingDistances(setup: Setup, state: FlightState, throttle: number) {
  const first = brakingPass(setup, state, throttle, state.alt);
  const refine = (key: "five" | "twenty") => {
    const d = first[key];
    if (d === null || d === 0) return d;
    return brakingPass(setup, state, throttle, d)[key];
  };
  return { five: refine("five"), twenty: refine("twenty") };
}

/**
 * The landing assist's two lines, for where the lander is right now:
 *   - the soft (green) line: stay above it and braking at 85% brings you down at 5 km/h or less;
 *   - the limit (amber) line: below it, even full power can't get you under 20 km/h.
 * Between the two you can still walk away, but only by braking harder than planned.
 */
export function landingLines(setup: Setup, state: FlightState): LandingLines {
  if (state.speed <= 0) return { five: 0, twenty: 0, strained: false };
  const planned = brakingDistances(setup, state, ASSIST_THROTTLE);
  const full = brakingDistances(setup, state, 100);
  // The distance covered while you react is added to the soft line (not to the hard limit).
  const react = state.speed > SOFT_TARGET ? (state.speed * REACTION_S) / SECONDS_PER_HOUR_1979 : 0;
  if (planned.five !== null) return { five: planned.five + react, twenty: full.twenty, strained: false };
  return { five: full.five === null ? null : full.five + react, twenty: full.twenty, strained: true };
}

export type Outcome = { lands: number } | { stops: number } | null;

/** If you hold this throttle: the touchdown speed, or the height where you'd stop. Looks ahead up to a minute. */
export function holdOutcome(setup: Setup, state: FlightState, throttle: number): Outcome {
  let s = state;
  for (let i = 0; i < 600; i++) {
    const r = advance(setup, s, throttle, 0.1, 0.02);
    if (r.touchdown) return { lands: r.touchdown.speed };
    if (s.speed > 0 && r.state.speed <= 0) return { stops: r.state.alt };
    s = r.state;
  }
  return null;
}

/* ---------- The last stretch ---------- */

export type Approach = { target: number; brake: number; verdict: "fast" | "ok" | "slow" };

/** The final approach: below 60 m, or already slow and within 2 km of the ground. */
export function inFinalApproach(state: FlightState) {
  return state.alt < 2 && (state.alt < 0.06 || state.speed < 40);
}

/**
 * Close to the ground the lines squeeze together and what matters is speed. A
 * comfortable target speed shrinks with height (about 150 km/h at 500 m, 32 at
 * 100 m, 8 at 20 m, 2 on the ground). "brake" is the throttle that gets you back
 * to the target within about a second and a half, rounded to tens for the number
 * keys (or to whole percent where hovering takes almost nothing).
 */
export function approachAdvice(setup: Setup, state: FlightState): Approach {
  const metres = Math.max(0, state.alt * 1000);
  const target = Math.max(2, Math.min(150, 2 + 0.3 * metres));
  const hover = hoverThrottle(setup, state);
  const perKmh = hover / Math.max(1e-9, gravityAt(setup.world, state.alt)); // throttle per km/h/s of push
  const wanted = hover + (Math.max(0, state.speed - target) / 1.5) * perKmh;
  // A round figure for number keys; on a world where hovering takes under 3% (Psyche), a fine one.
  const brake = wanted >= 95 ? 100 : hover < 3 ? Math.max(1, Math.ceil(wanted + 0.5)) : Math.min(100, Math.max(10, Math.ceil((wanted + 3) / 10) * 10));
  const verdict = state.speed > target + 1 ? "fast" : state.speed < target - 3 ? "slow" : "ok";
  return { target, brake, verdict };
}
