import { Chain } from "./chain";
import { solveTwoBone } from "./ik";
import {
  add,
  addScaled,
  angleDelta,
  bodyQuat,
  clamp,
  distance,
  flat,
  flatDistance,
  headingDir,
  headingOf,
  headingRight,
  lerp,
  local,
  mix,
  normalize,
  scale,
  smoothstep,
  sub,
  UP,
  type Quat,
  type Vec3,
} from "./vec";

/*
 * The bull: a quadruped rigged in code.
 *
 * The body is steered like a carriage and its trailer: a point under the
 * withers goes where the choreography sends it, and the hips follow at the
 * body's length. Turning on the hindquarters falls out of that: the front
 * swings round while the rear barely moves.
 *
 * Legs place themselves. At speed a gait clock (walk, trot, gallop, blended
 * by speed) says when each leg lifts; each hoof then flies to where its
 * shoulder or hip will be when it lands, and stays exactly there until it
 * lifts again. Standing still, a leg steps only when the body has moved too
 * far from it. Upper legs are solved with two-bone IK; the cannon bones are
 * set by the stride (folded back in a foreleg's swing, the hock flexed in a
 * hind leg's).
 *
 * Lying down, the bull kneels in front first and then lets the hind end
 * down, as cattle do; one curve over the rest cue gives both that order and,
 * run backwards, the hind-first way they get up.
 */

export const BULL = {
  bodyLength: 1.3,
  withers: 1.42,
  hips: 1.36,
  fore: {
    drop: 0.42,
    side: 0.17,
    upper: 0.34,
    lower: 0.37,
    cannon: 0.25,
    pastern: 0.1,
  },
  hind: {
    drop: 0.31,
    side: 0.16,
    upper: 0.43,
    lower: 0.43,
    cannon: 0.32,
    pastern: 0.09,
  },
  neck: 0.6,
  tail: { links: 9, linkLength: 0.1 },
};

export const LEGS = ["LF", "RF", "LH", "RH"] as const;
export type LegName = (typeof LEGS)[number];

type Gait = {
  duty: number;
  offsets: [number, number, number, number];
  lift: number;
  frequency: (speed: number) => number;
};

/* Footfall timing per gait, as fractions of the stride for LF, RF, LH, RH. */
const WALK: Gait = {
  duty: 0.66,
  offsets: [0.25, 0.75, 0, 0.5],
  lift: 0.11,
  frequency: (v) => 0.5 + 0.38 * v,
};
const TROT: Gait = {
  duty: 0.5,
  offsets: [0, 0.5, 0.5, 0],
  lift: 0.15,
  frequency: (v) => 1.25 + 0.12 * v,
};
const GALLOP: Gait = {
  duty: 0.36,
  offsets: [0.52, 0.62, 0, 0.1],
  lift: 0.22,
  frequency: (v) => 1.75 + 0.06 * v,
};

/** Below this speed the legs stop keeping time and step only when they have to. */
const STILL_SPEED = 0.45;

export type BullDrive = {
  /** The point on the sand under the withers: the choreography moves it. */
  front: Vec3;
  /** What the bull is looking at (the cape), if anything. */
  look: Vec3 | null;
  /** 0 head carried high, 1 head down and horns forward for the charge. */
  headLow: number;
  /** 0–1: the upward hook of the head after the cape has passed. */
  toss: number;
  /** Which way the toss hooks: −1 left, 1 right. */
  tossSide: number;
  /** 0–1 through a bout of pawing the sand with the right foreleg, or null. */
  paw: number | null;
  /** 0–1: sitting back on the haunches to stop. */
  brake: number;
  /** 0–1: how roused the bull is (tail up, quicker breathing). */
  arousal: number;
  /** 0–1: lying down on the sand to rest, legs folded under; back to 0 to stand. */
  rest: number;
};

/** Lying down: the heights the withers and hips settle to, legs folded under. */
const LYING = { withers: 0.8, hips: 0.7 };

type Leg = {
  name: LegName;
  fore: boolean;
  side: number;
  planted: boolean;
  /** The hoof's point on the sand while planted; where it is while flying. */
  hoof: Vec3;
  from: Vec3;
  target: Vec3;
  swing: number;
  swingTime: number;
  lift: number;
  lastPhase: number;
  /** How folded the lower leg is, 0 straight to 1 tucked. */
  fold: number;
};

export type LegPose = {
  root: Vec3;
  mid: Vec3;
  knee: Vec3;
  fetlock: Vec3;
  hoof: Vec3;
  planted: boolean;
  fore: boolean;
  side: number;
};

export type BullPose = {
  heading: number;
  q: Quat;
  front: Vec3;
  rear: Vec3;
  /** The top line, tail to withers. */
  spine: Vec3[];
  withers: Vec3;
  tailhead: Vec3;
  belly: Vec3;
  brisket: Vec3;
  neckBase: Vec3;
  crest: Vec3;
  poll: Vec3;
  headQ: Quat;
  muzzle: Vec3;
  jaw: Vec3;
  eyes: [Vec3, Vec3];
  ears: [Vec3, Vec3];
  horns: [Vec3[], Vec3[]];
  legs: Record<LegName, LegPose>;
  tail: Vec3[];
  dewlap: Vec3[];
  /** Breathing, 0–1, for the flanks and the nostrils. */
  breath: number;
};

/** Hoofbeats and scrapes that kick up sand, collected by the scene. */
export type Kick = { at: Vec3; push: Vec3; amount: number };

const circularMix = (a: number, b: number, t: number) => {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (((a + d * t) % 1) + 1) % 1;
};

function blendGait(speed: number) {
  const toTrot = smoothstep(1.15, 1.7, speed);
  const toGallop = smoothstep(2.7, 3.5, speed);
  const mixGait = (a: Gait, b: Gait, t: number) => ({
    duty: mix(a.duty, b.duty, t),
    offsets: a.offsets.map((o, i) => circularMix(o, b.offsets[i], t)) as Gait["offsets"],
    lift: mix(a.lift, b.lift, t),
    frequency: mix(a.frequency(speed), b.frequency(speed), t),
  });
  const walkTrot = mixGait(WALK, TROT, toTrot);
  const gallop = {
    duty: GALLOP.duty,
    offsets: GALLOP.offsets,
    lift: GALLOP.lift,
    frequency: GALLOP.frequency(speed),
  };
  return {
    duty: mix(walkTrot.duty, gallop.duty, toGallop),
    offsets: walkTrot.offsets.map((o, i) => circularMix(o, gallop.offsets[i], toGallop)),
    lift: mix(walkTrot.lift, gallop.lift, toGallop),
    frequency: mix(walkTrot.frequency, gallop.frequency, toGallop),
    gallop: toGallop,
  };
}

export class Bull {
  front: Vec3;
  rear: Vec3;
  private velocity: Vec3 = { x: 0, y: 0, z: 0 };
  private speed = 0;
  private phase = 0;
  private gallop = 0;
  private readonly legs: Leg[];
  private readonly tail: Chain;
  private dewlapSwing = 0;
  private dewlapSpeed = 0;
  private lastBrisketY = 0;
  private breathPhase = 0;
  private time = 0;
  private headYaw = 0;
  private headPitch = 0;
  private headYawSpeed = 0;
  private headPitchSpeed = 0;
  private chestTurn = 0;
  private chestTurnSpeed = 0;
  private readonly moods = {
    headLow: { value: 0.3, speed: 0 },
    brake: { value: 0, speed: 0 },
    arousal: { value: 0.3, speed: 0 },
    rest: { value: 0, speed: 0 },
  };
  private pose: BullPose | null = null;
  readonly kicks: Kick[] = [];
  /** Counts hooves set down, for whoever listens for hoofbeats. */
  landings = 0;

  constructor(front: Vec3, heading: number) {
    this.front = flat(front);
    this.rear = addScaled(this.front, headingDir(heading), -BULL.bodyLength);
    this.legs = LEGS.map((name) => {
      const fore = name.endsWith("F");
      const side = name.startsWith("L") ? -1 : 1;
      const hoof = this.home(fore, side, heading);
      return {
        name,
        fore,
        side,
        planted: true,
        hoof,
        from: hoof,
        target: hoof,
        swing: 0,
        swingTime: 0.3,
        lift: 0,
        lastPhase: 0,
        fold: 0,
      };
    });
    this.tail = new Chain(
      {
        links: BULL.tail.links,
        linkLength: BULL.tail.linkLength,
        limpness: 0.3,
        damping: 0.99,
      },
      this.tailheadGuess(heading),
    );
  }

  get heading() {
    return headingOf(sub(this.front, this.rear));
  }

  get currentSpeed() {
    return this.speed;
  }

  /** Where a leg's hoof belongs under the standing body. */
  private home(fore: boolean, side: number, heading: number, at: Vec3 = fore ? this.front : this.rear): Vec3 {
    const f = headingDir(heading);
    const r = headingRight(heading);
    const spec = fore ? BULL.fore : BULL.hind;
    return flat(add(addScaled(at, f, fore ? 0.05 : 0.02), scale(r, spec.side * side)));
  }

  private tailheadGuess(heading: number) {
    return addScaled({ x: this.rear.x, y: BULL.hips - 0.02, z: this.rear.z }, headingDir(heading), -0.24);
  }

  step(dt: number, cue: BullDrive) {
    const drive = this.ease(cue, dt);
    this.time += dt;
    this.kicks.length = 0;
    const previous = this.front;
    this.front = flat(drive.front);
    const moved = sub(this.front, previous);
    const velocity = scale(moved, 1 / dt);
    // Speed is smoothed a touch: the legs read it, and a jittery speed makes a jittery stride.
    this.velocity = lerp(this.velocity, velocity, clamp(dt * 20, 0, 1));
    this.speed = Math.hypot(this.velocity.x, this.velocity.z);

    // The hips follow the withers at the body's length.
    const back = normalize(sub(this.rear, this.front), scale(headingDir(this.heading), -1));
    this.rear = addScaled(this.front, back, BULL.bodyLength);

    const heading = this.heading;
    const gait = blendGait(this.speed);
    this.gallop = gait.gallop;
    this.phase = (this.phase + gait.frequency * dt) % 1;
    this.breathPhase = (this.breathPhase + dt * mix(0.35, 1.1, drive.arousal)) % 1;
    this.stepLegs(dt, heading, gait, drive);
    this.pose = this.solve(dt, heading, drive);
  }

  /**
   * The cue's moods (head carriage, braking, arousal) change through the
   * body's own inertia: a cue that switches at once still moves the bull
   * smoothly.
   */
  private ease(cue: BullDrive, dt: number): BullDrive {
    const spring = (key: keyof Bull["moods"], stiffness: number) => {
      const state = this.moods[key];
      state.speed += (stiffness * (cue[key] - state.value) - 2 * Math.sqrt(stiffness) * state.speed) * dt;
      state.value += state.speed * dt;
      return state.value;
    };
    return {
      ...cue,
      headLow: spring("headLow", 70),
      brake: spring("brake", 90),
      arousal: spring("arousal", 20),
      rest: clamp(spring("rest", 14), 0, 1),
    };
  }

  private stepLegs(dt: number, heading: number, gait: ReturnType<typeof blendGait>, drive: BullDrive) {
    const moving = this.speed > STILL_SPEED;
    const dir = headingDir(heading);
    // Lying down or getting up, the hooves stay where they are: the folding is the only movement.
    if (drive.rest > 0.01) {
      for (const leg of this.legs) if (!leg.planted) this.land(leg);
      return;
    }
    for (let i = 0; i < 4; i++) {
      const leg = this.legs[i];
      const home = this.home(leg.fore, leg.side, heading);
      const pawing = drive.paw !== null && leg.name === "RF";
      if (pawing) {
        this.pawLeg(leg, dir, drive.paw ?? 0);
        continue;
      }
      if (!leg.planted) {
        leg.swing += dt / leg.swingTime;
        // Aim where the leg's root will be when it lands, half a stance ahead of it.
        const remaining = Math.max(0, 1 - leg.swing) * leg.swingTime;
        const stance = moving ? (this.speed * gait.duty) / Math.max(gait.frequency, 0.3) : 0;
        const brakeReach = leg.fore ? drive.brake * 0.32 : -drive.brake * 0.05;
        leg.target = flat(add(addScaled(home, this.velocity, remaining), scale(dir, stance * 0.5 + brakeReach)));
        if (leg.swing >= 1) this.land(leg);
        else this.fly(leg);
        continue;
      }
      const p = (((this.phase + gait.offsets[i]) % 1) + 1) % 1;
      const crossed = leg.lastPhase < gait.duty && p >= gait.duty;
      leg.lastPhase = p;
      const strain = flatDistance(leg.hoof, home);
      if (moving && (crossed || strain > 0.85)) {
        this.liftOff(leg, Math.max(0.12, (1 - gait.duty) / gait.frequency), gait.lift * clamp(this.speed / 2, 0.6, 1.4));
      } else if (!moving && strain > 0.15 && this.legsInAir() === 0 && this.mostStrained(heading) === leg) {
        this.liftOff(leg, 0.3, 0.07);
      }
    }
  }

  private legsInAir() {
    return this.legs.filter((l) => !l.planted).length;
  }

  private mostStrained(heading: number) {
    let best: Leg | null = null;
    let worst = 0;
    for (const leg of this.legs) {
      const strain = flatDistance(leg.hoof, this.home(leg.fore, leg.side, heading));
      if (leg.planted && strain > worst) {
        worst = strain;
        best = leg;
      }
    }
    return best;
  }

  private liftOff(leg: Leg, swingTime: number, lift: number) {
    leg.planted = false;
    leg.from = { ...leg.hoof };
    leg.swing = 0;
    leg.swingTime = swingTime;
    leg.lift = lift;
  }

  private fly(leg: Leg) {
    const s = leg.swing;
    const e = s * s * (3 - 2 * s);
    const ground = lerp(leg.from, leg.target, e);
    leg.hoof = {
      x: ground.x,
      y: leg.lift * Math.sin(Math.PI * Math.min(1, s * 1.08)) ** 0.85,
      z: ground.z,
    };
    leg.fold = Math.sin(Math.PI * s) ** 0.7 * clamp(leg.lift / 0.16, 0.5, 1.2);
  }

  private land(leg: Leg) {
    this.landings++;
    leg.planted = true;
    leg.hoof = flat(leg.target);
    leg.fold = 0;
    if (this.speed > 2.5) {
      const push = scale(this.velocity, 0.25);
      this.kicks.push({
        at: leg.hoof,
        push: { x: push.x, y: 0.6 + this.speed * 0.08, z: push.z },
        amount: clamp(this.speed / 7, 0.2, 1) * (leg.fore ? 1 : 0.8),
      });
    }
  }

  /** Pawing: lift the hoof, strike forward, drag it back through the sand, twice. */
  private pawLeg(leg: Leg, dir: Vec3, progress: number) {
    const scrapes = 2;
    const s = (progress * scrapes) % 1;
    if (leg.planted) {
      leg.planted = false;
      leg.from = { ...leg.hoof };
    }
    const anchor = leg.from;
    let forward: number;
    let height: number;
    if (s < 0.38) {
      const u = s / 0.38;
      forward = mix(-0.12 * (progress > 0.5 ? 1 : 0), 0.2, u);
      height = 0.17 * Math.sin(Math.PI * Math.min(1, u * 0.85));
    } else if (s < 0.5) {
      const u = (s - 0.38) / 0.12;
      forward = 0.2;
      height = 0.17 * Math.sin(Math.PI * 0.85) * (1 - u);
    } else if (s < 0.88) {
      const u = (s - 0.5) / 0.38;
      forward = mix(0.2, -0.12, u * u * (3 - 2 * u));
      height = 0;
      if (Math.abs(u - 0.5) < 0.12)
        this.kicks.push({
          at: leg.hoof,
          push: addScaled({ x: 0, y: 0.9, z: 0 }, dir, -1.6),
          amount: 0.35,
        });
    } else {
      const u = (s - 0.88) / 0.12;
      forward = -0.12;
      height = 0.05 * Math.sin(Math.PI * u);
    }
    // The last scrape eases back onto the home spot so the hoof can plant where it started.
    const settle = smoothstep(0.9, 1, progress);
    const pos = addScaled(anchor, dir, forward * (1 - settle));
    leg.hoof = { x: pos.x, y: height * (1 - settle), z: pos.z };
    leg.fold = clamp(height / 0.17, 0, 1) * 0.8;
    if (progress >= 0.999) {
      leg.planted = true;
      leg.hoof = flat(anchor);
      leg.fold = 0;
    }
  }

  /** Releases a leg that was pawing, planting it where it is. */
  endPaw() {
    const leg = this.legs[1];
    if (!leg.planted) {
      leg.planted = true;
      leg.hoof = flat(leg.hoof);
      leg.fold = 0;
    }
  }

  private solve(dt: number, heading: number, drive: BullDrive): BullPose {
    const g = this.gallop;
    const cycle = Math.PI * 2 * this.phase;
    const breath = 0.5 + 0.5 * Math.sin(Math.PI * 2 * this.breathPhase);
    // The gallop rocks the body: the back rounds as the hind legs reach under, stretches as the fore legs reach out.
    const bounce = g * 0.045 * Math.sin(cycle * 2);
    const rock = g * 0.06 * Math.sin(cycle + 0.6);
    const sitBack = drive.brake;
    const { front: kneel, hind: settle } = this.folds(drive.rest);
    const witherY = mix(BULL.withers + bounce + rock + sitBack * 0.04 - drive.headLow * 0.03, LYING.withers, kneel);
    const hipY = mix(BULL.hips + bounce - rock - sitBack * 0.12, LYING.hips, settle);

    // The chest turns towards where the body is going; the hips trail.
    // Weighted by speed from zero up, so the chest never snaps when the bull stops.
    const travel = this.speed > 0.02 ? headingOf(this.velocity) : heading;
    const wantTurn = clamp(angleDelta(heading, travel), -0.45, 0.45) * smoothstep(0.05, 2, this.speed);
    this.chestTurnSpeed += (120 * (wantTurn - this.chestTurn) - 2 * Math.sqrt(120) * this.chestTurnSpeed) * dt;
    this.chestTurn += this.chestTurnSpeed * dt;
    const chestHeading = heading + this.chestTurn;
    const pitch = Math.atan2(hipY - witherY, BULL.bodyLength);
    const q = bodyQuat(heading, pitch);
    const chestQ = bodyQuat(chestHeading, pitch);
    const withers = { x: this.front.x, y: witherY, z: this.front.z };
    const hips = { x: this.rear.x, y: hipY, z: this.rear.z };
    const tailhead = local(hips, q, -0.24, -0.02, 0);

    // The top line: a gentle dip behind the withers, rounded over the loin; the gallop flexes it.
    const flex = g * 0.05 * Math.sin(cycle + 2.2);
    const spine: Vec3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const point = lerp(tailhead, local(withers, chestQ, 0.04, 0, 0), t);
      point.y += Math.sin(Math.PI * t) * (0.015 + flex) - smoothstep(0.55, 0.85, t) * 0.03 * (1 - smoothstep(0.85, 1, t));
      spine.push(point);
    }
    const belly = local(lerp(hips, withers, 0.55), q, 0, -0.62 + breath * 0.012, 0);
    const brisket = local(withers, chestQ, 0.38, -0.78, 0);

    // Neck and head: the head drops for the charge, follows the cape, hooks up after it.
    const look = drive.look;
    let wantYaw = 0;
    let wantPitch = mix(-0.15, 0.62, drive.headLow);
    if (look) {
      const eye = local(withers, chestQ, 0.9, -0.1, 0);
      const toLook = sub(look, eye);
      // Head down in the charge, the bull can only hook a little: the horns stay on its line.
      const reach = mix(0.85, 0.42, drive.headLow);
      // Measured from where the head already points, so a cape passing behind never flips it to the other side.
      const raw = this.headYaw + angleDelta(this.headYaw, angleDelta(chestHeading, headingOf(toLook)));
      wantYaw = clamp(raw, -reach, reach);
      const lookPitch = Math.atan2(-toLook.y, Math.hypot(toLook.x, toLook.z));
      wantPitch = mix(wantPitch, clamp(lookPitch * 1.2 + 0.3, -0.2, 0.9), 0.35);
    }
    wantPitch -= drive.toss * 1.05;
    wantYaw += drive.toss * drive.tossSide * 0.5;
    // Necks have mass: the head turns quickly, but never jerks.
    const yawStiffness = 90;
    const pitchStiffness = drive.toss > 0.02 ? 260 : 80;
    this.headYawSpeed += (yawStiffness * (wantYaw - this.headYaw) - 2 * Math.sqrt(yawStiffness) * this.headYawSpeed) * dt;
    this.headPitchSpeed += (pitchStiffness * (wantPitch - this.headPitch) - 2 * Math.sqrt(pitchStiffness) * this.headPitchSpeed) * dt;
    this.headYaw += this.headYawSpeed * dt;
    this.headPitch += this.headPitchSpeed * dt;

    const neckBase = local(withers, chestQ, 0.3, -0.3, 0);
    const neckHeading = chestHeading + this.headYaw * 0.6;
    const neckAngle = mix(0.35, -0.55, clamp(this.headPitch / 0.9, -0.3, 1.2));
    const neckDir = add(scale(headingDir(neckHeading), Math.cos(neckAngle)), scale(UP, Math.sin(neckAngle)));
    const poll = addScaled(neckBase, neckDir, BULL.neck);
    const crest = add(lerp(neckBase, poll, 0.42), {
      x: 0,
      y: 0.2 + 0.06 * clamp(this.headPitch, 0, 1),
      z: 0,
    });
    const headQ = bodyQuat(chestHeading + this.headYaw, this.headPitch);
    const muzzle = local(poll, headQ, 0.34, -0.36, 0);
    const jaw = local(poll, headQ, 0.12, -0.3, 0);
    const eyes: [Vec3, Vec3] = [local(poll, headQ, 0.13, -0.1, -0.1), local(poll, headQ, 0.13, -0.1, 0.1)];
    const ears: [Vec3, Vec3] = [local(poll, headQ, -0.04, -0.03, -0.2), local(poll, headQ, -0.04, -0.03, 0.2)];
    const horn = (side: number) =>
      [
        [0.02, 0.0, 0.08],
        [0.04, 0.03, 0.2],
        [0.13, 0.07, 0.29],
        [0.26, 0.14, 0.3],
        [0.36, 0.25, 0.25],
      ].map(([f, u, r]) => local(poll, headQ, f, u, r * side));
    const horns: [Vec3[], Vec3[]] = [horn(-1), horn(1)];

    const legs = {} as Record<LegName, LegPose>;
    for (const leg of this.legs) legs[leg.name] = this.solveLeg(leg, leg.fore ? chestQ : q, leg.fore ? withers : hips, leg.fore ? kneel : settle);

    // The tail rises when the bull is roused and streams in the gallop.
    const tailRest = normalize(add(scale(headingDir(heading), -0.25 - drive.arousal * 0.75), scale(UP, mix(-1, 0.35, drive.arousal * 0.75))));
    this.tail.step(dt, tailhead, tailRest, 9.8);

    // The dewlap swings with the brisket's bounce, a little behind it.
    const brisketY = brisket.y;
    const lift = (brisketY - this.lastBrisketY) / Math.max(dt, 1e-4);
    this.lastBrisketY = brisketY;
    this.dewlapSpeed += (-this.dewlapSwing * 140 - this.dewlapSpeed * 9 - lift * 6) * dt;
    this.dewlapSwing = clamp(this.dewlapSwing + this.dewlapSpeed * dt, -0.08, 0.08);
    const dewlap: Vec3[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const p = lerp(jaw, brisket, t);
      p.y -= Math.sin(Math.PI * t) * (0.09 + this.dewlapSwing);
      dewlap.push(p);
    }

    return {
      heading,
      q,
      front: this.front,
      rear: this.rear,
      spine,
      withers,
      tailhead,
      belly,
      brisket,
      neckBase,
      crest,
      poll,
      headQ,
      muzzle,
      jaw,
      eyes,
      ears,
      horns,
      legs,
      tail: this.tail.points.map((p) => ({ ...p })),
      dewlap,
      breath,
    };
  }

  /**
   * How far the front and the hind end have gone down for a rest cue: the
   * front kneels first, the hind end follows; read backwards it is the
   * hind-first way of getting up.
   */
  private folds(rest: number) {
    return { front: smoothstep(0, 0.6, rest), hind: smoothstep(0.4, 1, rest) };
  }

  /** A leg folded under the lying body: knee (or hock) and fetlock on the sand. */
  private foldedLeg(leg: Leg, q: Quat, anchor: Vec3) {
    const spec = leg.fore ? BULL.fore : BULL.hind;
    const along = (forward: number, y: number, out: number) => {
      const p = local(anchor, q, forward, 0, (spec.side + out) * leg.side);
      return { x: p.x, y, z: p.z };
    };
    if (leg.fore) {
      // Kneeling: the knee forward on the sand, the cannon tucked back under the chest.
      const knee = along(0.2, 0.07, 0.02);
      const fetlock = along(-0.04, 0.05, 0.04);
      return { knee, fetlock, hoof: along(-0.13, 0.03, 0.05) };
    }
    // The hock out behind, the cannon lying forward along the sand, the hoof under the belly.
    const knee = along(-0.3, 0.1, 0.12);
    const fetlock = along(0.01, 0.05, 0.1);
    return { knee, fetlock, hoof: along(0.1, 0.03, 0.08) };
  }

  private solveLeg(leg: Leg, q: Quat, anchor: Vec3, folded: number): LegPose {
    const spec = leg.fore ? BULL.fore : BULL.hind;
    const root = local(anchor, q, leg.fore ? 0.06 : 0.02, -spec.drop, spec.side * leg.side);
    const dir = headingDir(headingOf(sub(this.front, this.rear)));
    const hoof = leg.hoof;
    const fetlock = add(addScaled(hoof, dir, -0.04), {
      x: 0,
      y: spec.pastern,
      z: 0,
    });
    if (folded > 0.001) return this.solveFolding(leg, q, anchor, root, { hoof, fetlock }, folded);
    let knee: Vec3;
    let pole: Vec3;
    if (leg.fore) {
      // A foreleg folds at the knee in its swing, the hoof tucking up behind.
      const fold = leg.fold * mix(1.0, 1.55, this.gallop);
      knee = add(fetlock, add(scale(UP, Math.cos(fold) * spec.cannon), scale(dir, Math.sin(fold) * spec.cannon)));
      pole = scale(dir, -1);
    } else {
      // A hind leg's hock sits behind the cannon and flexes as the leg swings through.
      const bend = 0.14 + leg.fold * 0.55;
      knee = add(fetlock, add(scale(UP, Math.cos(bend) * spec.cannon), scale(dir, -Math.sin(bend) * spec.cannon)));
      pole = dir;
    }
    const upper = solveTwoBone(root, knee, spec.upper, spec.lower, pole);
    return {
      root,
      mid: upper.mid,
      knee: upper.end,
      fetlock,
      hoof,
      planted: leg.planted,
      fore: leg.fore,
      side: leg.side,
    };
  }

  /** A leg on its way down to (or up from) lying folded: the standing pose blended into the folded one. */
  private solveFolding(leg: Leg, q: Quat, anchor: Vec3, root: Vec3, standing: { hoof: Vec3; fetlock: Vec3 }, folded: number): LegPose {
    const spec = leg.fore ? BULL.fore : BULL.hind;
    const dir = headingDir(headingOf(sub(this.front, this.rear)));
    const tucked = this.foldedLeg(leg, q, anchor);
    const standingKnee = leg.fore
      ? add(standing.fetlock, scale(UP, spec.cannon))
      : add(standing.fetlock, add(scale(UP, Math.cos(0.14) * spec.cannon), scale(dir, -Math.sin(0.14) * spec.cannon)));
    // The hoof leaves the sand last and comes back to it first: it swings on an arc, not through the ground.
    const hoof = lerp(standing.hoof, tucked.hoof, smoothstep(0.25, 1, folded));
    const fetlock = lerp(standing.fetlock, tucked.fetlock, smoothstep(0.1, 0.9, folded));
    const knee = lerp(standingKnee, tucked.knee, smoothstep(0, 0.8, folded));
    hoof.y = Math.max(hoof.y, 0.02);
    fetlock.y = Math.max(fetlock.y, 0.04);
    knee.y = Math.max(knee.y, 0.06);
    const upper = solveTwoBone(root, knee, spec.upper, spec.lower, leg.fore ? scale(dir, -1) : dir);
    return {
      root,
      mid: upper.mid,
      knee: upper.end,
      fetlock,
      hoof,
      planted: leg.planted,
      fore: leg.fore,
      side: leg.side,
    };
  }

  get current(): BullPose {
    if (!this.pose)
      this.pose = this.solve(1 / 240, this.heading, {
        front: this.front,
        look: null,
        headLow: 0,
        toss: 0,
        tossSide: 1,
        paw: null,
        brake: 0,
        arousal: 0,
        rest: 0,
      });
    return this.pose;
  }

  /** How far each planted hoof has moved since the last call: should be zero, and the tests check it. */
  plantedHooves() {
    return this.legs.map((l) => ({
      name: l.name,
      planted: l.planted,
      hoof: { ...l.hoof },
    }));
  }

  /** Distance from a point to the nearest horn tip: how close the horns came. */
  hornDistance(point: Vec3) {
    const pose = this.current;
    return Math.min(...pose.horns.map((h) => Math.min(...h.map((p) => distance(p, point)))));
  }
}
