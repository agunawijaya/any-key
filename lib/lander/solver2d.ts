import { gravityAt, SECONDS_PER_HOUR_1979, type Setup } from "./physics";
import { advance2d, groundOf, judgeTouchdown, MAX_TILT, sideJets, type Control2D, type State2D, type Verdict } from "./physics2d";
import { stopPoint, type StopPoint } from "./solver";
import { bargeTilt, bargeX, heightAt, type Flat, type Site } from "./terrain";
import { DRY_MASS } from "./worlds";

/*
 * The Free Flight solver: the burn guide's stop point for a leaning lander,
 * how far the drift carries you before it dies, where the path meets the
 * ground, and an autopilot that knows everything. The autopilot is the
 * "perfect pilot": it sets the fuel budget, proves each site fair and draws the
 * perfect path in the flight recorder. The game's human-pilot tests fly
 * without its knowledge.
 */

const K = SECONDS_PER_HOUR_1979;
const DEG = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Height above the ground right under the lander (km). */
export function heightAbove(site: Site, s: State2D) {
  return s.alt - heightAt(site, s.x, s.t) / 1000;
}

/**
 * The burn guide for a leaning lander: where a full burn would bring the
 * vertical speed to zero, using only the vertical part of the thrust at the
 * current tilt. Heights are above `groundKm`.
 */
export function stopPoint2d(setup: Setup, s: State2D, groundKm: number, dt = 0.1): StopPoint {
  const cos = Math.max(0, Math.cos(s.tilt * DEG));
  const upright = { ...setup, world: { ...setup.world, thrust: setup.world.thrust * cos } };
  return stopPoint(upright, { t: s.t, alt: s.alt - groundKm, speed: s.speed, fuel: s.fuel }, dt);
}

/**
 * How far sideways (km, signed) the lander goes before its drift dies, at
 * this throttle and tilt, with the side jets as they are (−1, 0 or +1). Null
 * when that push doesn't work against the drift or the tank runs dry first.
 */
export function driftStop(setup: Setup, s: State2D, throttle: number, tilt: number, jets = 0): number | null {
  const dir = Math.sign(s.vx);
  if (!dir) return 0;
  const sin = Math.sin(tilt * DEG);
  if (s.fuel <= 0) return null;
  if (!jets && (sin * dir > -1e-4 || throttle <= 0)) return null;
  let vx = s.vx;
  let fuel = s.fuel;
  let d = 0;
  for (let i = 0; i < 40_000; i++) {
    const dt = 0.05;
    const burn = fuel > 0 ? Math.min(throttle, fuel / dt) : 0;
    const side = sideJets(setup, jets, fuel, fuel - burn * dt, dt);
    if (burn + side.burn <= 0) return null;
    const next = Math.max(0, fuel - (burn + side.burn) * dt);
    const ax = ((burn * setup.world.thrust) / (DRY_MASS + setup.cargo + (fuel + next) / 2)) * sin + side.push;
    // With the jets on, the sum must still be braking (a lean with the drift can outdo them).
    if (jets && ax * dir >= 0) return null;
    const v2 = vx + ax * dt;
    if (Math.sign(v2) !== dir) {
      const f = vx / (vx - v2);
      return d + ((vx / 2) * f * dt) / K;
    }
    d += (((vx + v2) / 2) * dt) / K;
    vx = v2;
    fuel = next;
  }
  return null;
}

/** The shortest drift stop there is: full power, leaning as far as it goes against the drift. */
export function minDriftStop(setup: Setup, s: State2D) {
  return driftStop(setup, s, 100, -Math.sign(s.vx) * MAX_TILT);
}

/** Where the path meets the ground, and the path on the way there as [x, alt] pairs (km). */
export type Impact = { x: number; t: number; speed: number; vx: number; path: [number, number][] };

/** Where the path meets the ground if the throttle and tilt stay as they are (looking ahead up to `horizon` seconds). */
export function impactPoint(setup: Setup, site: Site, s: State2D, throttle: number, horizon = 400): Impact | null {
  const ground = groundOf(site);
  let st = s;
  const path: [number, number][] = [[s.x, s.alt]];
  for (let i = 0; i < 3000 && st.t - s.t < horizon; i++) {
    const above = Math.max(0.001, st.alt - ground(st.x, st.t));
    const h = clamp(((above * K) / (Math.abs(st.speed) + 8)) * 0.06, 0.02, 2);
    const r = advance2d(setup, st, { throttle }, h, ground, h);
    path.push([r.state.x, r.state.alt]);
    if (r.touchdown) return { x: r.touchdown.x, t: r.touchdown.t, speed: r.touchdown.speed, vx: r.touchdown.vx, path };
    st = r.state;
    if (st.fuel <= 0 && throttle > 0) throttle = 0;
  }
  return null;
}

/* ---------- The autopilot ---------- */

/** A landing target at time t: centre (km), sideways speed (km/h, for drifting barges), slope and half-width (m). */
export type Target = { x: number; drift: number; slope: number; half: number };
export type TargetFn = (t: number) => Target;

export function flatTarget(f: Flat): TargetFn {
  const tgt = { x: (f.x0 + f.x1) / 2, drift: 0, slope: f.slope, half: ((f.x1 - f.x0) * 1000) / 2 };
  return () => tgt;
}

export function bargeTarget(site: Site, index: number): TargetFn {
  const b = site.barges[index];
  return (t) => ({ x: bargeX(b, t), drift: b.drift, slope: bargeTilt(b, t), half: b.half });
}

export type AutoOptions = {
  /** Height above the target (km) where the main brake should end, and the speed there (km/h). */
  gate?: number;
  gateSpeed?: number;
  /** Target descent speed in the last stretch: base + per-metre (km/h). */
  touch?: number;
  perMetre?: number;
  /** Largest tilt while braking high up and while manoeuvring low down. */
  brakeTilt?: number;
  lowTilt?: number;
};

type Memory = { phase: "high" | "low"; braking: boolean };


/** Highest ground (km) between two points, with a margin either side for the lander's legs. */
function highestBetween(site: Site, a: number, b: number, t: number) {
  const lo = Math.min(a, b) - 0.012;
  const hi = Math.max(a, b) + 0.012;
  const n = Math.min(40, Math.max(4, Math.ceil((hi - lo) / 0.008)));
  let top = -Infinity;
  for (let i = 0; i <= n; i++) top = Math.max(top, heightAt(site, lo + ((hi - lo) * i) / n, t));
  return top / 1000;
}

/**
 * An autopilot that knows the whole site. High up it falls freely and then
 * brakes at full power (a hoverslam), leaning so the drift dies right above
 * the target; low down it steers to the target at a safe height above the
 * rocks, then comes straight down onto it. Returns the throttle and the tilt
 * it wants; the caller turns towards that tilt at the lander's rotation rate.
 */
export function autopilot(setup: Setup, site: Site, target: TargetFn, opts: AutoOptions = {}) {
  const gate = opts.gate ?? 0.25;
  const gateSpeed = opts.gateSpeed ?? 40;
  const touch = opts.touch ?? 1.0;
  const perMetre = opts.perMetre ?? 0.22;
  const brakeTilt = opts.brakeTilt ?? 40;
  const lowTilt = opts.lowTilt ?? 70;
  const mem: Memory = { phase: "high", braking: false };
  let started = false;

  return (s: State2D): { throttle: number; tilt: number; soon?: number } => {
    if (!started) {
      started = true;
      mem.phase = s.speed > 400 ? "high" : "low";
    }
    const T = target(s.t);
    const g = gravityAt(setup.world, s.alt);
    const mass = DRY_MASS + setup.cargo + s.fuel;
    const a1 = setup.world.thrust / mass;
    const amax = 100 * a1;
    const groundT = heightAt(site, T.x, s.t) / 1000;
    const hT = s.alt - groundT;
    const rel = s.vx - T.drift;
    const ex = (T.x - s.x) * K;

    if (mem.phase === "high" && (s.speed <= gateSpeed || hT < gate * 0.6)) mem.phase = "low";

    if (mem.phase === "high") {
      // The main brake is a retrograde burn: full power, pushing straight against the motion
      // (relative to the target), so the drift and the fall die away together.
      const retro = clamp(-Math.atan2(rel, Math.max(1, s.speed)) / DEG, -brakeTilt, brakeTilt);
      const p = stopPoint2d(setup, { ...s, tilt: retro }, groundT, hT > 20 ? 0.5 : 0.25);
      const stopAlt = p.stops ? p.alt : -1;
      const tb = p.stops ? p.t : s.speed / Math.max(1, amax - g);
      const margin = stopAlt - gate;
      if (!mem.braking && margin <= 0) mem.braking = true;
      if (mem.braking && margin > 3 + hT * 0.2) mem.braking = false;
      // Free fall left before the burn (the fall speeds up with gravity), and where the whole
      // descent would put you relative to the target (km): during the burn the drift dies evenly.
      const drop = Math.max(0, margin) * K;
      const coast = mem.braking ? 0 : (-s.speed + Math.sqrt(s.speed * s.speed + 2 * g * drop)) / Math.max(1e-6, g);
      const miss = ex / K - (rel * (coast + tb / 2)) / K;
      if (!mem.braking) {
        // Early on, a sideways nudge is cheap: change the drift so the landing point moves onto the target.
        if (coast > 12 && Math.abs(miss) > 0.02) {
          const dv = (miss * K) / (coast + tb / 2);
          const want = Math.sign(dv) * 75;
          const aligned = Math.abs(s.tilt - want) < 8;
          const throttle = aligned ? clamp(Math.abs(dv) / 1.5 / (a1 * Math.sin(75 * DEG)), 0, 100) : 0;
          return { throttle, tilt: want, soon: Math.max(0.5, coast - 12) };
        }
        return { throttle: 0, tilt: retro, soon: coast };
      }
      // Braking: retrograde, trimmed so the remaining drift carries you onto the target.
      const trim = tb > 5 ? clamp(Math.asin(clamp((2 * miss * K) / (tb * tb) / amax, -1, 1)) / DEG, -12, 12) : 0;
      return { throttle: 100, tilt: clamp(retro + trim, -brakeTilt, brakeTilt), soon: Infinity };
    }

    // Low down: steer to the target at a safe height, then straight down onto it.
    const dxm = (T.x - s.x) * 1000;
    const dist = Math.abs(dxm);
    const over = dist < Math.max(1.2, T.half - 5.5);
    const prof = (m: number) => Math.min(150, touch + perMetre * Math.max(0, m));
    let vWant: number;
    if (over && Math.abs(rel) < 8) vWant = prof(hT * 1000);
    else {
      // Keep clear of everything between here and the target.
      const ahead = s.x + Math.sign(dxm) * Math.min(dist / 1000, 0.4);
      const top = highestBetween(site, s.x, ahead, s.t);
      const clearM = (s.alt - Math.max(top, groundT)) * 1000;
      const cruise = clamp(dist * 0.22, 14, 450);
      vWant = clearM > cruise ? prof(clearM - cruise + 10) : -Math.min(60, (cruise - clearM) * 0.6);
    }
    const ay = g + (s.speed - vWant) / 1.0;
    const fy = Math.max(0, ay);
    // Sideways: a braking curve sized to what leaning gives while roughly holding the height.
    const hold = Math.max(g, 0.6);
    const aH = clamp(0.4 * Math.min(amax * Math.sin(lowTilt * DEG), 1.5 * hold * Math.tan(lowTilt * DEG)), 0.15, 14);
    const vxWant = T.drift + Math.sign(dxm) * Math.min(160, 0.8 * Math.sqrt(2 * aH * (dist / 1000) * K));
    const ax = (vxWant - s.vx) / 2;
    // Over the target: nearly upright; in the last few metres, stand up to the ground's slope.
    const lean = over ? 15 : lowTilt;
    let lo = -lean;
    let hi = lean;
    if (hT < 0.02) {
      lo = T.slope - 4;
      hi = T.slope + 4;
    }
    // Point the engine at the wanted push, within the lean limits, and size it to fit that push best.
    const tilt = clamp(Math.atan2(ax, fy) / DEG, lo, hi);
    const push = clamp(ax * Math.sin(tilt * DEG) + fy * Math.cos(tilt * DEG), 0, amax);
    return { throttle: push / a1, tilt };
  };
}

/** Turns a wanted tilt into a rotation command for the next `step` seconds. */
export function turnTowards(tilt: number, want: number, step: number, rate = 60) {
  return clamp((want - tilt) / Math.max(step, 1e-3), -rate, rate);
}

export type AutoResult = { verdict: Verdict | null; state: State2D; fuelLeft: number; path: { t: number; alt: number; x: number; speed: number; vx: number; throttle: number; tilt: number }[] };

/** Flies the autopilot to the target and judges the touchdown. */
export function flyAutopilot(setup: Setup, site: Site, start: State2D, target: TargetFn, opts: AutoOptions = {}, record = false): AutoResult {
  const ground = groundOf(site);
  const pilot = autopilot(setup, site, target, opts);
  let s = start;
  const path: AutoResult["path"] = [];
  let lastRec = -Infinity;
  for (let i = 0; i < 40_000; i++) {
    const want = pilot(s);
    const above = s.alt - ground(s.x, s.t);
    // Big steps while nothing is close, small ones near the ground or the burn.
    let step = above > 20 && want.throttle === 0 && s.speed > 0 ? clamp(((above - 8) * K) / s.speed / 40, 0.1, 1) : above > 8 ? 0.4 : above > 0.3 ? 0.15 : above > 0.05 ? 0.08 : 0.05;
    if (want.soon !== undefined) step = clamp(Math.min(step, want.soon / 4), 0.02, 1);
    const c: Control2D = { throttle: want.throttle, turn: turnTowards(s.tilt, want.tilt, step) };
    if (record && s.t - lastRec >= 1) {
      path.push({ t: s.t, alt: s.alt, x: s.x, speed: s.speed, vx: s.vx, throttle: c.throttle, tilt: s.tilt });
      lastRec = s.t;
    }
    const r = advance2d(setup, s, c, step, ground, Math.min(0.02, step));
    s = r.state;
    if (r.touchdown) {
      if (record) path.push({ t: s.t, alt: s.alt, x: s.x, speed: s.speed, vx: s.vx, throttle: c.throttle, tilt: s.tilt });
      return { verdict: judgeTouchdown(site, r.touchdown), state: s, fuelLeft: r.touchdown.fuel, path };
    }
    if (s.t - start.t > 1500 || (s.speed < 0 && gravityAt(setup.world, s.alt) <= 0)) break;
  }
  return { verdict: null, state: s, fuelLeft: s.fuel, path };
}
