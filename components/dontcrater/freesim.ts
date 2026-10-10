import type { FreeFlight } from "@/lib/lander/freeflight";
import { isLost, type Setup } from "@/lib/lander/physics";
import { acceleration2d, advance2d, FINE_TURN_RATE, groundOf, judgeTouchdown, MAX_TILT, TURN_RATE, type Control2D, type GroundFn, type State2D, type Verdict } from "@/lib/lander/physics2d";
import { burnDeadline, holdOutcome, landingLines, type LandingLines, type Outcome, type StopPoint } from "@/lib/lander/solver";
import { bargeTarget, driftStop, flatTarget, flyAutopilot, impactPoint, stopPoint2d, type AutoResult, type Impact } from "@/lib/lander/solver2d";
import { footSlope, heightAt } from "@/lib/lander/terrain";
import { altLabel } from "./sim";

/*
 * One Free Flight, independent of React: throttle, rotation, side jets, refills, time warp,
 * callouts, the burn guide and landing assist (on the vertical part of the
 * thrust), the impact point, the drift stop and the flight recording. The
 * screen calls update() every frame and reacts to the events it returns.
 */

export type Sample2D = { t: number; alt: number; x: number; speed: number; vx: number; throttle: number; tilt: number };

export type FreeEvent =
  | { kind: "touchdown"; verdict: Verdict; fuel: number; t: number }
  | { kind: "lost" }
  | { kind: "callout"; label: string; high: boolean }
  | { kind: "late" }
  | { kind: "fuel-low" }
  | { kind: "fuel-out"; hopeless: boolean }
  | { kind: "refill"; count: number }
  | { kind: "climbing" }
  | { kind: "slope-ahead" }
  | { kind: "lean" };

const CALLOUTS = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
/** A tank this close to empty is empty: rounding can leave a crumb that would push for nothing through a whole frame. */
const EMPTY = 1e-6;

export class FreeSim {
  state: State2D;
  readonly setup: Setup;
  readonly ground: GroundFn;
  lever = 0;
  hold = false;
  /** Rotation input: −1 (nose left), 0, +1 (nose right); `fine` for 20°/s; `level` while U is held. */
  turn = 0;
  fine = false;
  level = false;
  /** Side jets: −1 pushes left, 0 off, +1 pushes right. */
  jets = 0;
  autoWarp = true;
  warp = 1;
  guide: boolean;
  assist = false;
  assistUsed = false;
  scan = false;
  scanUsed = false;
  /** Vertical stop point, heights above the ground under the lander. */
  stop: StopPoint | null = null;
  /** When leaning far over: would the brake still work standing up? (Then the lean is the problem, not the timing.) */
  leanBlocks = false;
  lines: LandingLines | null = null;
  outcome: Outcome = null;
  impact: Impact | null = null;
  /** Sideways distance (km, signed) before the drift dies at this throttle and tilt, while pushing against it. */
  driftStop: number | null = null;
  samples: Sample2D[] = [];
  /** The all-knowing autopilot's flight to the planner's flat: the recorder's "perfect" line. */
  ideal: AutoResult;
  done = false;
  verdict: Verdict | null = null;
  /** Largest sideways speed killed so far (for the Sidewinder badge). */
  driftKilled = 0;
  /** Unlimited fuel: how many times the tank has been filled again. */
  refills = 0;
  private deadline = Infinity;
  private deadlineAge = 99;
  private impactAge = 99;
  private nextSample = 0;
  private callout = 0;
  private fuelLow = false;
  private fuelOut = false;
  private lateAge = 99;
  private idleFor = 0;
  private lastThrottle = 0;
  private climbSaid = false;
  private slopeSaid = false;
  private peakDrift: number;

  constructor(readonly flight: FreeFlight, guide: boolean) {
    this.setup = flight.setup;
    this.state = { ...flight.state };
    this.ground = groundOf(flight.site);
    this.guide = guide;
    const { site, plan } = flight;
    const target = site.kind === "sea" ? bargeTarget(site, plan.index) : flatTarget(plan.spot);
    this.ideal = flyAutopilot(this.setup, site, this.state, target, {}, true);
    this.peakDrift = Math.abs(this.state.vx);
    const agl = this.above;
    while (this.callout < CALLOUTS.length && CALLOUTS[this.callout] >= agl) this.callout++;
    this.record(0);
    this.refresh(1, true);
  }

  /** Height above the ground right under the lander (km). */
  get above() {
    return this.state.alt - this.ground(this.state.x, this.state.t);
  }

  get groundHere() {
    return this.ground(this.state.x, this.state.t);
  }

  get throttle() {
    if (this.done || this.state.fuel <= 0) return 0;
    return this.hold ? 100 : this.lever;
  }

  get control(): Control2D {
    return { throttle: this.throttle, turn: this.turn * (this.fine ? FINE_TURN_RATE : TURN_RATE), level: this.level, jets: this.done ? 0 : this.jets };
  }

  /** Seconds of free fall left before a full burn can't stop you (cached). */
  get burnIn() {
    return this.deadline;
  }

  /** Out of fuel with a long way to fall: the ending is already decided. */
  get hopeless() {
    const s = this.state;
    return s.fuel <= 0 && (this.above > 1 || s.speed < 0 || s.speed > 60);
  }

  private record(throttle: number) {
    const s = this.state;
    this.samples.push({ t: s.t, alt: this.above, x: s.x, speed: s.speed, vx: s.vx, throttle, tilt: s.tilt });
  }

  update(dtReal: number): FreeEvent[] {
    const events: FreeEvent[] = [];
    if (this.done) return events;
    const throttle = this.throttle;
    this.idleFor = throttle === this.lastThrottle && this.turn === 0 && this.jets === 0 ? this.idleFor + dtReal : 0;
    this.lastThrottle = throttle;
    this.updateWarp(dtReal, throttle);
    const seconds = dtReal * this.warp;
    const fuelBefore = this.state.fuel;
    const before = this.above;
    const r = this.advance(seconds, events);
    this.state = r.state;
    this.driftKilled = Math.max(this.driftKilled, this.peakDrift - Math.abs(this.state.vx));
    this.peakDrift = Math.max(this.peakDrift, Math.abs(this.state.vx));
    const agl = this.above;

    if (this.state.t >= this.nextSample || r.touchdown) {
      this.record(throttle);
      this.nextSample = this.state.t + 0.5;
    }

    while (this.callout < CALLOUTS.length && agl < CALLOUTS[this.callout] && before >= CALLOUTS[this.callout]) {
      const km = CALLOUTS[this.callout];
      events.push({ kind: "callout", label: altLabel(km), high: km < 0.1 });
      this.callout++;
    }
    while (this.callout < CALLOUTS.length && agl < CALLOUTS[this.callout]) this.callout++;

    if (!this.fuelLow && this.state.fuel < this.setup.fuel * 0.1 && this.state.fuel > 0) {
      this.fuelLow = true;
      events.push({ kind: "fuel-low" });
    }
    if (!this.fuelOut && fuelBefore > 0 && this.state.fuel <= 0) {
      this.fuelOut = true;
      events.push({ kind: "fuel-out", hopeless: this.hopeless });
    }

    if (r.touchdown) {
      this.done = true;
      this.verdict = judgeTouchdown(this.flight.site, r.touchdown);
      events.push({ kind: "touchdown", verdict: this.verdict, fuel: r.touchdown.fuel, t: r.touchdown.t });
      return events;
    }
    if (isLost(this.setup, this.state)) {
      this.done = true;
      events.push({ kind: "lost" });
      return events;
    }

    this.refresh(dtReal, false);
    if (this.state.speed < -30 && throttle > 0 && !this.climbSaid) {
      this.climbSaid = true;
      events.push({ kind: "climbing" });
    }
    if (this.state.speed > 0) this.climbSaid = false;
    this.lateAge += dtReal;
    if (this.guide && this.stop && !this.stop.stops && (throttle < 95 || this.leanBlocks) && this.lateAge > (this.leanBlocks ? 2.5 : 1.6) && this.state.speed > 0 && this.state.fuel > 0) {
      this.lateAge = 0;
      events.push({ kind: this.leanBlocks ? "lean" : "late" });
    }
    // Heading for rough ground with little time left.
    const slope = this.impactSlope;
    if (!this.slopeSaid && slope !== null && slope > 8 && this.impact && this.impact.t - this.state.t < 6 && agl < 0.3) {
      this.slopeSaid = true;
      events.push({ kind: "slope-ahead" });
    }
    if (slope !== null && slope <= 8) this.slopeSaid = false;
    return events;
  }

  /** Unlimited fuel: tanks used so far, the one in use included (2.4 = two refills and 40% of the third). */
  get tanksUsed() {
    return this.refills + 1 - this.state.fuel / this.setup.fuel;
  }

  /**
   * Advances the flight. On unlimited fuel the tank is filled again at the
   * moment it runs dry, so the engine and the jets never miss a beat.
   */
  private advance(seconds: number, events: FreeEvent[]) {
    if (!this.flight.unlimited) return advance2d(this.setup, this.state, this.control, seconds, this.ground);
    let from = this.state;
    let left = seconds;
    for (;;) {
      if (from.fuel <= EMPTY) from = this.refill(from, events);
      const r = advance2d(this.setup, from, this.control, left, this.ground);
      if (r.fuelOutAt === undefined || (r.touchdown && r.touchdown.t <= r.fuelOutAt)) {
        return r.touchdown || r.state.fuel > EMPTY ? r : { ...r, state: this.refill(r.state, events) };
      }
      // Run again only up to the moment it ran dry; the top of the loop fills it.
      const dry = advance2d(this.setup, from, this.control, r.fuelOutAt - from.t, this.ground);
      if (dry.touchdown) return dry;
      left -= dry.state.t - from.t;
      from = { ...dry.state, fuel: 0 };
    }
  }

  private refill(s: State2D, events: FreeEvent[]): State2D {
    this.refills++;
    this.fuelLow = false;
    events.push({ kind: "refill", count: this.refills });
    return { ...s, fuel: this.setup.fuel };
  }

  /** The steepest ground under the feet where the path meets the ground (degrees). */
  get impactSlope() {
    if (!this.impact) return null;
    const site = this.flight.site;
    return Math.max(footSlope(site, this.impact.x - 0.004, this.impact.t), footSlope(site, this.impact.x + 0.004, this.impact.t));
  }

  private refresh(dtReal: number, first: boolean) {
    // On unlimited fuel the guides fly a full tank: a refill is always coming, and the heavier lander errs on the safe side.
    const s = this.flight.unlimited ? { ...this.state, fuel: this.setup.fuel } : this.state;
    const g = this.groundHere;
    // The burn guide and the assist use the vertical part of the thrust at the current tilt.
    this.stop = stopPoint2d(this.setup, s, g, this.above < 5 ? 0.05 : 0.1);
    this.leanBlocks = false;
    if (!this.stop.stops && Math.abs(s.tilt) > 15 && s.speed > 0) {
      const up = stopPoint2d(this.setup, { ...s, tilt: 0 }, g, this.above < 5 ? 0.05 : 0.1);
      this.leanBlocks = up.stops && up.alt > 0;
    }
    const upright = this.upright();
    const flat = { t: s.t, alt: s.alt - g, speed: s.speed, fuel: s.fuel };
    if (this.assist) {
      this.assistUsed = true;
      this.lines = landingLines(upright, flat);
      this.outcome = flat.alt < 2 && s.speed > 0 ? holdOutcome(upright, flat, this.throttle) : null;
    } else {
      this.lines = null;
      this.outcome = null;
    }
    if (this.scan) this.scanUsed = true;
    this.impactAge += dtReal;
    if (first || this.impactAge > (this.above < 3 ? 0 : 0.2)) {
      this.impactAge = 0;
      this.impact = impactPoint(this.setup, this.flight.site, s, this.throttle);
    }
    const push = acceleration2d(this.setup, s, this.throttle, this.jets).ax;
    this.driftStop = push * s.vx < 0 ? driftStop(this.setup, s, this.throttle, s.tilt, this.jets) : null;
    this.deadlineAge += dtReal;
    if (first || this.deadlineAge > 0.25) {
      this.deadlineAge = 0;
      this.deadline = this.stop && this.stop.stops ? burnDeadline(upright, flat) : 0;
    }
  }

  /** The same lander as a 1D one, with only the vertical part of its thrust. */
  private upright(): Setup {
    const cos = Math.max(0, Math.cos((this.state.tilt * Math.PI) / 180));
    return { ...this.setup, world: { ...this.setup.world, thrust: this.setup.world.thrust * cos } };
  }

  /** Fast when nothing can happen soon, real time when it can. */
  private updateWarp(dtReal: number, throttle: number) {
    const s = this.state;
    const agl = this.above;
    let target = 1;
    if (this.autoWarp && this.hopeless) target = agl > 20 ? 128 : 32;
    else if (this.autoWarp) {
      const descent = Math.max(1e-6, s.speed / 3200);
      const impact = s.speed > 0 ? agl / descent : Infinity;
      const decide = this.deadline > 0.4 ? this.deadline : Infinity;
      target = Math.min(decide / 4, impact / 8);
      if (throttle > 0 || this.turn !== 0 || this.jets !== 0) target = Math.min(target, agl > 40 ? 8 : agl > 8 ? 4 : 2);
      // The last 2.5 km in real time; only a long, hands-off, drift-free fall is sped up, gently.
      if (agl < 2.5) target = throttle === 0 && this.idleFor > 4 && impact > 40 && Math.abs(s.vx) < 15 ? Math.min(4, impact / 20) : 1;
      if (this.stop && !this.stop.stops && s.speed > 0) target = 1;
      // Heading for a slope with little time to fix it: real time.
      const slope = this.impactSlope;
      if (this.impact && slope !== null && slope > 8 && this.impact.t - s.t < 10) target = 1;
      target = Math.max(1, Math.min(16, target));
      if (agl < 0.03 && s.speed > -5) target = 0.5;
    }
    const k = Math.min(1, dtReal * (target < this.warp ? 8 : 2));
    this.warp += (target - this.warp) * k;
    if (Math.abs(this.warp - target) < 0.02) this.warp = target;
  }

  /** The ground's height (m) at x now, for the screen. */
  heightAt(x: number) {
    return heightAt(this.flight.site, x, this.state.t);
  }
}

export { MAX_TILT };
