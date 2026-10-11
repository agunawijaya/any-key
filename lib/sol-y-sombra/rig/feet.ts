import { BODY, flatFoot, pivotingFoot, plantAfterPivot, steppingFoot, type FootPose, type Plant } from "./human";
import { add, angleDelta, headingDir, headingRight, scale, type Vec3 } from "./vec";

/*
 * Footwork: where each foot is planted and the steps that move it.
 *
 * Steps are booked ahead on a timeline. A foot stays exactly on its plant
 * until a booked step begins; the step then rolls it off the toe, swings it
 * and sets it down heel first, or turns it on the ball of the foot. Because
 * a foot only ever moves inside a step, it can't slide.
 */

export type Side = "L" | "R";
export type StepKind = "step" | "pivot";

type Booked = {
  side: Side;
  kind: StepKind;
  to: Plant;
  start: number;
  duration: number;
  lift: number;
  from?: Plant;
};

export type FeetPose = {
  left: FootPose;
  right: FootPose;
  /** Progress through each foot's current step, or null while it stands. */
  steppingL: number | null;
  steppingR: number | null;
  kindL: StepKind | null;
  kindR: StepKind | null;
};

export class Footwork {
  left: Plant;
  right: Plant;
  private booked: Booked[] = [];

  constructor(left: Plant, right: Plant) {
    this.left = left;
    this.right = right;
  }

  plant(side: Side) {
    return side === "L" ? this.left : this.right;
  }

  /** Where a foot will stand once every booked step has finished. */
  finalPlant(side: Side): Plant {
    const last = [...this.booked].reverse().find((b) => b.side === side);
    return last ? last.to : this.plant(side);
  }

  /** When the last booked step ends. */
  get busyUntil() {
    return this.booked.reduce((t, b) => Math.max(t, b.start + b.duration), 0);
  }

  book(side: Side, kind: StepKind, to: Plant, start: number, duration: number, lift = 0.07) {
    this.booked.push({ side, kind, to, start, duration, lift });
    this.booked.sort((a, b) => a.start - b.start);
  }

  clearAfter(time: number) {
    this.booked = this.booked.filter((b) => b.start < time);
  }

  pose(time: number): FeetPose {
    // Finish steps that are over, in booking order, so each next step starts from where the last one ended.
    const over = this.booked.filter((b) => b.start + b.duration <= time);
    for (const done of over) {
      if (done.side === "L") this.left = done.to;
      else this.right = done.to;
    }
    if (over.length) this.booked = this.booked.filter((b) => !over.includes(b));
    const active = (side: Side) => this.booked.find((b) => b.side === side && b.start <= time);
    const footFor = (side: Side) => {
      const step = active(side);
      const plant = this.plant(side);
      if (!step) return { foot: flatFoot(plant), progress: null, kind: null };
      step.from ??= plant;
      const s = (time - step.start) / step.duration;
      const foot = step.kind === "pivot" ? pivotingFoot(step.from, step.to, s) : steppingFoot(step.from, step.to, s, step.lift);
      return { foot, progress: s, kind: step.kind };
    };
    const l = footFor("L");
    const r = footFor("R");
    return {
      left: l.foot,
      right: r.foot,
      steppingL: l.progress,
      steppingR: r.progress,
      kindL: l.kind,
      kindR: r.kind,
    };
  }

  /** The middle of the stance, on the sand. */
  centre(): Vec3 {
    return {
      x: (this.left.at.x + this.right.at.x) / 2,
      y: 0,
      z: (this.left.at.z + this.right.at.z) / 2,
    };
  }

  meanHeading() {
    return this.left.heading + angleDelta(this.left.heading, this.right.heading) / 2;
  }

  /** The middle of the stance once every booked step has been taken: where a new walk starts from. */
  finalCentre(): Vec3 {
    const l = this.finalPlant("L").at;
    const r = this.finalPlant("R").at;
    return { x: (l.x + r.x) / 2, y: 0, z: (l.z + r.z) / 2 };
  }

  finalHeading() {
    const l = this.finalPlant("L").heading;
    return l + angleDelta(l, this.finalPlant("R").heading) / 2;
  }
}

/** The plant a foot takes in a stance around `centre` facing `heading`, feet `gap` from the middle, toes a little out. */
export function stancePlant(centre: Vec3, heading: number, side: Side, gap = 0.1): Plant {
  const s = side === "L" ? -1 : 1;
  const at = add(centre, scale(headingRight(heading), gap * s));
  return { at: { x: at.x, y: 0, z: at.z }, heading: heading - s * 0.12 };
}

/**
 * Turns the body on the spot from its current stance to `heading`, in as
 * many quarter turns as it needs: the inside foot turns on its ball, the
 * outside foot steps round to rejoin it.
 */
export function bookTurn(feet: Footwork, heading: number, start: number, duration: number, gap = 0.1) {
  const fromL = feet.finalPlant("L");
  const fromR = feet.finalPlant("R");
  const startHeading = fromL.heading + angleDelta(fromL.heading, fromR.heading) / 2;
  const total = angleDelta(startHeading, heading);
  const segments = Math.max(1, Math.ceil(Math.abs(total) / 1.3));
  const each = duration / segments;
  // Turning left, the left foot is on the inside of the turn.
  const inside: Side = total > 0 ? "L" : "R";
  const outside: Side = inside === "L" ? "R" : "L";
  let insidePlant = inside === "L" ? fromL : fromR;
  for (let k = 1; k <= segments; k++) {
    const h = startHeading + (total * k) / segments;
    const t0 = start + each * (k - 1);
    const turned = plantAfterPivot(insidePlant, h + (inside === "L" ? 0.12 : -0.12));
    feet.book(inside, "pivot", turned, t0, each * 0.85);
    // The outside foot lands beside the turned one, at the stance's width.
    const s = outside === "L" ? -1 : 1;
    const insideSide = inside === "L" ? -1 : 1;
    const centre = add(turned.at, scale(headingRight(h), -gap * insideSide));
    const to = {
      at: add(centre, scale(headingRight(h), gap * s)),
      heading: h - s * 0.12,
    };
    feet.book(outside, "step", { at: { x: to.at.x, y: 0, z: to.at.z }, heading: to.heading }, t0 + each * 0.3, each * 0.7, 0.05);
    insidePlant = turned;
  }
  return start + duration;
}

/**
 * Walks to a spot: turns to face the way first if it must, then each foot
 * passes the other, and the feet close together there; turns on the spot at
 * the end if the walk didn't arrive facing `heading`. Returns the heading
 * walked and when the walk starts, when the closing turn starts and when the
 * last step ends.
 */
export function bookWalk(feet: Footwork, to: Vec3, heading: number, start: number, stepLength = 0.55, stepTime = 0.5, gap = 0.1, lift = 0.07) {
  const from = feet.finalCentre();
  const span = Math.hypot(to.x - from.x, to.z - from.z);
  const travelHeading = span > 0.05 ? Math.atan2(-(to.z - from.z), to.x - from.x) : heading;
  const dir = headingDir(travelHeading);
  const steps = Math.max(1, Math.ceil(span / stepLength));
  const facing = feet.finalHeading();
  const about = Math.abs(angleDelta(facing, travelHeading));
  let t = about > 0.4 ? bookTurn(feet, travelHeading, start, 0.45 + about * 0.32, gap) : start;
  const walkStart = t;
  let side: Side = "R";
  for (let k = 1; k <= steps; k++) {
    const along = (k * span) / steps;
    const centre = {
      x: from.x + dir.x * along,
      y: 0,
      z: from.z + dir.z * along,
    };
    feet.book(side, "step", stancePlant(centre, travelHeading, side, gap), t, stepTime, lift);
    // The next foot peels off as this one lands: walking always keeps a foot down.
    t += stepTime * 0.8;
    side = side === "L" ? "R" : "L";
  }
  feet.book(side, "step", stancePlant(to, travelHeading, side, gap), t, stepTime * 0.8, 0.04);
  t += stepTime * 0.8;
  const turnStart = t;
  if (Math.abs(angleDelta(travelHeading, heading)) > 0.15) t = bookTurn(feet, heading, t, 0.5 + Math.abs(angleDelta(travelHeading, heading)) * 0.35, gap);
  return { travelHeading, walkStart, turnStart, end: t };
}

/**
 * Walks a winding route (a lap of the ring, a procession): each step lands
 * on the route, pointing along it, so the body follows the bends. Returns
 * when the walk starts and ends, and the heading of the route at any time
 * during it, for the body to turn with the feet.
 */
export function bookRoute(feet: Footwork, route: Vec3[], start: number, stepLength = 0.55, stepTime = 0.5, gap = 0.1) {
  const lengths = [0];
  for (let i = 1; i < route.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
  const total = lengths[lengths.length - 1];
  const at = (s: number): Vec3 => {
    const d = Math.min(Math.max(s, 0), total);
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < d) i++;
    const span = lengths[i] - lengths[i - 1];
    const t = span > 0 ? (d - lengths[i - 1]) / span : 0;
    return { x: route[i - 1].x + (route[i].x - route[i - 1].x) * t, y: 0, z: route[i - 1].z + (route[i].z - route[i - 1].z) * t };
  };
  const headingAt = (s: number) => {
    const a = at(s - 0.3);
    const b = at(s + 0.3);
    return Math.atan2(-(b.z - a.z), b.x - a.x);
  };
  const first = headingAt(0);
  const about = Math.abs(angleDelta(feet.finalHeading(), first));
  let t = about > 0.4 ? bookTurn(feet, first, start, 0.45 + about * 0.32, gap) : start;
  const walkStart = t;
  const steps = Math.max(1, Math.ceil(total / stepLength));
  const timeline: { time: number; heading: number }[] = [{ time: walkStart, heading: first }];
  let side: Side = "R";
  for (let k = 1; k <= steps; k++) {
    const s = (k * total) / steps;
    const heading = headingAt(s);
    feet.book(side, "step", stancePlant(at(s), heading, side, gap), t, stepTime, 0.07);
    timeline.push({ time: t + stepTime * 0.5, heading });
    t += stepTime * 0.8;
    side = side === "L" ? "R" : "L";
  }
  const last = headingAt(total);
  feet.book(side, "step", stancePlant(at(total), last, side, gap), t, stepTime * 0.8, 0.04);
  t += stepTime * 0.8;
  timeline.push({ time: t, heading: last });
  /** The body's heading at a time: eased between the steps' headings. */
  const heading = (time: number) => {
    if (time <= timeline[0].time) return first;
    for (let i = 1; i < timeline.length; i++) {
      const a = timeline[i - 1];
      const b = timeline[i];
      if (time <= b.time) return a.heading + angleDelta(a.heading, b.heading) * ((time - a.time) / Math.max(1e-6, b.time - a.time));
    }
    return last;
  };
  return { walkStart, end: t, heading, length: total };
}

/** A foot's sole width at its widest, for shadows. */
export const SOLE_LENGTH = BODY.toe + BODY.heel;
