import { blendIntent, restIntent, saluteIntent, sittingIntent, TWO_HAND_GRIP, type Grip } from "./choreography";
import { bookRoute, bookTurn, bookWalk } from "./feet";
import type { Intent } from "./human";
import { BOTH_HANDS, type Act, type ActInput, type Torero } from "./torero";
import { add, addScaled, angleDelta, flat, flatDistance, headingDir, headingOf, headingRight, normalize, scale, smootherstep, sub, type Vec3 } from "./vec";

/*
 * What the people on the sand do between passes: stand and watch, walk,
 * run in, sit where the horn put them, get up and pick up the cape, help a
 * hurt man off, salute and bow, walk a lap of honour. Each act books its
 * footsteps when it is made and then answers, tick by tick, with an intent
 * for the body and a grip on the cape.
 */

export type Pace = "walk" | "slow" | "jog";

const PACES: Record<Pace, { stepLength: number; stepTime: number; lift: number }> = {
  walk: { stepLength: 0.56, stepTime: 0.52, lift: 0.07 },
  slow: { stepLength: 0.45, stepTime: 0.62, lift: 0.05 },
  jog: { stepLength: 0.8, stepTime: 0.3, lift: 0.12 },
};

/** How the cape is carried: low in front in both hands, gathered in the left hand, or not at all. */
export type Carry = "cape" | "bundle" | "none";

const NO_GRIP: Grip = { ...TWO_HAND_GRIP, rightHold: 0, leftHold: 0 };
const LEFT_HAND: Grip = { ...TWO_HAND_GRIP, rightHold: 0, leftHold: 1 };

const gripFor = (carry: Carry) => (carry === "cape" ? BOTH_HANDS : carry === "bundle" ? LEFT_HAND : NO_GRIP);

const eyeLevel = (p: Vec3, y = 1.5): Vec3 => ({ x: p.x, y, z: p.z });

/** Standing or walking with the cape carried one way or another. */
function carrying(centre: Vec3, heading: number, look: Vec3, carry: Carry): Intent {
  const rest = restIntent(centre, heading, look);
  if (carry === "cape") return rest;
  const r = headingRight(heading);
  const f = headingDir(heading);
  if (carry === "bundle") {
    // The cape gathered over the left forearm, the hand at the hip.
    return {
      ...rest,
      handL: addScaled(addScaled({ x: centre.x, y: 0.98, z: centre.z }, r, -0.24), f, 0.14),
      elbowL: normalize(add(scale(r, -0.5), { x: 0, y: -1, z: 0 })),
      handR: null,
      elbowR: null,
    };
  }
  return { ...rest, handL: null, handR: null, elbowL: null, elbowR: null };
}

/** Running: leaning into it, knees bent, the arms pumping if they're free. */
function running(intent: Intent, amount: number): Intent {
  return { ...intent, chestLean: intent.chestLean + 0.2 * amount, crouch: intent.crouch + 0.05 * amount, arch: intent.arch * (1 - 0.5 * amount) };
}

/** A heading that eases from one value to another between two times. */
const turning = (from: number, to: number, start: number, end: number) => (time: number) => from + angleDelta(from, to) * smootherstep(start, end, time);

/* ---------- Standing and watching ---------- */

/**
 * Standing at a post with the cape, watching something (usually the bull).
 * When it moves round too far to follow with the head, the feet turn the
 * body to face it again.
 */
export class Watching implements Act {
  readonly until = Infinity;
  private heading: (time: number) => number;
  private facing: number;

  constructor(
    private readonly torero: Torero,
    private readonly target: (input: ActInput) => Vec3,
    private readonly carry: Carry = "cape",
  ) {
    this.facing = torero.intent.heading;
    this.heading = () => this.facing;
  }

  intent(input: ActInput) {
    const goal = headingOf(sub(flat(this.target(input)), input.centre));
    const off = angleDelta(this.facing, goal);
    if (Math.abs(off) > 0.7 && input.time > this.torero.feet.busyUntil + 0.25) {
      const start = input.time + 0.05;
      const end = bookTurn(this.torero.feet, goal, start, 0.45 + Math.abs(off) * 0.35);
      this.heading = turning(this.facing, goal, start - 0.05, end);
      this.facing = goal;
    }
    return carrying(input.centre, this.heading(input.time), eyeLevel(this.target(input), 1.3), this.carry);
  }

  grip() {
    return gripFor(this.carry);
  }
}

/* ---------- Walking ---------- */

export type WalkOptions = {
  pace?: Pace;
  carry?: Carry;
  /** What to watch once there (and while walking, if `watchWhileWalking`); otherwise the way ahead. */
  look?: (input: ActInput) => Vec3;
  watchWhileWalking?: boolean;
};

/** Walking (or running) straight to a spot, then turning to face `facing` there. */
export class Walk implements Act {
  readonly until: number;
  readonly arrives: number;
  private readonly heading: (time: number) => number;
  private readonly walkStart: number;
  private readonly walkEnd: number;
  private readonly pace: Pace;
  private readonly carry: Carry;

  constructor(
    torero: Torero,
    to: Vec3,
    facing: number,
    start: number,
    private readonly options: WalkOptions = {},
  ) {
    this.pace = options.pace ?? "walk";
    this.carry = options.carry ?? "cape";
    const pace = PACES[this.pace];
    // A new walk is a new plan: steps booked for an old one are dropped, the one under way is finished.
    torero.feet.clearAfter(start);
    const begin = Math.max(start + 0.05, torero.feet.busyUntil + 0.02);
    const from = torero.plannedIntent.heading;
    const walk = bookWalk(torero.feet, flat(to), facing, begin, pace.stepLength, pace.stepTime, 0.1, pace.lift);
    this.walkStart = walk.walkStart;
    this.walkEnd = walk.turnStart;
    this.arrives = walk.turnStart;
    // The body turns with the feet: round to the way, then round again to face where it was asked.
    const out = turning(from, walk.travelHeading, begin - 0.1, Math.max(begin + 0.4, walk.walkStart));
    const back = turning(walk.travelHeading, facing, walk.turnStart - 0.1, walk.end);
    this.heading = (time) => (time < walk.turnStart - 0.1 ? out(time) : back(time));
    this.until = walk.end + 0.2;
  }

  intent(input: ActInput) {
    const heading = this.heading(input.time);
    const walking = input.time > this.walkStart - 0.1 && input.time < this.walkEnd;
    const ahead = add(addScaled(input.centre, headingDir(heading), 6), { x: 0, y: 1.45, z: 0 });
    const { look: watched, watchWhileWalking } = this.options;
    const look = watched && (!walking || watchWhileWalking) ? watched(input) : ahead;
    const base = carrying(input.centre, heading, look, this.carry);
    if (this.pace !== "jog") return base;
    const pace = smootherstep(this.walkStart - 0.2, this.walkStart + 0.3, input.time) * (1 - smootherstep(this.walkEnd - 0.4, this.walkEnd, input.time));
    return running(base, pace);
  }

  grip() {
    return gripFor(this.carry);
  }
}

export type RouteOptions = { pace?: Pace; carry?: Carry; look?: (input: ActInput, heading: number) => Vec3; wave?: boolean };

/** Walking a winding route: a lap of honour, a walk round the ring. */
export class Route implements Act {
  readonly until: number;
  private readonly heading: (time: number) => number;
  private readonly walkStart: number;
  private readonly from: number;

  constructor(
    torero: Torero,
    route: Vec3[],
    start: number,
    private readonly options: RouteOptions = {},
  ) {
    const pace = PACES[options.pace ?? "walk"];
    const begin = Math.max(start + 0.05, torero.feet.busyUntil + 0.02);
    this.from = torero.plannedIntent.heading;
    const walk = bookRoute(torero.feet, route, begin, pace.stepLength, pace.stepTime);
    this.walkStart = walk.walkStart;
    const first = walk.heading(walk.walkStart);
    const settle = turning(this.from, first, begin - 0.1, Math.max(begin + 0.4, walk.walkStart));
    this.heading = (time) => (time < walk.walkStart ? settle(time) : walk.heading(time));
    this.until = walk.end + 0.2;
  }

  intent(input: ActInput) {
    const heading = this.heading(input.time);
    const look = this.options.look ? this.options.look(input, heading) : add(addScaled(input.centre, headingDir(heading), 6), { x: 0, y: 1.45, z: 0 });
    const base = carrying(input.centre, heading, look, this.options.carry ?? "cape");
    if (!this.options.wave) return base;
    return waving(base, input.centre, heading, input.time, smootherstep(this.walkStart - 0.3, this.walkStart + 0.8, input.time));
  }

  grip() {
    return gripFor(this.options.carry ?? "cape");
  }
}

/** The right arm raised to the stands, the hand turning a little as it waves. */
function waving(intent: Intent, centre: Vec3, heading: number, time: number, amount: number): Intent {
  const f = headingDir(heading);
  // The stands are to the matador's left on a lap run anticlockwise, so he waves across his body to them.
  const r = headingRight(heading);
  const sway = Math.sin(time * 4.2) * 0.07;
  const raised: Intent = {
    ...intent,
    handR: add(add({ x: centre.x, y: 1.98, z: centre.z }, scale(r, 0.16 + sway)), scale(f, 0.1)),
    elbowR: normalize(add(r, { x: 0, y: -0.4, z: 0 })),
    arch: 1,
  };
  return blendIntent(intent, raised, amount);
}

/* ---------- Down, and up again ---------- */

/** Sitting on the sand where the horn put him, leaning back on his hands, eyes on the bull. */
export class Down implements Act {
  readonly until = Infinity;
  private readonly heading: number;

  constructor(torero: Torero) {
    this.heading = torero.plannedIntent.heading;
  }

  intent(input: ActInput) {
    return sittingIntent(input.centre, this.heading, add(input.bullHead, { x: 0, y: 0.1, z: 0 }));
  }

  grip() {
    return NO_GRIP;
  }
}

/** Crouched, hands on the knees: halfway between sitting and standing. */
function squatting(centre: Vec3, heading: number, look: Vec3): Intent {
  const f = headingDir(heading);
  const r = headingRight(heading);
  const knees = addScaled({ x: centre.x, y: 0.5, z: centre.z }, f, 0.24);
  return {
    ...restIntent(centre, heading, look),
    crouch: 0.46,
    hipsForward: -0.04,
    pelvisLean: 0.35,
    chestLean: 0.62,
    arch: 0.15,
    handL: addScaled(knees, r, -0.13),
    handR: addScaled(knees, r, 0.13),
    elbowL: normalize(add(scale(r, -1), { x: 0, y: 0, z: 0 })),
    elbowR: normalize(add(r, { x: 0, y: 0, z: 0 })),
  };
}

/**
 * Getting up from the sand: weight forward over the feet, hands on the
 * knees, and up. Then a walk to where the cape fell, a bend to take it by
 * one corner, up again with it, the other hand taking its corner, and a
 * turn to face the bull.
 */
export class Rise implements Act {
  readonly until: number;
  /** When he is on his feet. */
  readonly standing: number;
  /** When he has the cape in both hands again. */
  readonly ready: number;
  private readonly sitHeading: number;
  private readonly heading: (time: number) => number;
  private readonly bendStart: number;
  private readonly take: number;

  constructor(
    private readonly torero: Torero,
    start: number,
    bullFront: Vec3,
  ) {
    this.sitHeading = torero.plannedIntent.heading;
    this.standing = start + 1.5;
    const corner = flat(torero.gripParticle("right"));
    const from = torero.feet.finalCentre();
    const toCorner = normalize(sub(corner, from), headingDir(this.sitHeading));
    const facingCape = headingOf(toCorner);
    // He stops with the corner in front of his right foot.
    const spot = addScaled(addScaled(corner, toCorner, -0.48), headingRight(facingCape), -0.16);
    let walkEnd = this.standing;
    let travel = this.sitHeading;
    if (flatDistance(spot, from) > 0.3) {
      const walk = bookWalk(torero.feet, spot, facingCape, this.standing + 0.05, 0.5, 0.52);
      walkEnd = walk.end;
      travel = walk.travelHeading;
    } else {
      walkEnd = bookTurn(torero.feet, facingCape, this.standing + 0.05, 0.6);
      travel = facingCape;
    }
    this.bendStart = walkEnd;
    this.take = walkEnd + 0.7;
    const straight = this.take + 0.9;
    const toBull = headingOf(sub(flat(bullFront), spot));
    const turnEnd = bookTurn(torero.feet, toBull, straight + 0.1, 0.5 + Math.abs(angleDelta(facingCape, toBull)) * 0.35);
    this.ready = straight + 0.5;
    const toWalk = turning(this.sitHeading, travel, this.standing - 0.3, this.standing + 0.4);
    const toCape = turning(travel, facingCape, walkEnd - 0.5, walkEnd);
    const toFace = turning(facingCape, toBull, straight, turnEnd);
    this.heading = (time) => (time < walkEnd - 0.5 ? toWalk(time) : time < straight ? toCape(time) : toFace(time));
    this.until = Math.max(turnEnd, this.ready) + 0.2;
  }

  intent(input: ActInput) {
    const { time, centre } = input;
    const look = add(input.bullHead, { x: 0, y: 0.1, z: 0 });
    const heading = this.heading(time);
    if (time < this.standing) {
      const t = time - (this.standing - 1.5);
      const sitting = sittingIntent(centre, this.sitHeading, look);
      const squat = squatting(centre, this.sitHeading, look);
      if (t < 0.7) return blendIntent(sitting, squat, smootherstep(0, 0.7, t));
      return blendIntent(squat, carrying(centre, heading, look, "none"), smootherstep(0.7, 1.5, t));
    }
    const corner = this.torero.gripParticle("right");
    const upright = carrying(centre, heading, add(corner, { x: 0, y: 0.2, z: 0 }), "none");
    if (time < this.bendStart) return upright;
    const reach: Intent = {
      ...upright,
      crouch: 0.42,
      hipsForward: -0.12,
      pelvisLean: 0.45,
      chestLean: 0.95,
      arch: 0,
      handR: add(corner, { x: 0, y: 0.04, z: 0 }),
      elbowR: normalize(add(headingRight(heading), { x: 0, y: -0.3, z: 0 })),
      handL: addScaled(addScaled({ x: centre.x, y: 0.52, z: centre.z }, headingDir(heading), 0.22), headingRight(heading), -0.12),
      elbowL: normalize(scale(headingRight(heading), -1)),
    };
    if (time < this.take) return blendIntent(upright, reach, smootherstep(this.bendStart, this.take, time));
    const holding = restIntent(centre, heading, look);
    return blendIntent(reach, holding, smootherstep(this.take + 0.1, this.take + 0.9, time));
  }

  grip(input: ActInput): Grip {
    const right = smootherstep(this.take - 0.15, this.take + 0.05, input.time);
    const left = smootherstep(this.take + 0.5, this.take + 1.1, input.time);
    return { ...TWO_HAND_GRIP, rightHold: right, leftHold: left };
  }
}

/* ---------- Helped off ---------- */

/** Who walks where when a hurt matador is helped off: his helpers' sides and the shared timings. */
export type HelpPlan = {
  /** When the helpers are beside him. */
  arrive: number;
  /** When he is up and they set off together. */
  setOff: number;
  /** The walk's direction and length. */
  heading: number;
  to: Vec3;
};

/**
 * The hurt matador: sitting until his helpers reach him, then up with their
 * hands under his arms, then walking slowly between them (or beside one),
 * an arm over each helper's shoulders.
 */
export class Supported implements Act {
  readonly until: number;
  private readonly sitHeading: number;
  private readonly heading: (time: number) => number;

  constructor(
    torero: Torero,
    private readonly plan: HelpPlan,
    private readonly helpers: { right: Torero | null; left: Torero | null },
  ) {
    this.sitHeading = torero.plannedIntent.heading;
    const pace = PACES.slow;
    const up = plan.arrive + 1.5;
    // On his feet, he turns the way they will go before they set off.
    const turned = Math.abs(angleDelta(this.sitHeading, plan.heading)) > 0.3 ? bookTurn(torero.feet, plan.heading, up, plan.setOff - up, 0.12) : up;
    const walk = bookWalk(torero.feet, plan.to, plan.heading, Math.max(turned, plan.setOff), pace.stepLength, pace.stepTime, 0.12, pace.lift);
    this.heading = turning(this.sitHeading, plan.heading, up, Math.max(turned, up + 0.3));
    this.until = walk.end + 0.3;
  }

  intent(input: ActInput) {
    const { time, centre } = input;
    const heading = this.heading(time);
    const ahead = add(addScaled(centre, headingDir(heading), 3), { x: 0, y: 0.9, z: 0 });
    const sitting = sittingIntent(centre, this.sitHeading, add(input.bullHead, { x: 0, y: 0.1, z: 0 }));
    const leaning = (h: Torero, side: number) => {
      // Over the helper's far shoulder, round his neck.
      const s = h.skeleton;
      return add(side > 0 ? s.shoulderR : s.shoulderL, { x: 0, y: 0.06, z: 0 });
    };
    const hurt: Intent = {
      ...carrying(centre, heading, ahead, "none"),
      crouch: 0.07,
      chestLean: 0.28,
      arch: 0,
      pelvisTilt: 0.05,
    };
    const { right, left } = this.helpers;
    const r = headingRight(heading);
    // With one helper, his free hand holds his side.
    hurt.handR = right ? leaning(right, 1) : add(addScaled({ x: centre.x, y: 0.98, z: centre.z }, r, 0.2), scale(headingDir(heading), 0.06));
    hurt.elbowR = normalize(add(r, { x: 0, y: -0.5, z: 0 }));
    hurt.handL = left ? leaning(left, -1) : add(addScaled({ x: centre.x, y: 0.98, z: centre.z }, r, -0.2), scale(headingDir(heading), 0.06));
    hurt.elbowL = normalize(add(scale(r, -1), { x: 0, y: -0.5, z: 0 }));
    if (time < this.plan.arrive) return sitting;
    const squat = { ...squatting(centre, this.sitHeading, ahead), handL: hurt.handL, handR: hurt.handR, elbowL: hurt.elbowL, elbowR: hurt.elbowR };
    const t = time - this.plan.arrive;
    if (t < 0.7) return blendIntent(sitting, squat, smootherstep(0, 0.7, t));
    return blendIntent(squat, hurt, smootherstep(0.7, 1.6, t));
  }

  grip() {
    return NO_GRIP;
  }
}

/**
 * A helper: runs to the hurt man's side, gets him up with a hand under his
 * arm, and walks him off with a hand at his back. The run is booked when
 * the helper is made; the walk off, once everyone's timings are known.
 */
export class Supporting implements Act {
  until = Infinity;
  /** When the helper is at the hurt man's side. */
  readonly arrives: number;
  private readonly heading: (time: number) => number;
  private readonly walkStart: number;

  constructor(
    private readonly torero: Torero,
    private readonly hurt: Torero,
    private readonly side: number,
    private readonly plan: HelpPlan,
    spot: Vec3,
    start: number,
  ) {
    const from = torero.plannedIntent.heading;
    const jog = PACES.jog;
    const run = bookWalk(torero.feet, spot, plan.heading, Math.max(start + 0.05, torero.feet.busyUntil + 0.02), jog.stepLength, jog.stepTime, 0.1, jog.lift);
    this.walkStart = run.walkStart;
    this.arrives = run.end;
    const out = turning(from, run.travelHeading, start, Math.max(start + 0.4, run.walkStart));
    const back = turning(run.travelHeading, plan.heading, run.turnStart - 0.1, run.end);
    this.heading = (time) => (time < run.turnStart - 0.1 ? out(time) : back(time));
  }

  /** Books the slow walk off, in step with the hurt man, once the plan's timings are settled. */
  setOff(to: Vec3) {
    const pace = PACES.slow;
    const walk = bookWalk(this.torero.feet, to, this.plan.heading, this.plan.setOff, pace.stepLength, pace.stepTime, 0.1, pace.lift);
    this.until = walk.end + 0.3;
  }

  intent(input: ActInput) {
    const { time, centre } = input;
    const heading = this.heading(time);
    const base = carrying(centre, heading, add(addScaled(centre, headingDir(heading), 4), { x: 0, y: 1.3, z: 0 }), "bundle");
    if (time < this.plan.arrive - 0.3) return running(base, smootherstep(this.walkStart - 0.2, this.walkStart + 0.3, time));
    const h = this.hurt.skeleton;
    const r = headingRight(heading);
    // The near hand under his arm while he gets up, then flat on his back as they walk.
    const underArm = add(this.side > 0 ? h.shoulderL : h.shoulderR, { x: 0, y: -0.12, z: 0 });
    const atBack = addScaled(add(h.pelvis, { x: 0, y: 0.22, z: 0 }), headingDir(heading), -0.12);
    const lifting = time < this.plan.setOff;
    const near = lifting ? underArm : atBack;
    const helping: Intent = {
      ...base,
      crouch: lifting ? 0.18 * (1 - smootherstep(this.plan.arrive + 0.6, this.plan.setOff, time)) : 0.03,
      chestLean: lifting ? 0.35 * (1 - smootherstep(this.plan.arrive + 0.6, this.plan.setOff, time)) : 0.08,
      look: add(h.head, { x: 0, y: -0.1, z: 0 }),
    };
    if (this.side > 0) {
      // He stands on the hurt man's right: his own left hand is the near one, the cape moves to his right.
      helping.handL = near;
      helping.elbowL = normalize(add(scale(r, 0.5), { x: 0, y: -1, z: 0 }));
      helping.handR = addScaled(addScaled({ x: centre.x, y: 0.98, z: centre.z }, r, 0.24), headingDir(heading), 0.14);
      helping.elbowR = normalize(add(scale(r, 0.5), { x: 0, y: -1, z: 0 }));
    } else {
      helping.handR = near;
      helping.elbowR = normalize(add(scale(r, -0.5), { x: 0, y: -1, z: 0 }));
    }
    return blendIntent(base, helping, smootherstep(this.plan.arrive - 0.3, this.plan.arrive + 0.2, time));
  }

  grip(input: ActInput): Grip {
    // The cape changes hands so the near one is free.
    const swap = this.side > 0 ? smootherstep(this.plan.arrive - 0.6, this.plan.arrive - 0.3, input.time) : 0;
    return { ...TWO_HAND_GRIP, rightHold: swap, leftHold: 1 - swap };
  }
}

/* ---------- To the stands ---------- */

/** Turning to the stands, back arched, both arms up: the cape lifted high in the right hand. */
export class Salute implements Act {
  readonly until: number;
  readonly start: number;
  private readonly heading: (time: number) => number;

  constructor(torero: Torero, facing: number, start: number, seconds: number) {
    const begin = Math.max(start + 0.05, torero.feet.busyUntil + 0.05);
    const from = torero.plannedIntent.heading;
    const by = Math.abs(angleDelta(from, facing));
    const end = by > 0.25 ? bookTurn(torero.feet, facing, begin, 0.5 + by * 0.35) : begin;
    this.heading = turning(from, facing, begin - 0.05, end);
    this.start = end;
    this.until = start + seconds;
  }

  raise(time: number) {
    return smootherstep(this.start + 0.5, this.start + 1.4, time);
  }

  intent(input: ActInput) {
    return saluteIntent(input.centre, this.heading(input.time), this.raise(input.time));
  }

  grip(input: ActInput): Grip {
    return { ...TWO_HAND_GRIP, rightHold: 1, leftHold: 1 - smootherstep(0, 0.35, this.raise(input.time)) };
  }
}

/** Turning to the stands and bowing, the right hand over the heart, the cape hanging from the left. */
export class Bow implements Act {
  readonly until: number;
  private readonly start: number;
  private readonly heading: (time: number) => number;

  constructor(torero: Torero, facing: number, start: number, seconds: number) {
    const begin = Math.max(start + 0.05, torero.feet.busyUntil + 0.05);
    const from = torero.plannedIntent.heading;
    const by = Math.abs(angleDelta(from, facing));
    const end = by > 0.25 ? bookTurn(torero.feet, facing, begin, 0.5 + by * 0.35) : begin;
    this.heading = turning(from, facing, begin - 0.05, end);
    this.start = end;
    this.until = Math.max(start + seconds, end + 3.2);
  }

  intent(input: ActInput) {
    const { centre, time } = input;
    const heading = this.heading(time);
    const f = headingDir(heading);
    const r = headingRight(heading);
    const stands = add(addScaled(centre, f, 14), { x: 0, y: 6, z: 0 });
    const upright = carrying(centre, heading, stands, "bundle");
    const bowed: Intent = {
      ...upright,
      chestLean: 0.62,
      hipsForward: -0.06,
      crouch: 0.03,
      arch: 0.2,
      look: addScaled({ x: centre.x, y: 0, z: centre.z }, f, 2.5),
      handR: addScaled(addScaled({ x: centre.x, y: 1.18, z: centre.z }, f, 0.26), r, -0.04),
      elbowR: normalize(add(r, { x: 0, y: -0.6, z: 0 })),
    };
    const t = time - this.start;
    const down = smootherstep(0.3, 1.1, t) * (1 - smootherstep(1.9, 2.7, t));
    return blendIntent(upright, bowed, down);
  }

  grip() {
    return LEFT_HAND;
  }
}
