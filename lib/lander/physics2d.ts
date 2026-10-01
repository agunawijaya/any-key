import { gradeFor, GRADES, type GradeId } from "./grades";
import { gravityAt, SECONDS_PER_HOUR_1979, type FlightState, type Setup } from "./physics";
import { bargeUnder, flatUnder, footSlope, heightAt, isWater, type Site } from "./terrain";
import { DRY_MASS } from "./worlds";

/*
 * Free Flight: the 1979 flight model in two dimensions.
 *
 * The lander can lean (tilt, degrees, positive = nose to the right) and the
 * engine pushes along its axis:
 *
 *   vertical:   speed changes by   gravity − throttle × thrust / mass × cos(tilt)     km/h per s
 *   sideways:   vx changes by      throttle × thrust / mass × sin(tilt)               km/h per s
 *   height falls by speed / 3200 km every second, and x moves by vx / 3200 km:
 *   both axes use the program's own km/h → km/s conversion, so they share one geometry.
 *
 * Upright (tilt 0) this is exactly advance() in physics.ts, step for step.
 * Rotation is the reaction-control system: 60°/s (20°/s fine), free of fuel,
 * and the tilt holds when you let go. There is no air drag, as in the original.
 */

export const MAX_TILT = 75;
export const TURN_RATE = 60;
export const FINE_TURN_RATE = 20;
/** The footpads sit 4 m either side of the centre; the engine bell 1.6 m above them. */
export const FOOT_M = 4;
export const BELL_M = 1.6;
/** Standing rules. */
export const STAND_SLOPE = 8;
export const STAND_TILT_OFF = 10;
export const STAND_DRIFT = 6;

const DEG = Math.PI / 180;
const K = SECONDS_PER_HOUR_1979;

/** A Free Flight state: x (km, positive = right), vx (km/h, positive = right) and tilt (degrees). */
export type State2D = FlightState & { x: number; vx: number; tilt: number };

/** What the pilot is doing: throttle 0–100, a rotation rate (deg/s, positive = towards nose-right), or levelling. */
export type Control2D = { throttle: number; turn?: number; level?: boolean };

/** Ground height (km) at x (km) and time t (s). */
export type GroundFn = (xKm: number, t: number) => number;

export type Contact = { t: number; speed: number; vx: number; fuel: number; x: number; alt: number; tilt: number; by: "left" | "right" | "belly" };

export type Step2D = { state: State2D; touchdown?: Contact; fuelOutAt?: number };

const flatGround: GroundFn = () => 0;

export function groundOf(site: Site): GroundFn {
  return (x, t) => heightAt(site, x, t) / 1000;
}

/** Levelling (the U key) turns fast when far off and eases in: about half a second from any lean. */
export function levelRate(tilt: number) {
  return Math.max(30, Math.abs(tilt) * 6);
}

export function nextTilt(tilt: number, c: Control2D, h: number) {
  if (c.level) {
    const r = levelRate(tilt) * h;
    return Math.abs(tilt) <= r ? 0 : tilt - Math.sign(tilt) * r;
  }
  const t = tilt + (c.turn ?? 0) * h;
  return t > MAX_TILT ? MAX_TILT : t < -MAX_TILT ? -MAX_TILT : t;
}

/** The two feet and the engine bell in the world (km), for a lander whose feet-centre is at (x, alt). */
export function contactPoints(x: number, alt: number, tilt: number) {
  const c = Math.cos(tilt * DEG);
  const s = Math.sin(tilt * DEG);
  const f = FOOT_M / 1000;
  const b = BELL_M / 1000;
  return {
    left: { x: x - f * c, y: alt + f * s },
    right: { x: x + f * c, y: alt - f * s },
    belly: { x: x + b * s, y: alt + b * c },
  };
}

/** Height (km) of the lowest contact point above the ground under it, and which point that is. */
export function clearance(s: { x: number; alt: number; tilt: number; t: number }, ground: GroundFn) {
  const p = contactPoints(s.x, s.alt, s.tilt);
  const l = p.left.y - ground(p.left.x, s.t);
  const r = p.right.y - ground(p.right.x, s.t);
  const b = p.belly.y - ground(p.belly.x, s.t);
  if (b < l && b < r) return { gap: b, by: "belly" as const };
  return l <= r ? { gap: l, by: "left" as const } : { gap: r, by: "right" as const };
}

export function start2d(setup: Setup, extra: { x?: number; vx?: number; tilt?: number } = {}): State2D {
  return { t: 0, alt: setup.alt, speed: setup.speed, fuel: setup.fuel, x: extra.x ?? 0, vx: extra.vx ?? 0, tilt: extra.tilt ?? 0 };
}

/**
 * Advances a Free Flight by `seconds` with steady controls, in small steps
 * (mass, height and tilt taken at the middle of each step, as in advance()).
 * Stops exactly when a foot or the engine bell reaches the ground.
 * Without a ground function the ground is flat at height 0.
 */
export function advance2d(setup: Setup, from: State2D, control: Control2D, seconds: number, ground: GroundFn | null = null, dt = 0.02): Step2D {
  const g = ground ?? flatGround;
  let s = { ...from };
  let left = seconds;
  let fuelOutAt: number | undefined;
  const throttle = control.throttle;
  while (left > 1e-9) {
    const h = Math.min(dt, left);
    left -= h;
    const burn = s.fuel > 0 ? Math.min(throttle, s.fuel / h) : 0;
    const fuel = Math.max(0, s.fuel - burn * h);
    if (s.fuel > 0 && fuel === 0 && throttle > 0) fuelOutAt = s.t + h;
    const tilt = nextTilt(s.tilt, control, h);
    const mid = ((s.tilt + tilt) / 2) * DEG;
    const midAlt = s.alt - (s.speed * h) / 2 / K;
    const push = (burn * setup.world.thrust) / (DRY_MASS + setup.cargo + (s.fuel + fuel) / 2);
    const a = gravityAt(setup.world, midAlt) - push * Math.cos(mid);
    const ax = push * Math.sin(mid);
    const speed = s.speed + a * h;
    const alt = s.alt - ((s.speed + speed) / 2) * (h / K);
    const vx = s.vx + ax * h;
    const x = s.x + ((s.vx + vx) / 2) * (h / K);
    const next: State2D = { t: s.t + h, alt, speed, fuel, x, vx, tilt };
    const c = clearance(next, g);
    if (c.gap <= 0) {
      // Find the moment of contact inside this step (the motion in it has constant acceleration).
      const base = s;
      const at = (tau: number): State2D => ({
        t: base.t + tau,
        alt: base.alt - (base.speed * tau + (a * tau * tau) / 2) / K,
        speed: base.speed + a * tau,
        fuel: Math.max(0, base.fuel - burn * tau),
        x: base.x + (base.vx * tau + (ax * tau * tau) / 2) / K,
        vx: base.vx + ax * tau,
        tilt: nextTilt(base.tilt, control, tau),
      });
      let lo = 0;
      let hi = h;
      for (let i = 0; i < 60 && hi - lo > 1e-15; i++) {
        const mid2 = (lo + hi) / 2;
        if (clearance(at(mid2), g).gap > 0) lo = mid2;
        else hi = mid2;
      }
      const hit = at(hi);
      const by = clearance(hit, g).by;
      return { state: hit, touchdown: { t: hit.t, speed: hit.speed, vx: hit.vx, fuel: hit.fuel, x: hit.x, alt: hit.alt, tilt: hit.tilt, by }, fuelOutAt };
    }
    s = next;
  }
  return { state: s, fuelOutAt };
}

/** Acceleration now (km/h per s): vertical (positive = speeding up downwards) and sideways. */
export function acceleration2d(setup: Setup, s: State2D, throttle: number) {
  const push = s.fuel > 0 ? (throttle * setup.world.thrust) / (DRY_MASS + setup.cargo + s.fuel) : 0;
  return { a: gravityAt(setup.world, s.alt) - push * Math.cos(s.tilt * DEG), ax: push * Math.sin(s.tilt * DEG) };
}

/* ---------- Touchdown ---------- */

export type Verdict = {
  /** The ending: butter, smooth or bumpy when it stands; tipped or splash; otherwise a crash grade. */
  grade: GradeId;
  stands: boolean;
  /** Vertical and sideways speed at contact (km/h), and the two combined. */
  speed: number;
  drift: number;
  total: number;
  /** The ground's slope between the two feet (degrees) and the steepest ground under each foot. */
  slope: number;
  feet: [number, number];
  /** How far the lander's lean differed from the ground's slope. */
  tiltOff: number;
  water: boolean;
  /** The flat (or deck) under the lander: its width and how far from its centre you stood (m). */
  flat: { width: number; offset: number } | null;
  /** Why it didn't stand, in words. */
  reasons: string[];
};

/**
 * The lander stands when the ground under both feet slopes 8° or less, its
 * lean is within 10° of that ground, it slides sideways at 6 km/h or less and
 * the vertical speed is a landing on the usual scale. Otherwise it tips over,
 * or on Earth falls into the sea. Hard enough and it's the usual crash: a fast
 * landing on a slope is still a crater.
 */
export function judgeTouchdown(site: Site, c: Contact): Verdict {
  const t = c.t;
  const p = contactPoints(c.x, c.alt, c.tilt);
  const feet: [number, number] = [footSlope(site, p.left.x, t), footSlope(site, p.right.x, t)];
  const gl = heightAt(site, p.left.x, t);
  const gr = heightAt(site, p.right.x, t);
  const slope = Math.atan2(gr - gl, (p.right.x - p.left.x) * 1000) / DEG;
  // A drifting barge carries its own sideways speed.
  const barge = site.kind === "sea" ? bargeUnder(site, c.x, t) : null;
  const drift = c.vx - (barge?.drift ?? 0);
  const speed = c.speed;
  const total = Math.hypot(speed, drift);
  const tiltOff = Math.abs(c.tilt - slope);
  const water = isWater(site, c.x, t) || (site.kind === "sea" && !barge);
  // Settled on both feet, the ground between them must stay clear of the engine bell.
  const midGround = heightAt(site, c.x, t);
  const bellClear = midGround < (gl + gr) / 2 + BELL_M * 0.9;

  const reasons: string[] = [];
  if (water) reasons.push("that was the sea");
  else {
    if (c.by === "belly" || !bellClear) reasons.push("a rock under the engine");
    const side = feet[0] >= feet[1] ? "left" : "right";
    if (Math.max(...feet) > STAND_SLOPE) reasons.push(`${Math.round(Math.max(...feet))}° slope under the ${side} foot`);
    if (tiltOff > STAND_TILT_OFF) reasons.push(`leaning ${Math.round(tiltOff)}° off the ground`);
    if (Math.abs(drift) > STAND_DRIFT) reasons.push(`still sliding at ${Math.abs(drift).toFixed(0)} km/h`);
  }
  const landing = GRADES[gradeFor(speed)].landed && speed > -5;
  const stands = !reasons.length && landing;

  let grade: GradeId;
  if (stands) grade = gradeFor(speed);
  else if (water) grade = total < 45 ? "splash" : gradeFor(total);
  else grade = total < 20 ? "tipped" : gradeFor(total);

  const spot = flatUnder(site, c.x, t);
  const flat = spot ? { width: (spot.x1 - spot.x0) * 1000, offset: Math.abs(c.x - (spot.x0 + spot.x1) / 2) * 1000 } : null;
  return { grade, stands, speed, drift, total, slope, feet, tiltOff, water, flat, reasons };
}
