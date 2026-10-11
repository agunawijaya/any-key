import { comfortableReach, solveTwoBone } from "./ik";
import {
  add,
  addScaled,
  angleDelta,
  bodyQuat,
  clamp,
  forwardOf,
  headingDir,
  headingOf,
  headingRight,
  lerp,
  local,
  mix,
  mul,
  normalize,
  rightOf,
  rotate,
  scale,
  slerp,
  sub,
  upOf,
  type Quat,
  type Vec3,
} from "./vec";

/*
 * The human skeleton: pelvis, a three-part spine, neck and head, collar
 * bones, two-bone arms and legs, and feet that roll from heel to toe.
 *
 * Nothing here is keyframed. A pose is built from a handful of intentions
 * (where the feet are planted, where the weight sits, how the chest turns,
 * where the hands should be, what the eyes follow) and solved into joints.
 * The pelvis is always placed where both legs can reach their planted feet,
 * so a planted foot never slides or floats.
 */

export const BODY = {
  hipWidth: 0.092,
  thigh: 0.445,
  shin: 0.43,
  ankleHeight: 0.072,
  toe: 0.155,
  heel: 0.06,
  /** The ball of the foot, where a pivot turns. */
  ball: 0.105,
  lumbar: 0.12,
  thoracic: 0.15,
  chest: 0.18,
  neck: 0.085,
  headCentre: 0.1,
  headRadius: 0.1,
  shoulderWidth: 0.172,
  shoulderDrop: 0.04,
  upperArm: 0.29,
  forearm: 0.255,
  hand: 0.16,
};

/** Pelvis height standing tall with knees just soft. */
export const STAND_HEIGHT = 0.925;

/** The sole's thickness: where the toe, ball and heel touch the sand. */
const SOLE = 0.01;
/** From the ankle down to the sole, in the foot's own frame. */
const ANKLE_DROP = BODY.ankleHeight - SOLE;

/** A planted foot: the point on the sand under its ankle and the way it points. */
export type Plant = { at: Vec3; heading: number };

export type FootPose = {
  ankle: Vec3;
  toe: Vec3;
  heel: Vec3;
  /** Foot orientation: heading and pitch (toe up positive). */
  q: Quat;
  /** How much of the sole is on the sand, 0–1, for shadows and dust. */
  contact: number;
};

/** Where the body wants to be: the matador's moves are written in these terms. */
export type Intent = {
  /** The pelvis's heading. */
  heading: number;
  /** -1 all the weight on the left foot, 1 on the right. */
  weight: number;
  /** How far the pelvis sinks with bent knees, metres. */
  crouch: number;
  /** Forward or back push of the hips relative to the feet, metres. */
  hipsForward: number;
  pelvisLean: number;
  pelvisTilt: number;
  chestTurn: number;
  chestLean: number;
  chestTilt: number;
  /** The proud arch: chest up and out, hips forward. 0–1. */
  arch: number;
  /** What the eyes follow. */
  look: Vec3;
  /** Where each wrist should be; null lets the arm hang and swing. */
  handL: Vec3 | null;
  handR: Vec3 | null;
  /** Which way each elbow points, roughly; null for a relaxed elbow. */
  elbowL: Vec3 | null;
  elbowR: Vec3 | null;
  /** A hanging arm's swing, −1 back to 1 forward (the right arm swings opposite). */
  armSwing: number;
};

export type Skeleton = {
  pelvis: Vec3;
  pelvisQ: Quat;
  hipL: Vec3;
  hipR: Vec3;
  kneeL: Vec3;
  kneeR: Vec3;
  footL: FootPose;
  footR: FootPose;
  spine1: Vec3;
  spine2: Vec3;
  neckBase: Vec3;
  chestQ: Quat;
  neckTop: Vec3;
  head: Vec3;
  headQ: Quat;
  shoulderL: Vec3;
  shoulderR: Vec3;
  elbowL: Vec3;
  elbowR: Vec3;
  wristL: Vec3;
  wristR: Vec3;
  /** The fist's centre, where a hand holds cloth. */
  gripL: Vec3;
  gripR: Vec3;
  handTipL: Vec3;
  handTipR: Vec3;
};

/* ---------- Feet ---------- */

/** A foot standing flat on its plant. */
export function flatFoot(plant: Plant): FootPose {
  const q = bodyQuat(plant.heading);
  const ankle = { x: plant.at.x, y: BODY.ankleHeight, z: plant.at.z };
  return footFromAnkle(ankle, q, 1);
}

export function footFromAnkle(ankle: Vec3, q: Quat, contact: number): FootPose {
  return {
    ankle,
    toe: local(ankle, q, BODY.toe, -ANKLE_DROP, 0),
    heel: local(ankle, q, -BODY.heel, -ANKLE_DROP, 0),
    q,
    contact,
  };
}

/** A foot pitched about a point of the sole that stays where it is (the toe while the heel lifts, the heel while the toe comes down). */
function footPivoting(pivot: Vec3, pivotForward: number, heading: number, pitch: number, contact: number): FootPose {
  const q = bodyQuat(heading, -pitch);
  // The ankle sits above and behind (or ahead of) the pivot point, turned with the foot.
  const offset = rotate(q, { x: -pivotForward, y: ANKLE_DROP, z: 0 });
  return footFromAnkle(add(pivot, offset), q, contact);
}

const PEEL = 0.22;
const LAND = 0.82;
const PEEL_PITCH = -0.45;
const LAND_PITCH = 0.22;

/** The heel rising about the planted toe, picking up speed. */
const peeling = (toe: Vec3, heading: number, u: number) => footPivoting(toe, BODY.toe, heading, PEEL_PITCH * u * u, 1 - u * 0.5);
/** The toe coming down about the planted heel, slowing to a stop. */
const landing = (heel: Vec3, heading: number, u: number) => footPivoting(heel, -BODY.heel, heading, LAND_PITCH * (1 - u) * (1 - u), 0.5 + u * 0.5);

/** Cubic Hermite between two points with given end velocities (per unit of t). */
function hermite(p0: Vec3, v0: Vec3, p1: Vec3, v1: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return {
    x: h00 * p0.x + h10 * v0.x + h01 * p1.x + h11 * v1.x,
    y: h00 * p0.y + h10 * v0.y + h01 * p1.y + h11 * v1.y,
    z: h00 * p0.z + h10 * v0.z + h01 * p1.z + h11 * v1.z,
  };
}

/**
 * A step from one plant to another: the heel peels off, the foot swings,
 * the heel lands and the toe comes down. The swing leaves the peel and
 * meets the landing at their own speeds, so the foot never jerks between
 * phases.
 */
export function steppingFoot(from: Plant, to: Plant, s: number, lift: number): FootPose {
  const toeFrom = local({ x: from.at.x, y: SOLE, z: from.at.z }, bodyQuat(from.heading), BODY.toe, 0, 0);
  const heelTo = local({ x: to.at.x, y: SOLE, z: to.at.z }, bodyQuat(to.heading), -BODY.heel, 0, 0);
  if (s <= PEEL) return peeling(toeFrom, from.heading, s / PEEL);
  if (s >= LAND) return landing(heelTo, to.heading, (s - LAND) / (1 - LAND));

  const span = LAND - PEEL;
  const eps = 1e-3;
  const start = peeling(toeFrom, from.heading, 1);
  const end = landing(heelTo, to.heading, 0);
  // End speeds of the neighbouring phases, rescaled to the swing's own clock.
  const v0 = scale(sub(start.ankle, peeling(toeFrom, from.heading, 1 - eps).ankle), span / PEEL / eps);
  const v1 = scale(sub(landing(heelTo, to.heading, eps).ankle, end.ankle), span / (1 - LAND) / eps);
  const u = (s - PEEL) / span;
  const ankle = hermite(start.ankle, v0, end.ankle, v1, u);
  ankle.y += lift * Math.sin(Math.PI * u) ** 2;
  const e = u * u * (3 - 2 * u);
  const heading = from.heading + angleDelta(from.heading, to.heading) * e;
  // Pitch follows the same rule: leave the peel turning, arrive at the landing turning.
  const pitch = hermiteScalar(PEEL_PITCH, ((2 * PEEL_PITCH) / PEEL) * span, LAND_PITCH, ((-2 * LAND_PITCH) / (1 - LAND)) * span, u);
  return footFromAnkle(ankle, bodyQuat(heading, -pitch), 0);
}

function hermiteScalar(p0: number, v0: number, p1: number, v1: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * v0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * v1;
}

/** A foot turning on its ball with the heel just off the sand: how the body spins in place. */
export function pivotingFoot(from: Plant, to: Plant, s: number): FootPose {
  const ballFrom = local({ x: from.at.x, y: SOLE, z: from.at.z }, bodyQuat(from.heading), BODY.ball, 0, 0);
  const e = s * s * (3 - 2 * s);
  const heading = from.heading + angleDelta(from.heading, to.heading) * e;
  const ballTo = local({ x: to.at.x, y: SOLE, z: to.at.z }, bodyQuat(to.heading), BODY.ball, 0, 0);
  const ball = lerp(ballFrom, ballTo, e);
  return footPivoting(ball, BODY.ball, heading, -0.14 * Math.sin(Math.PI * s) ** 2, 0.6);
}

/** The plant a pivoting foot ends on, for a ball that stays put. */
export function plantAfterPivot(from: Plant, heading: number): Plant {
  const ball = local({ x: from.at.x, y: 0, z: from.at.z }, bodyQuat(from.heading), BODY.ball, 0, 0);
  const at = local(ball, bodyQuat(heading), -BODY.ball, 0, 0);
  return { at: { x: at.x, y: 0, z: at.z }, heading };
}

/* ---------- The whole body ---------- */

/** A smooth minimum: like Math.min, without the corner where the knees would snap. */
function softMin(a: number, b: number, k: number) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}

/**
 * The head turned towards a point, kept to what a neck can do. It ignores
 * the chest's lean and tilt: eyes keep the horizon level.
 */
function headTowards(head: Vec3, target: Vec3, chestHeading: number) {
  const dir = normalize(sub(target, head));
  const yaw = clamp(angleDelta(chestHeading, headingOf(dir)), -1.35, 1.35);
  const pitch = clamp(Math.atan2(-dir.y, Math.hypot(dir.x, dir.z)), -0.6, 0.9);
  return bodyQuat(chestHeading + yaw, pitch);
}

export function solveBody(intent: Intent, footL: FootPose, footR: FootPose): Skeleton {
  const pelvisQ = bodyQuat(intent.heading, intent.pelvisLean - intent.arch * 0.06, intent.pelvisTilt);
  const right = rightOf(pelvisQ);
  const forward = headingDir(intent.heading);

  // The pelvis rides over the weighted foot, a little ahead or behind as asked.
  const w = clamp((intent.weight + 1) / 2, 0, 1);
  const support = lerp(footL.ankle, footR.ankle, w);
  const middle = lerp(footL.ankle, footR.ankle, 0.5);
  const over = lerp(middle, support, 0.72);
  const hipOffsetL = rotate(pelvisQ, { x: 0, y: 0, z: -BODY.hipWidth });
  const hipOffsetR = rotate(pelvisQ, { x: 0, y: 0, z: BODY.hipWidth });
  const pelvisXZ = addScaled({ x: over.x, y: 0, z: over.z }, forward, intent.hipsForward + intent.arch * 0.025);

  // As high as asked, but never higher than both legs reach.
  const reach = comfortableReach(BODY.thigh, BODY.shin);
  const ceilingFor = (foot: FootPose, offset: Vec3) => {
    const dx = pelvisXZ.x + offset.x - foot.ankle.x;
    const dz = pelvisXZ.z + offset.z - foot.ankle.z;
    const flat2 = Math.min(dx * dx + dz * dz, reach * reach * 0.98);
    return foot.ankle.y - offset.y + Math.sqrt(reach * reach - flat2);
  };
  const wanted = STAND_HEIGHT - intent.crouch;
  // Smooth minimums all round: a hard one would kink the pelvis's path as the limiting leg changes.
  const ceiling = softMin(ceilingFor(footL, hipOffsetL), ceilingFor(footR, hipOffsetR), 0.05);
  const pelvis = {
    x: pelvisXZ.x,
    y: softMin(wanted, ceiling - 0.03, 0.06),
    z: pelvisXZ.z,
  };

  const hipL = add(pelvis, hipOffsetL);
  const hipR = add(pelvis, hipOffsetR);
  // Knees point over the toes, a touch outward.
  const kneePole = (foot: FootPose, side: number) => normalize(add(add(forwardOf(foot.q), scale(forward, 0.4)), scale(right, 0.15 * side)));
  const legL = solveTwoBone(hipL, footL.ankle, BODY.thigh, BODY.shin, kneePole(footL, -1), forward);
  const legR = solveTwoBone(hipR, footR.ankle, BODY.thigh, BODY.shin, kneePole(footR, 1), forward);

  // The spine bends from the pelvis to the chest in three parts, each taking its share of the turn.
  const chestQ = mul(pelvisQ, bodyQuat(intent.chestTurn, intent.chestLean - intent.arch * 0.1, intent.chestTilt));
  const q1 = slerp(pelvisQ, chestQ, 0.3);
  const q2 = slerp(pelvisQ, chestQ, 0.65);
  const lumbarBase = local(pelvis, pelvisQ, 0, 0.045, 0);
  const spine1 = local(lumbarBase, q1, 0.012 + intent.arch * 0.012, BODY.lumbar, 0);
  const spine2 = local(spine1, q2, -0.004, BODY.thoracic, 0);
  const neckBase = local(spine2, chestQ, -0.022 + intent.arch * 0.01, BODY.chest, 0);

  const chestHeading = headingOf(forwardOf(chestQ));
  const headGuess = local(neckBase, chestQ, 0.02, BODY.neck + BODY.headCentre, 0);
  const headQ = headTowards(headGuess, intent.look, chestHeading);
  const neckQ = slerp(chestQ, headQ, 0.45);
  const neckTop = local(neckBase, neckQ, 0.018, BODY.neck, 0);
  const head = local(neckTop, headQ, 0.025, BODY.headCentre, 0);

  const reachL = intent.handL ?? hangingHand(local(neckBase, chestQ, 0, -BODY.shoulderDrop, -BODY.shoulderWidth), chestQ, -1, intent.armSwing);
  const reachR = intent.handR ?? hangingHand(local(neckBase, chestQ, 0, -BODY.shoulderDrop, BODY.shoulderWidth), chestQ, 1, -intent.armSwing);
  const shoulderL = shoulder(neckBase, chestQ, -1, reachL);
  const shoulderR = shoulder(neckBase, chestQ, 1, reachR);
  // Should the wished-for elbow line up with the arm, elbows fall back to pointing behind and out.
  const elbowBack = (side: number) => normalize(add(scale(forwardOf(chestQ), -1), scale(rightOf(chestQ), 0.7 * side)));
  const armL = solveTwoBone(shoulderL, reachL, BODY.upperArm, BODY.forearm, intent.elbowL ?? relaxedElbow(chestQ, -1), elbowBack(-1));
  const armR = solveTwoBone(shoulderR, reachR, BODY.upperArm, BODY.forearm, intent.elbowR ?? relaxedElbow(chestQ, 1), elbowBack(1));
  const handL = hand(armL.mid, armL.end);
  const handR = hand(armR.mid, armR.end);

  return {
    pelvis,
    pelvisQ,
    hipL,
    hipR,
    kneeL: legL.mid,
    kneeR: legR.mid,
    footL: { ...footL, ankle: legL.end },
    footR: { ...footR, ankle: legR.end },
    spine1,
    spine2,
    neckBase,
    chestQ,
    neckTop,
    head,
    headQ,
    shoulderL,
    shoulderR,
    elbowL: armL.mid,
    elbowR: armR.mid,
    wristL: armL.end,
    wristR: armR.end,
    gripL: handL.grip,
    gripR: handR.grip,
    handTipL: handL.tip,
    handTipR: handR.tip,
  };
}

/** The collar bone lifts and swings forward a little when the hand reaches high or far. */
function shoulder(neckBase: Vec3, chestQ: Quat, side: number, handTarget: Vec3) {
  const rest = local(neckBase, chestQ, -0.015, -BODY.shoulderDrop, BODY.shoulderWidth * side);
  const toHand = sub(handTarget, rest);
  const up = upOf(chestQ);
  const raise = clamp((toHand.x * up.x + toHand.y * up.y + toHand.z * up.z + 0.1) / 0.5, 0, 1);
  const reachDir = normalize(toHand);
  return addScaled(addScaled(rest, up, 0.035 * raise), reachDir, 0.025);
}

/** A relaxed arm: the wrist just in front of the thigh, swinging with the stride. */
function hangingHand(shoulderAt: Vec3, chestQ: Quat, side: number, swing: number) {
  const down = BODY.upperArm + BODY.forearm - 0.05 - Math.abs(swing) * 0.03;
  return local(shoulderAt, chestQ, 0.04 + swing * 0.2, -down, side * 0.05);
}

function hand(elbow: Vec3, wrist: Vec3) {
  const along = normalize(sub(wrist, elbow));
  const down = { x: 0, y: -1, z: 0 };
  const dir = normalize(lerp(along, down, 0.35));
  return {
    grip: addScaled(wrist, dir, BODY.hand * 0.45),
    tip: addScaled(wrist, dir, BODY.hand),
  };
}

/* ---------- Helpers moves use ---------- */

/** Where the feet stand, together, facing a heading, around a point on the sand. */
export function feetTogether(centre: Vec3, heading: number, gap = 0.1): { left: Plant; right: Plant } {
  const r = headingRight(heading);
  return {
    left: {
      at: { x: centre.x - r.x * gap, y: 0, z: centre.z - r.z * gap },
      heading: heading + 0.12,
    },
    right: {
      at: { x: centre.x + r.x * gap, y: 0, z: centre.z + r.z * gap },
      heading: heading - 0.12,
    },
  };
}

/** A natural elbow direction: down, back and out from the body. */
export function relaxedElbow(chestQ: Quat, side: number): Vec3 {
  return normalize(add(add(scale(upOf(chestQ), -1), scale(forwardOf(chestQ), -0.35)), scale(rightOf(chestQ), 0.5 * side)));
}
