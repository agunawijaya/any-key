import { BULL, type BullDrive } from "./bull";
import { bookTurn, type Footwork } from "./feet";
import { type Intent } from "./human";
import { Path } from "./path";
import {
  add,
  addScaled,
  angleDelta,
  bump,
  clamp,
  dot,
  flat,
  flatDistance,
  headingDir,
  headingOf,
  headingRight,
  lerp,
  mix,
  normalize,
  scale,
  smootherstep,
  smoothstep,
  sub,
  type Vec3,
} from "./vec";

/*
 * One pass of the bull, planned whole the moment it begins.
 *
 * The bull's run is laid out first: a path that aims at the cape, passes
 * the matador at the move's distance and curls away, travelled with a
 * speed that builds, eases as the horns take the cape, and brakes to a
 * stop; then a turn on the hindquarters to face the matador again. Every
 * tick of it is known in advance, so the matador can be choreographed to
 * it: the cape sweeps round him a set angle ahead of the horns, his chest
 * turns with them, his weight goes where the pass takes it.
 *
 * Only the planning is fixed. The bull's legs, the cape's cloth and the
 * dust are simulated on top, so no two passes look quite alike.
 */

export const TICK = 1 / 240;

/** How far from the matador the bull's hips must stop, so that turning to face him leaves its horns some three metres off. */
const SAFE_HIPS = 5.4;

export type CapeKind = "veronica" | "outside" | "swirl";
/** The two finishes, played as a pass of their own. */
export type FinishKind = "over-the-horns" | "waiting";
export type PassKind = CapeKind | FinishKind;

export const isFinish = (kind: PassKind): kind is FinishKind => kind === "over-the-horns" || kind === "waiting";

/** How each move is performed. Distances in metres, angles in radians. */
type Move = {
  /** How far to the side the bull's withers pass the matador. */
  closest: number;
  /** How much the bull's run curls round behind the matador afterwards. */
  wrap: number;
  topSpeed: number;
  passSpeed: number;
  /** Distance from the matador's middle to his hands, presenting and at full sweep. */
  handRadius: [number, number];
  handHeight: [number, number];
  /** Half the distance between the hands along the cape's edge. */
  spread: number;
  /** How far round ahead of the horns the hands keep the cape. */
  lead: number;
  /** Where the sweep ends, measured round from straight ahead. */
  sweepEnd: number;
  oneHand: boolean;
  /** Leaning the body away from the horns. */
  leanAway: number;
  /** The weight goes towards the pass (positive) or away from it. */
  weightShift: number;
  /** How much of the sweep the chest and hips turn with. */
  turnWith: number;
};

export const MOVES: Record<PassKind, Move> = {
  veronica: {
    closest: 0.95,
    wrap: 0.7,
    topSpeed: 6.4,
    passSpeed: 4.4,
    handRadius: [0.42, 0.55],
    handHeight: [1.04, 0.95],
    spread: 0.4,
    lead: 0.78,
    sweepEnd: 2.15,
    oneHand: false,
    leanAway: 0,
    weightShift: 0.55,
    turnWith: 0.78,
  },
  outside: {
    closest: 1.75,
    wrap: 0.25,
    topSpeed: 6.6,
    passSpeed: 5.3,
    handRadius: [0.52, 0.6],
    handHeight: [1.14, 1.1],
    spread: 0.3,
    lead: 0.62,
    sweepEnd: 1.8,
    oneHand: false,
    leanAway: 0.12,
    weightShift: -0.65,
    turnWith: 0.75,
  },
  swirl: {
    closest: 2.0,
    wrap: 0,
    topSpeed: 5.2,
    passSpeed: 3.8,
    handRadius: [0.58, 0.64],
    handHeight: [1.18, 1.26],
    spread: 0,
    lead: 0.62,
    sweepEnd: Math.PI * 2 + 0.35,
    oneHand: true,
    leanAway: 0.06,
    weightShift: 0,
    turnWith: 1,
  },
  // The finishes: the bull's line passes under the matador's reaching arm, on the side of the cape in his left hand.
  "over-the-horns": {
    closest: 0.78,
    wrap: 0.3,
    topSpeed: 6.2,
    passSpeed: 4.6,
    handRadius: [0.5, 0.5],
    handHeight: [0.75, 0.75],
    spread: 0,
    lead: 0.5,
    sweepEnd: 1.9,
    oneHand: true,
    leanAway: 0,
    weightShift: 0,
    turnWith: 0,
  },
  waiting: {
    closest: 0.74,
    wrap: 0.3,
    topSpeed: 6.4,
    passSpeed: 5,
    handRadius: [0.5, 0.5],
    handHeight: [0.75, 0.75],
    spread: 0,
    lead: 0.5,
    sweepEnd: 1.9,
    oneHand: true,
    leanAway: 0,
    weightShift: 0,
    turnWith: 0,
  },
};

/** Which particles of the cape's top edge each hand holds (0 is the right hand's edge), and how firmly. */
export type Grip = {
  right: number;
  left: number;
  rightHold: number;
  leftHold: number;
};

/* The hands hold the top edge near its corners, so the cape spreads wide between them. */
export const TWO_HAND_GRIP = { right: 0.12, left: 0.88 };

/** What a beat asks of everyone this tick. */
export type Cue = { bull: BullDrive; intent: Intent; grip: Grip };

/** Everything a beat can see of the ring when it plans and plays. */
export type Stage = {
  feet: Footwork;
  bullFront: Vec3;
  bullRear: Vec3;
  bullHeading: number;
  /** Where the cape's cloth is now: the bull watches it. */
  capeCentre: Vec3;
  /** The matador's heading when the beat begins. */
  matadorHeading: number;
};

/* ---------- The matador at rest ---------- */

/** Standing tall, the cape held low in front in both hands, its hem on the sand. */
export function restIntent(centre: Vec3, heading: number, look: Vec3): Intent {
  const f = headingDir(heading);
  const r = headingRight(heading);
  const hands = addScaled({ x: centre.x, y: 0.93, z: centre.z }, f, 0.3);
  return {
    heading,
    weight: 0,
    crouch: 0.01,
    hipsForward: 0,
    pelvisLean: 0,
    pelvisTilt: 0,
    chestTurn: 0,
    chestLean: 0.02,
    chestTilt: 0,
    arch: 0.75,
    look,
    handL: addScaled(hands, r, -0.33),
    handR: addScaled(hands, r, 0.33),
    elbowL: normalize(add(scale(r, -0.6), { x: 0, y: -1, z: 0 })),
    elbowR: normalize(add(scale(r, 0.6), { x: 0, y: -1, z: 0 })),
    armSwing: 0,
  };
}

/**
 * Facing the stands, back arched, both arms raised: the cape lifted high in
 * the right hand, its red face to the crowd. `raise` goes 0 to 1.
 */
export function saluteIntent(centre: Vec3, heading: number, raise: number): Intent {
  const f = headingDir(heading);
  const r = headingRight(heading);
  const rest = restIntent(centre, heading, add(add(centre, scale(f, 12)), { x: 0, y: 7, z: 0 }));
  const up: Intent = {
    ...rest,
    crouch: 0,
    chestLean: -0.16,
    arch: 1,
    weight: 0.25,
    handR: add(add({ x: centre.x, y: 2.08, z: centre.z }, scale(f, 0.12)), scale(r, 0.3)),
    handL: add(add({ x: centre.x, y: 1.98, z: centre.z }, scale(f, 0.05)), scale(r, -0.42)),
    elbowR: normalize(add(scale(r, 1), { x: 0, y: -0.3, z: 0 })),
    elbowL: normalize(add(scale(r, -1), { x: 0, y: -0.3, z: 0 })),
  };
  return blendIntent(rest, up, raise);
}

const lerpVec = (a: Vec3 | null, b: Vec3 | null, t: number, fallback: Vec3 | null) => {
  if (a && b) return lerp(a, b, t);
  return t < 0.5 ? (a ?? fallback) : (b ?? fallback);
};

/** Blends two intents: every number eased, angles the short way round. */
export function blendIntent(a: Intent, b: Intent, t: number): Intent {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    heading: a.heading + angleDelta(a.heading, b.heading) * t,
    weight: mix(a.weight, b.weight, t),
    crouch: mix(a.crouch, b.crouch, t),
    hipsForward: mix(a.hipsForward, b.hipsForward, t),
    pelvisLean: mix(a.pelvisLean, b.pelvisLean, t),
    pelvisTilt: mix(a.pelvisTilt, b.pelvisTilt, t),
    chestTurn: mix(a.chestTurn, b.chestTurn, t),
    chestLean: mix(a.chestLean, b.chestLean, t),
    chestTilt: mix(a.chestTilt, b.chestTilt, t),
    arch: mix(a.arch, b.arch, t),
    look: lerp(a.look, b.look, t),
    handL: lerpVec(a.handL, b.handL, t, null),
    handR: lerpVec(a.handR, b.handR, t, null),
    elbowL: lerpVec(a.elbowL, b.elbowL, t, null),
    elbowR: lerpVec(a.elbowR, b.elbowR, t, null),
    armSwing: mix(a.armSwing, b.armSwing, t),
  };
}

export const standingBull = (front: Vec3, look: Vec3 | null, headLow = 0.25, arousal = 0.3): BullDrive => ({
  front,
  look,
  headLow,
  toss: 0,
  tossSide: 1,
  paw: null,
  brake: 0,
  arousal,
  rest: 0,
});

/** A series eased forwards and backwards over `seconds`, so it ramps without lagging. */
function smoothed(series: number[], seconds: number) {
  const k = 1 - Math.exp(-TICK / seconds);
  const out = [...series];
  for (let i = 1; i < out.length; i++) out[i] += (out[i - 1] - out[i]) * (1 - k);
  for (let i = out.length - 2; i >= 0; i--) out[i] += (out[i + 1] - out[i]) * (1 - k);
  return out;
}

/* ---------- The pass ---------- */

/** A bull's run, tick by tick: where its withers and hips are, how fast it goes and how hard it brakes. */
export type Track = {
  front: Vec3[];
  rear: Vec3[];
  speed: number[];
  brake: number[];
  stopTick: number;
  turnEnd: number;
};

export type TrackPlan = {
  /** Waypoints on the sand, the first where the withers are now. */
  points: Vec3[];
  rear: Vec3;
  heading: number;
  /** Ticks standing before it sets off. */
  waitTicks: number;
  topSpeed: number;
  /** Where on the run it eases to `slowSpeed` (the cape, in a pass), if anywhere. */
  slowAt: Vec3 | null;
  slowSpeed: number;
  accel: number;
  decel: number;
  /** A point to turn on the hindquarters to face once stopped; null to stop facing the way it ran. */
  face: Vec3 | null;
};

/**
 * Lays a bull's run along waypoints: a speed that builds, eases where it
 * should, and brakes to a stop at the end; then, if asked, a turn on the
 * hindquarters to face a point. The hips follow the withers exactly as the
 * bull's rig makes them.
 */
export function planTrack(plan: TrackPlan): Track {
  const { points, topSpeed, slowSpeed, accel, decel } = plan;
  const start = points[0];
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const path = new Path(points, addScaled(start, headingDir(plan.heading), -2), addScaled(last, normalize(sub(last, beforeLast)), 2));
  const slowAt = plan.slowAt ? path.nearest(plan.slowAt) : -Infinity;
  const speedAt = (s: number) => {
    const build = Math.sqrt(0.16 + 2 * accel * s);
    const temple = slowSpeed + (topSpeed - slowSpeed) * smoothstep(0.8, 3.2, slowAt - s) * (s < slowAt ? 1 : 0);
    const stop = Math.sqrt(2 * decel * Math.max(0, path.length - s));
    return Math.min(build, topSpeed, s < slowAt ? temple : plan.slowAt ? slowSpeed : topSpeed, stop);
  };

  const front: Vec3[] = [];
  const speed: number[] = [];
  const brake: number[] = [];
  for (let i = 0; i < plan.waitTicks; i++) {
    front.push(start);
    speed.push(0);
    brake.push(0);
  }
  let s = 0;
  let v = 0;
  while (s < path.length - 0.004 && front.length < 60 / TICK) {
    const next = speedAt(s);
    const dv = (next - v) / TICK;
    v = next;
    s += v * TICK;
    front.push(path.at(s));
    speed.push(v);
    brake.push(smoothstep(1.2, 4, -dv));
  }
  const stopTick = front.length - 1;

  const rears: Vec3[] = [];
  let rear = flat(plan.rear);
  for (let i = 0; i < front.length; i++) {
    rear = addScaled(front[i], normalize(sub(rear, front[i])), BULL.bodyLength);
    rears.push(rear);
  }

  // Then the turn on the hindquarters: the withers swing round the hips until the bull faces the point.
  const stopped = front[stopTick];
  const fromHeading = headingOf(sub(stopped, rear));
  const turn = plan.face ? angleDelta(fromHeading, headingOf(sub(plan.face, rear))) : 0;
  const turnTicks = Math.round((0.6 + Math.abs(turn) / 1.25) / TICK);
  const settle = Math.round(0.25 / TICK);
  for (let i = 0; i < settle; i++) {
    front.push(stopped);
    rears.push(rear);
    speed.push(0);
    brake.push(brake[brake.length - 1] * 0.95);
  }
  if (plan.face) {
    for (let i = 1; i <= turnTicks; i++) {
      const h = fromHeading + turn * smootherstep(0, 1, i / turnTicks);
      front.push(addScaled(rear, headingDir(h), BULL.bodyLength));
      rears.push(rear);
      speed.push(0);
      brake.push(0);
    }
  }
  return {
    front,
    rear: rears,
    speed,
    brake: smoothed(brake, 0.12),
    stopTick,
    turnEnd: front.length - 1,
  };
}

/** How a pass ends: the engine decides, the choreography shows it. A finish that succeeds ends with the bull at rest. */
export type PassOutcome = "clean" | "close" | "gored" | "rests";

export type PassOptions = { kind: PassKind; side: 1 | -1; paw: boolean; outcome?: PassOutcome };

/**
 * How much nearer than usual the bull's line comes for a close call, and for
 * a goring (where the near horn reaches the matador's hip).
 */
const NEARER: Record<PassKind, { close: number; gored: number; rests: number }> = {
  veronica: { close: 0.17, gored: 0.36, rests: 0 },
  outside: { close: 0.4, gored: 0.85, rests: 0 },
  swirl: { close: 0.35, gored: 0.95, rests: 0 },
  "over-the-horns": { close: 0, gored: 0.2, rests: 0.12 },
  waiting: { close: 0, gored: 0.18, rests: 0.12 },
};

/** Sitting on the sand after a goring: knees up, leaning back on his hands, watching the bull. */
export function sittingIntent(centre: Vec3, heading: number, look: Vec3, depth = 1): Intent {
  const f = headingDir(heading);
  const r = headingRight(heading);
  const behind = addScaled({ x: centre.x, y: 0.06, z: centre.z }, f, -0.42);
  const rest = restIntent(centre, heading, look);
  const down: Intent = {
    ...rest,
    crouch: 0.76,
    hipsForward: -0.34,
    pelvisLean: -0.85,
    chestLean: 0.45,
    arch: 0,
    handL: addScaled(behind, r, -0.3),
    handR: addScaled(behind, r, 0.3),
    elbowL: normalize(add(scale(f, -1), scale(r, -0.4))),
    elbowR: normalize(add(scale(f, -1), scale(r, 0.4))),
  };
  return blendIntent(rest, down, depth);
}

export class Pass {
  readonly kind: PassKind;
  readonly side: 1 | -1;
  readonly move: Move;
  /** Ticks of the bull standing (and pawing) before it charges. */
  readonly chargeTick: number;
  readonly track: Track;
  /** The sweep angle of the cape for each tick, from straight ahead towards the pass side. */
  private readonly alpha: Float32Array;
  /** The bull's head, as the plan expects it, for each tick. */
  private readonly head: Vec3[];
  private readonly centre: Vec3;
  private readonly forward: Vec3;
  private readonly sideDir: Vec3;
  private readonly heading: number;
  /** When the cape is gathered and the matador turns to face the bull again. */
  readonly recoverTick: number;
  private readonly faceHeading: number;
  readonly lengthTicks: number;
  private readonly tossTick: number;
  private readonly spinTicks: [number, number];
  readonly paw: boolean;
  /** How close the horns' line came to the matador's middle, by the plan. */
  readonly plannedClosest: number;
  readonly outcome: PassOutcome;
  /** When the horns reach him, for a goring: from then on he is thrown and falls. */
  readonly contactTick: number;
  /** Which way he is thrown: away from the bull's line. */
  private readonly thrown: Vec3;
  /** For a finish: the still moment of the profile before the bull is called. */
  private profileTicks = 0;

  constructor(options: PassOptions, stage: Stage, startTime: number) {
    this.kind = options.kind;
    // A finish always goes by on his left, where the cape is.
    this.side = isFinish(options.kind) ? -1 : options.side;
    this.paw = options.paw;
    this.outcome = options.outcome ?? "clean";
    const nearer = this.outcome === "clean" ? 0 : NEARER[options.kind][this.outcome];
    // A close call or a goring is the same move with the bull's line brought in, and the cape kept nearer the horns.
    this.move = {
      ...MOVES[options.kind],
      closest: MOVES[options.kind].closest - nearer,
      lead: MOVES[options.kind].lead * (this.outcome === "clean" ? 1 : 0.8),
    };
    const feet = stage.feet;
    this.centre = feet.centre();
    const toBull = sub(flat(stage.bullFront), this.centre);
    this.heading = headingOf(toBull);
    this.forward = headingDir(this.heading);
    this.sideDir = scale(headingRight(this.heading), this.side);
    // A finish begins with a long, still profile before the bull is called.
    if (isFinish(options.kind)) this.profileTicks = Math.round(1.6 / TICK);
    this.chargeTick = this.profileTicks + Math.round((options.paw ? 1.75 : 0.45) / TICK);

    this.track = this.planRun(stage);
    // The horns are about this far ahead of the withers, along the body.
    this.head = this.track.front.map((front, i) => addScaled(front, normalize(sub(front, this.track.rear[i])), 0.85));
    this.alpha = this.planSweep();
    this.plannedClosest = Math.min(...this.head.map((h) => Math.hypot(h.x - this.centre.x, h.z - this.centre.z)));
    let contact = this.track.stopTick;
    let nearest = Infinity;
    for (let i = this.chargeTick; i < this.track.stopTick; i++) {
      const d = Math.hypot(this.head[i].x - this.centre.x, this.head[i].z - this.centre.z);
      if (d < nearest) {
        nearest = d;
        contact = i;
      }
    }
    // The horn reaches him a moment before the head is level with his middle.
    this.contactTick = contact - Math.round(0.08 / TICK);
    const away = sub(this.centre, flat(this.head[this.contactTick]));
    this.thrown = normalize(add(normalize(away), scale(this.forward, -0.6)));

    // The toss comes as the horns leave the cape behind.
    let toss = this.track.stopTick;
    for (let i = this.chargeTick; i < this.head.length; i++) {
      if (this.beta(this.head[i]) > Math.min(this.move.sweepEnd, 2.5) - 0.15) {
        toss = i;
        break;
      }
    }
    // A goring is the toss: the head hooks up as the horn reaches him.
    this.tossTick = this.outcome === "gored" ? this.contactTick : toss;

    let swept = this.alpha.length - 1;
    for (let i = this.chargeTick; i < this.alpha.length; i++) {
      if (this.alpha[i] >= this.move.sweepEnd - 0.02) {
        swept = i;
        break;
      }
    }
    this.recoverTick = swept + Math.round(0.3 / TICK);
    const stopFront = this.track.front[this.track.stopTick];
    this.faceHeading = headingOf(sub(stopFront, this.centre));
    this.spinTicks = [this.chargeTick, swept];
    this.lengthTicks = Math.max(this.track.turnEnd + Math.round(0.5 / TICK), this.recoverTick + Math.round(1.6 / TICK));

    if (this.outcome === "rests") {
      this.bookLunge(feet, startTime);
      this.lengthTicks = this.track.stopTick + Math.round(3.4 / TICK);
    } else if (this.outcome === "gored") {
      if (isFinish(this.kind)) this.bookLunge(feet, startTime);
      this.bookThrow(feet, startTime);
      // A goring ends once he is down and the bull has turned.
      this.lengthTicks = Math.max(this.track.turnEnd, this.contactTick + Math.round(1.6 / TICK));
    } else {
      if (isFinish(this.kind)) this.bookLunge(feet, startTime);
      else this.bookFootwork(feet, startTime);
      // The pass isn't over until the matador has finished his last step.
      this.lengthTicks = Math.max(this.lengthTicks, Math.ceil((feet.busyUntil - startTime) / TICK) + Math.round(0.25 / TICK));
    }
  }

  /** The angle of a point round the matador, from straight ahead towards the pass side. */
  private beta(point: Vec3) {
    const d = sub(point, this.centre);
    return Math.atan2(dot(d, this.sideDir), dot(d, this.forward));
  }

  /**
   * The run, in the matador's frame (metres ahead of him, metres to the pass
   * side). It always ends far enough out that the bull, turning on its
   * hindquarters to face him again, keeps its horns a good three metres off.
   */
  private waypoints(startDistance: number): Vec3[] {
    const { closest: c, wrap } = this.move;
    const at = (f: number, s: number) => add(add(this.centre, scale(this.forward, f)), scale(this.sideDir, s));
    // A bull that starts close (linked passes) aims at the cape sooner.
    const approach = clamp(startDistance * 0.5, 1.7, 3.4);
    if (this.kind === "swirl") {
      // The bull follows the whirling cape round the matador...
      const r = c;
      const around = [0.55, 1.05, 1.6, 2.15].map((b) => at(Math.cos(b) * r, Math.sin(b) * r));
      // ...and flies off along the circle's tangent, never closer than the circle itself.
      const last = 2.15;
      const exit = (d: number) => at(Math.cos(last) * r - Math.sin(last) * d, Math.sin(last) * r + Math.cos(last) * d);
      return [at(approach, 1.5), ...around, exit(1.6), exit(4.8)];
    }
    return [at(approach, c * 0.72), at(0.9, c), at(-1.7, c + 0.05), at(-4.2, c - 0.45 * wrap), at(-7.0, c - 1.0 * wrap)];
  }

  /**
   * The bull turns round its hips, which are nearer the matador than its
   * withers when it runs away from him; so the run is lengthened until the
   * turn leaves the horns at a respectful distance.
   */
  private planRun(stage: Stage): Track {
    const start = flat(stage.bullFront);
    const points = [start, ...this.waypoints(flatDistance(start, this.centre))];
    if (this.outcome === "rests") {
      // He goes a few strides past and stops: no turn, nothing more to face.
      points.splice(points.length - 2, 2, add(add(this.centre, scale(this.forward, -3.6)), scale(this.sideDir, this.move.closest + 0.2)));
      return this.runAlong(points, stage, false);
    }
    let track = this.runAlong(points, stage);
    for (let tries = 0; tries < 6; tries++) {
      const hips = track.rear[track.stopTick];
      const gap = flatDistance(hips, this.centre) - SAFE_HIPS;
      if (gap >= 0) break;
      const last = points[points.length - 1];
      const out = normalize(sub(last, points[points.length - 2]));
      points[points.length - 1] = addScaled(last, out, 0.3 - gap);
      track = this.runAlong(points, stage);
    }
    return track;
  }

  private runAlong(points: Vec3[], stage: Stage, turnToFace = true): Track {
    // The withers pass the matador at the move's distance: the slowest point of the run, where the horns take the cape.
    return planTrack({
      points,
      rear: stage.bullRear,
      heading: stage.bullHeading,
      waitTicks: this.chargeTick,
      topSpeed: this.move.topSpeed,
      slowAt: add(this.centre, scale(this.sideDir, this.move.closest)),
      slowSpeed: this.move.passSpeed,
      accel: 5.5,
      decel: this.kind === "swirl" ? 3.2 : 4.4,
      face: turnToFace ? this.centre : null,
    });
  }

  /** The cape's angle round the matador, tick by tick: waiting in front, then just ahead of the horns. */
  private planSweep() {
    const { lead, sweepEnd } = this.move;
    const rest = this.kind === "outside" ? 0.55 : 0.28;
    const out = new Float32Array(this.head.length);
    let unwrapped = 0;
    let previousBeta = this.beta(this.head[0]);
    let alpha = rest;
    let velocity = 0;
    // The swirl's own turn: once the bull is going round, the cape keeps whirling at least this fast.
    let spin = rest;
    const spinRate = 4.4;
    for (let i = 0; i < this.head.length; i++) {
      const b = this.beta(this.head[i]);
      unwrapped += angleDelta(previousBeta, b);
      previousBeta = b;
      // The lead is widest while the horns come in, tightest as they pass the body.
      const lead_ = lead * mix(1.25, 0.85, smoothstep(0.2, 1.5, unwrapped));
      let want = Math.log(Math.exp((rest - 0) * 6) + Math.exp((unwrapped + lead_) * 6)) / 6;
      if (i < this.chargeTick) want = rest;
      // The swirl keeps turning after the bull has been spun round, to finish the circle.
      if (this.kind === "swirl" && i > this.chargeTick && unwrapped > 0.9) {
        spin = Math.max(spin + spinRate * TICK, want);
        want = spin;
      } else spin = want;
      want = Math.min(want, sweepEnd);
      // A follower with mass: the cape speeds up and slows down, it never jumps.
      const stiffness = 160;
      const damping = 2 * Math.sqrt(stiffness);
      velocity += (stiffness * (want - alpha) - damping * velocity) * TICK;
      alpha = Math.max(alpha, Math.min(sweepEnd, alpha + velocity * TICK));
      out[i] = alpha;
    }
    return out;
  }

  private bookFootwork(feet: Footwork, startTime: number) {
    const at = (tick: number) => startTime + tick * TICK;
    if (this.kind === "veronica") {
      // Loading the pass: the far leg steps across, into the bull's line, as the horns come.
      let loadTick = this.chargeTick;
      for (let i = this.chargeTick; i < this.head.length; i++) {
        if (this.beta(this.head[i]) > 0.3) {
          loadTick = i;
          break;
        }
      }
      const far = this.side === 1 ? "L" : "R";
      const plant = feet.finalPlant(far);
      const to = {
        at: flat(add(add(plant.at, scale(this.forward, 0.14)), scale(this.sideDir, 0.07))),
        heading: plant.heading,
      };
      feet.book(far, "step", to, at(loadTick - Math.round(0.35 / TICK)), 0.38, 0.05);
    }
    if (this.kind === "outside") {
      // Making room: the near foot steps away from the bull's line before it arrives.
      const near = this.side === 1 ? "R" : "L";
      const far = this.side === 1 ? "L" : "R";
      const stepAt = this.chargeTick + Math.round(0.35 / TICK);
      const away = scale(this.sideDir, -0.3);
      const farPlant = feet.finalPlant(far);
      const nearPlant = feet.finalPlant(near);
      feet.book(far, "step", { at: flat(add(farPlant.at, away)), heading: farPlant.heading }, at(stepAt), 0.42, 0.06);
      feet.book(
        near,
        "step",
        {
          at: flat(add(nearPlant.at, scale(away, 0.75))),
          heading: nearPlant.heading,
        },
        at(stepAt) + 0.36,
        0.42,
        0.05,
      );
    }
    if (this.kind === "swirl") {
      const [from, to] = this.spinTicks;
      const spinStart = from + Math.round((to - from) * 0.25);
      const turn = -this.side * (this.move.sweepEnd - 0.3) * this.move.turnWith;
      bookTurn(feet, this.heading + turn, at(spinStart), (to - spinStart) * TICK * 0.95);
    }
    // Squaring up to the bull's new spot once the cape is gathered.
    const turnStart = at(this.recoverTick);
    const ready = Math.max(turnStart, feet.busyUntil + 0.05);
    const turnBy = Math.abs(angleDelta(this.matadorHeadingAt(this.recoverTick), this.faceHeading));
    bookTurn(feet, this.faceHeading, ready, 0.55 + turnBy * 0.4);
  }

  /** Over the horns he goes in: two steps towards the bull's line as it arrives. Waiting, he stays planted. */
  private bookLunge(feet: Footwork, startTime: number) {
    if (this.kind !== "over-the-horns") return;
    const at = startTime + (this.contactTick - Math.round(0.42 / TICK)) * TICK;
    const towards = normalize(add(this.forward, scale(this.sideDir, 0.35)));
    for (const [k, side] of [
      [0, "R"],
      [1, "L"],
    ] as const) {
      const plant = feet.finalPlant(side);
      feet.book(side, "step", { at: flat(addScaled(plant.at, towards, 0.32)), heading: plant.heading }, at + k * 0.16, 0.24, 0.05);
    }
  }

  /** Thrown by the horn: two stumbling steps away from the bull's line before he goes down. */
  private bookThrow(feet: Footwork, startTime: number) {
    const at = startTime + this.contactTick * TICK;
    const heading = this.matadorHeadingAt(this.contactTick);
    for (const [k, side] of [
      [1, this.side === 1 ? "L" : "R"],
      [2, this.side === 1 ? "R" : "L"],
    ] as const) {
      const plant = feet.finalPlant(side);
      const to = { at: flat(addScaled(plant.at, this.thrown, 0.28 + 0.12 * k)), heading: plant.heading + angleDelta(plant.heading, heading) * 0.5 };
      feet.book(side, "step", to, at + (k - 1) * 0.18, 0.26, 0.05);
    }
  }

  /** The matador's heading at a tick: facing the bull, turned with the cape, then turned to the bull's new spot. */
  private matadorHeadingAt(tick: number) {
    if (isFinish(this.kind)) return this.heading - 0.85;
    const a = this.alpha[Math.min(tick, this.alpha.length - 1)];
    const turned = this.kind === "swirl" ? -this.side * (a - 0.3) * this.move.turnWith : -this.side * clamp(a * 0.32, 0, 0.7);
    return this.heading + turned;
  }

  /** The bull's cue at a tick. */
  bullCue(tick: number, capeCentre: Vec3, matadorHead: Vec3): BullDrive {
    const i = Math.min(tick, this.track.front.length - 1);
    const front = this.track.front[i];
    const charging = tick >= this.chargeTick && i <= this.track.stopTick;
    const pawing = this.paw && tick < this.chargeTick - Math.round(0.15 / TICK) ? clamp(tick / (this.chargeTick - Math.round(0.15 / TICK)), 0, 1) : null;
    const chargeT = (tick - this.chargeTick) * TICK;
    const tossT = (tick - this.tossTick) * TICK;
    const toss = bump(clamp(tossT / 0.6, 0, 1));
    const afterToss = smoothstep(0.2, 0.9, tossT);
    let headLow = mix(0.45, 1, smoothstep(0, 0.45, chargeT));
    headLow = mix(headLow, 0.3, afterToss);
    if (!charging && tick < this.chargeTick) headLow = 0.45;
    const lookAtMatador = i > this.track.stopTick;
    const resting = this.outcome === "rests" ? smootherstep(this.track.stopTick + 0.5 / TICK, this.track.stopTick + 3 / TICK, tick) : 0;
    return {
      front,
      look: resting > 0 ? null : lookAtMatador ? matadorHead : capeCentre,
      headLow: mix(headLow, 0.7, resting),
      toss: this.outcome === "rests" ? 0 : toss,
      tossSide: this.side,
      paw: pawing,
      brake: this.track.brake[i] ?? 0,
      arousal: mix(0.55, 1, smoothstep(-0.5, 0.2, chargeT)) * (1 - 0.5 * smoothstep(1, 3, tossT)) * (1 - resting),
      rest: resting,
    };
  }

  /** The matador's intent at a tick; `centre` is the middle of his feet as they are now. */
  intent(tick: number, centre: Vec3, bullHead: Vec3): Intent {
    if (this.outcome === "gored" && tick >= this.contactTick) return this.thrownIntent(tick, centre, bullHead);
    if (isFinish(this.kind)) return this.finishing(tick, centre, bullHead);
    return this.performing(tick, centre, bullHead);
  }

  /**
   * Thrown by the horn: the body twists away and the arms fly out, then he
   * goes down onto the sand, sitting, leaning back on his hands, eyes on
   * the bull.
   */
  private thrownIntent(tick: number, centre: Vec3, bullHead: Vec3): Intent {
    const since = (tick - this.contactTick) * TICK;
    const before = this.performing(this.contactTick, centre, bullHead);
    const heading = before.heading;
    const r = headingRight(heading);
    const flung: Intent = {
      ...before,
      chestTilt: this.side * 0.35,
      chestTurn: before.chestTurn - this.side * 0.4,
      chestLean: -0.15,
      crouch: 0.08,
      handL: add(addScaled({ x: centre.x, y: 1.55, z: centre.z }, r, -0.55), scale(this.thrown, 0.2)),
      handR: add(addScaled({ x: centre.x, y: 1.55, z: centre.z }, r, 0.55), scale(this.thrown, 0.2)),
      elbowL: { x: 0, y: -1, z: 0 },
      elbowR: { x: 0, y: -1, z: 0 },
      look: add(bullHead, { x: 0, y: 0.1, z: 0 }),
    };
    const sitting = sittingIntent(centre, heading, add(bullHead, { x: 0, y: 0.1, z: 0 }));
    if (since < 0.22) return blendIntent(before, flung, smootherstep(0, 0.22, since));
    return blendIntent(flung, sitting, smootherstep(0.3, 1.05, since));
  }

  /**
   * The finish: he turns side-on, left shoulder to the bull, the cape low in
   * his left hand and his right hand raised to the line of the horns. As the
   * bull arrives he reaches over the horns (going in, or standing his ground
   * when waiting), the cape sweeping the head away below. Then he straightens.
   */
  private finishing(tick: number, centre: Vec3, bullHead: Vec3): Intent {
    const f = this.forward;
    const heading = this.matadorHeadingAt(tick);
    const left = scale(headingRight(this.heading), -1);
    const rest = restIntent(centre, this.heading, add(bullHead, { x: 0, y: 0.2, z: 0 }));
    const profile: Intent = {
      ...rest,
      heading,
      chestTurn: 0.45,
      chestLean: 0.05,
      arch: 0.9,
      crouch: 0.02,
      look: add(bullHead, { x: 0, y: 0.1, z: 0 }),
      handL: addScaled(addScaled({ x: centre.x, y: 0.72, z: centre.z }, f, 0.42), left, 0.25),
      handR: addScaled(addScaled({ x: centre.x, y: 1.48, z: centre.z }, f, 0.4), left, 0.08),
      elbowL: { x: 0, y: -1, z: 0 },
      elbowR: normalize(add(scale(headingRight(this.heading), 1), { x: 0, y: -0.6, z: 0 })),
    };
    const over = this.kind === "over-the-horns";
    const head = this.head[Math.min(this.contactTick, this.head.length - 1)];
    const reach: Intent = {
      ...profile,
      crouch: over ? 0.12 : 0.08,
      chestLean: over ? 0.55 : 0.4,
      chestTurn: 0.25,
      // Over the withers, just behind the horns, as the bull goes under his arm.
      handR: add(addScaled(flat(head), f, -0.25), { x: 0, y: 1.25, z: 0 }),
      handL: addScaled(addScaled({ x: centre.x, y: 0.55, z: centre.z }, left, 0.7), f, -0.25),
    };
    const t = tick * TICK;
    const contact = this.contactTick * TICK;
    const into = smootherstep(0, this.profileTicks * TICK * 0.8, t);
    if (t < contact - 0.45) return blendIntent(rest, profile, into);
    if (t < contact + 0.15) return blendIntent(profile, reach, smootherstep(contact - 0.45, contact, t));
    // After it: straightening up and turning to watch the bull go.
    const after = restIntent(centre, this.heading, add(bullHead, { x: 0, y: 0.2, z: 0 }));
    return blendIntent(reach, after, smootherstep(contact + 0.15, contact + 1.1, t));
  }

  private performing(tick: number, centre: Vec3, bullHead: Vec3): Intent {
    const i = Math.min(tick, this.alpha.length - 1);
    const a = this.alpha[i];
    const m = this.move;
    const f = this.forward;
    const s = this.sideDir;
    const reach = Math.sin(clamp(a, 0, Math.PI / 2));
    const radius = mix(m.handRadius[0], m.handRadius[1], reach);
    const height = mix(m.handHeight[0], m.handHeight[1], reach);
    const radial = add(scale(f, Math.cos(a)), scale(s, Math.sin(a)));
    const tangent = add(scale(f, -Math.sin(a)), scale(s, Math.cos(a)));
    const handsAt = add({ x: centre.x, y: height, z: centre.z }, scale(radial, radius));
    const nearHand = addScaled(handsAt, tangent, m.spread);
    const farHand = addScaled(handsAt, tangent, -m.spread);
    const elbowOut = (dir: Vec3) => normalize(add(scale(dir, 0.55), { x: 0, y: -1, z: 0 }));

    const heading = this.matadorHeadingAt(i);
    let handR: Vec3 | null = this.side === 1 ? nearHand : farHand;
    let handL: Vec3 | null = this.side === 1 ? farHand : nearHand;
    let elbowR: Vec3 | null = elbowOut(headingRight(heading));
    let elbowL: Vec3 | null = elbowOut(scale(headingRight(heading), -1));
    if (m.oneHand) {
      // One hand whirls the cape; the other rises out to the other side for balance.
      const free = add(add({ x: centre.x, y: 1.3, z: centre.z }, scale(headingRight(heading), -this.side * 0.52)), scale(headingDir(heading), 0.1));
      const freeElbow = normalize(add({ x: 0, y: -1, z: 0 }, scale(headingDir(heading), -0.5)));
      if (this.side === 1) {
        handR = handsAt;
        handL = free;
        elbowL = freeElbow;
      } else {
        handL = handsAt;
        handR = free;
        elbowR = freeElbow;
      }
    }

    const sweep: Intent = {
      heading,
      weight: m.weightShift * this.side * Math.sin(clamp(a, 0, Math.PI / 2)),
      crouch: 0.015 + 0.02 * reach,
      hipsForward: -0.01,
      pelvisLean: 0.02,
      pelvisTilt: -this.side * m.leanAway * 0.5 * reach,
      chestTurn: this.kind === "swirl" ? -this.side * 0.25 : -this.side * clamp(a * (m.turnWith - 0.32), -1.1, 1.1),
      chestLean: 0.03 + 0.05 * reach,
      chestTilt: -this.side * m.leanAway * reach,
      arch: 0.85,
      look: add(bullHead, { x: 0, y: 0.05, z: 0 }),
      handL,
      handR,
      elbowL,
      elbowR,
      armSwing: 0,
    };

    // Before the charge: from the rest pose into the cite, the cape offered.
    const restNow = restIntent(centre, this.heading, add(bullHead, { x: 0, y: 0.2, z: 0 }));
    const cite = smootherstep(0, this.chargeTick * 0.7, tick);
    if (tick < this.recoverTick) return blendIntent(restNow, sweep, cite);

    // After it: the cape gathered back in front, the body turned to the bull's new spot.
    const since = (tick - this.recoverTick) * TICK;
    const turning = smootherstep(0, 1.2, since);
    const restHeading = heading + angleDelta(heading, this.faceHeading) * turning;
    const restAfter = restIntent(centre, restHeading, add(bullHead, { x: 0, y: 0.25, z: 0 }));
    return blendIntent(sweep, restAfter, smootherstep(0, 0.75, since));
  }

  /** Which particles of the cape each hand holds, and how firmly. */
  grip(tick: number): Grip {
    // Gored, he lets the cape go; it falls where it will.
    if (this.outcome === "gored" && tick >= this.contactTick) return { ...TWO_HAND_GRIP, rightHold: 0, leftHold: 0 };
    if (isFinish(this.kind)) {
      const letGo = Math.round(0.3 / TICK);
      const regrip = this.contactTick + Math.round(1.2 / TICK);
      const right = tick < letGo ? 1 - smoothstep(0, letGo, tick) : tick < regrip ? 0 : smoothstep(regrip, regrip + 0.4 / TICK, tick);
      return { ...TWO_HAND_GRIP, rightHold: right, leftHold: 1 };
    }
    if (!this.move.oneHand) return { ...TWO_HAND_GRIP, rightHold: 1, leftHold: 1 };
    // The free hand lets go as the swirl starts and takes hold again, gently, once the cape has settled.
    const [from, to] = this.spinTicks;
    const letGo = from + Math.round((to - from) * 0.2);
    const regrip = this.recoverTick + Math.round(0.45 / TICK);
    const hold = tick < letGo ? 1 : tick < regrip ? 0 : smoothstep(regrip, regrip + 0.4 / TICK, tick);
    return this.side === 1 ? { ...TWO_HAND_GRIP, rightHold: 1, leftHold: hold } : { ...TWO_HAND_GRIP, rightHold: hold, leftHold: 1 };
  }

  /** The matador's facing once the pass is over. */
  get endHeading() {
    return this.faceHeading;
  }

  /** For tests and the lab: the planned head path's closest approach to the matador's middle. */
  closestApproach() {
    return this.plannedClosest;
  }

  centrePoint() {
    return { ...this.centre };
  }

  /** The bull's planned withers point when it has come to a stop. */
  stopPoint() {
    return { ...this.track.front[this.track.stopTick] };
  }

  /** Where the horns are, by the plan, at a tick. */
  plannedHead(tick: number) {
    return this.head[Math.min(tick, this.head.length - 1)];
  }
}
