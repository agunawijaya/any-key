import { advance, isLost, startState, type FlightState, type Setup } from "@/lib/lander/physics";
import { burnDeadline, holdOutcome, idealPlan, landingLines, stopPoint, type IdealPlan, type LandingLines, type Outcome, type StopPoint } from "@/lib/lander/solver";

/*
 * One flight, independent of React: the throttle, time warp, callouts, the
 * burn guide and the flight recording. The screen calls update() every frame
 * and reacts to the events it returns.
 */

export type Sample = { t: number; alt: number; speed: number; throttle: number };

export type SimEvent =
  | { kind: "touchdown"; speed: number; fuel: number; t: number }
  | { kind: "lost" }
  | { kind: "callout"; label: string; high: boolean }
  | { kind: "late" }
  | { kind: "fuel-low" }
  | { kind: "fuel-out"; hopeless: boolean }
  | { kind: "too-early"; stopAlt: number }
  | { kind: "climbing" }
  | { kind: "turn-done" };

const CALLOUTS = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];
export const TURN_SECONDS = 10;

/** Ten-Second mode: what the next turn at this throttle would do. */
export function predictTurn(setup: Setup, from: FlightState, throttle: number) {
  const alts: number[] = [];
  let s = from;
  let touchdown: number | null = null;
  for (let i = 0; i < TURN_SECONDS; i++) {
    const r = advance(setup, s, throttle, 1);
    s = r.state;
    alts.push(s.alt);
    if (r.touchdown) {
      touchdown = r.touchdown.speed;
      break;
    }
  }
  const stop = touchdown === null ? stopPoint(setup, s, 0.1) : null;
  return { alts, after: s, touchdown, stop };
}

export function altLabel(km: number) {
  return km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m`;
}

export class FlightSim {
  state: FlightState;
  lever = 0;
  hold = false;
  autoWarp = true;
  warp = 1;
  stop: StopPoint | null = null;
  /** Landing assist, when switched on. */
  assist = false;
  assistUsed = false;
  lines: LandingLines | null = null;
  outcome: Outcome = null;
  samples: Sample[] = [];
  ideal: IdealPlan;
  done = false;
  /** Ten-Second mode: the throttle and end time of the turn being played out. */
  turn: { throttle: number; until: number; realSeconds: number } | null = null;
  turns = 0;
  private deadline = Infinity;
  private deadlineAge = 99;
  private nextSample = 0;
  private callout = 0;
  private fuelLow = false;
  private fuelOut = false;
  private lateAge = 99;
  private earlySaid = false;
  /** Real seconds since the throttle last changed (to tell a pilot at work from a long drift). */
  private idleFor = 0;
  private lastThrottle = 0;
  private climbSaid = false;

  constructor(
    readonly setup: Setup,
    readonly mode: "live" | "ten",
    public guide: boolean,
  ) {
    this.state = startState(setup);
    this.ideal = idealPlan(setup, this.state);
    while (this.callout < CALLOUTS.length && CALLOUTS[this.callout] >= setup.alt) this.callout++;
    this.samples.push({ t: 0, alt: setup.alt, speed: setup.speed, throttle: 0 });
  }

  /** The throttle actually applied right now. */
  get throttle() {
    if (this.done || this.state.fuel <= 0) return 0;
    if (this.mode === "ten") return this.turn ? this.turn.throttle : 0;
    return this.hold ? 100 : this.lever;
  }

  /** Seconds of free fall left before a full burn can't stop you (cached). */
  get burnIn() {
    return this.deadline;
  }

  update(dtReal: number): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.done) return events;
    if (this.mode === "ten" && !this.turn) {
      this.refreshGuide(dtReal, true);
      return events;
    }

    const throttle = this.throttle;
    this.idleFor = throttle === this.lastThrottle ? this.idleFor + dtReal : 0;
    this.lastThrottle = throttle;
    let seconds: number;
    if (this.mode === "ten" && this.turn) {
      seconds = Math.min(this.turn.until - this.state.t, (dtReal / this.turn.realSeconds) * TURN_SECONDS);
      this.warp = TURN_SECONDS / this.turn.realSeconds;
    } else {
      this.updateWarp(dtReal, throttle);
      seconds = dtReal * this.warp;
    }

    const fuelBefore = this.state.fuel;
    const r = advance(this.setup, this.state, throttle, seconds);
    const before = this.state.alt;
    this.state = r.state;

    if (this.state.t >= this.nextSample || r.touchdown) {
      this.samples.push({ t: this.state.t, alt: this.state.alt, speed: this.state.speed, throttle });
      this.nextSample = this.state.t + 0.5;
    }

    while (this.callout < CALLOUTS.length && this.state.alt < CALLOUTS[this.callout] && before >= CALLOUTS[this.callout]) {
      const km = CALLOUTS[this.callout];
      events.push({ kind: "callout", label: altLabel(km), high: km < 0.1 });
      this.callout++;
    }
    while (this.callout < CALLOUTS.length && this.state.alt < CALLOUTS[this.callout]) this.callout++;

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
      events.push({ kind: "touchdown", speed: r.touchdown.speed, fuel: r.touchdown.fuel, t: r.touchdown.t });
      return events;
    }
    if (isLost(this.setup, this.state)) {
      this.done = true;
      events.push({ kind: "lost" });
      return events;
    }

    if (this.mode === "ten" && this.turn && this.state.t >= this.turn.until - 1e-9) {
      this.turn = null;
      events.push({ kind: "turn-done" });
    }

    this.refreshGuide(dtReal, false);
    // Coaching for the most common first flight: full power from the very start.
    if (this.mode === "live" && this.guide && !this.earlySaid && throttle >= 50 && this.state.speed > 0 && this.stop?.stops && this.stop.alt > Math.max(5, this.state.alt * 0.3)) {
      this.earlySaid = true;
      events.push({ kind: "too-early", stopAlt: this.stop.alt });
    }
    if (this.state.speed < -30 && throttle > 0 && !this.climbSaid) {
      this.climbSaid = true;
      events.push({ kind: "climbing" });
    }
    if (this.state.speed > 0) this.climbSaid = false;
    this.lateAge += dtReal;
    if (this.mode === "live" && this.guide && this.stop && !this.stop.stops && throttle < 95 && this.lateAge > 1.6 && this.state.speed > 0 && this.state.fuel > 0) {
      this.lateAge = 0;
      events.push({ kind: "late" });
    }
    return events;
  }

  private refreshGuide(dtReal: number, idle: boolean) {
    if (this.guide || this.mode === "live") this.stop = stopPoint(this.setup, this.state, this.state.alt < 5 ? 0.05 : 0.1);
    if (this.assist) {
      this.assistUsed = true;
      this.lines = landingLines(this.setup, this.state);
      // Close in, show where holding the current throttle would put you down.
      this.outcome = this.state.alt < 2 && this.state.speed > 0 ? holdOutcome(this.setup, this.state, this.throttle) : null;
    } else {
      this.lines = null;
      this.outcome = null;
    }
    this.deadlineAge += dtReal;
    if (!idle && this.mode === "live" && this.deadlineAge > 0.25) {
      this.deadlineAge = 0;
      this.deadline = this.stop && this.stop.stops ? burnDeadline(this.setup, this.state) : 0;
    }
  }

  /** Out of fuel with a long way to fall: the ending is already decided. */
  get hopeless() {
    return this.state.fuel <= 0 && (this.state.alt > 1 || this.state.speed < 0 || this.state.speed > 60);
  }

  /** Fast when nothing can happen soon, real time when it can. */
  private updateWarp(dtReal: number, throttle: number) {
    const s = this.state;
    let target = 1;
    if (this.autoWarp && this.hopeless) {
      // Nothing left to steer with: fast-forward to the ending, as the 1979 game did in one step.
      target = s.alt > 20 ? 128 : 32;
    } else if (this.autoWarp) {
      const descent = Math.max(1e-6, s.speed / 3200);
      const impact = s.speed > 0 ? s.alt / descent : Infinity;
      const decide = this.deadline > 0.4 ? this.deadline : Infinity;
      target = Math.min(decide / 4, impact / 8);
      // Burning: fast enough to get through a long brake, slow enough to steer.
      if (throttle > 0) target = Math.min(target, s.alt > 40 ? 8 : s.alt > 8 ? 4 : 2);
      // The last 2.5 km are flown in real time. Only a long, hands-off drift
      // (a slow fall on a small world) is sped up, and gently.
      if (s.alt < 2.5) target = throttle === 0 && this.idleFor > 4 && impact > 40 ? Math.min(4, impact / 20) : 1;
      // Too late to stop: always real time.
      if (this.stop && !this.stop.stops && s.speed > 0) target = 1;
      target = Math.max(1, Math.min(16, target));
      // The last 30 metres play at half speed: twice the time to react, same physics.
      if (s.alt < 0.03 && s.speed > -5) target = 0.5;
    }
    const k = Math.min(1, dtReal * (target < this.warp ? 8 : 2));
    this.warp += (target - this.warp) * k;
    if (Math.abs(this.warp - target) < 0.02) this.warp = target;
  }

  startTurn(throttle: number) {
    if (this.turn || this.done) return;
    const alt = this.state.alt;
    this.turns++;
    this.turn = { throttle, until: this.state.t + TURN_SECONDS, realSeconds: alt < 0.3 ? 3.4 : alt < 3 ? 2.4 : 1.4 };
  }
}
