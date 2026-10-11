import { TICK } from "./choreography";
import { bookWalk, Footwork, stancePlant } from "./feet";
import { footFromAnkle, solveBody, STAND_HEIGHT, type Intent, type Skeleton } from "./human";
import { Performer } from "./performer";
import { add, addScaled, bodyQuat, headingDir, headingOf, headingRight, lerp, normalize, scale, sub, type Vec3 } from "./vec";

/*
 * Carried out on shoulders: two men walk side by side towards the great gate
 * with the matador sitting across their shoulders, his legs hanging in front
 * of their chests, his arms raised to the crowd. Two more walk alongside.
 *
 * The carriers are ordinary performers with booked footsteps. The matador
 * rides on them: his pelvis is placed on their inner shoulders every tick,
 * so he sways and bobs with their stride.
 */

export type Walker = { performer: Performer; side: number; role: "carrier" | "attendant" };

const WALK_SPEED_STEP = 0.5;
const STEP_TIME = 0.56;

export class Procession {
  time = 0;
  readonly walkers: Walker[];
  hero: Skeleton;
  private readonly heading: number;
  /** Where they are walking to. */
  readonly gate: Vec3;

  /** The group starts at `from` and walks to `to` (the gate). */
  constructor(from: Vec3, to: Vec3) {
    this.gate = to;
    this.heading = headingOf(sub(to, from));
    const right = headingRight(this.heading);
    const forward = headingDir(this.heading);
    const place = (side: number, across: number, back: number) => {
      const centre = addScaled(addScaled(from, right, across * side), forward, -back);
      const feet = new Footwork(stancePlant(centre, this.heading, "L", 0.11), stancePlant(centre, this.heading, "R", 0.11));
      const goal = addScaled(addScaled(to, right, across * side), forward, -back);
      // Each starts with the other foot and a beat apart, so they don't march in step.
      bookWalk(feet, goal, this.heading, 0.15 + (side > 0 ? 0.28 : 0) + back * 0.2, WALK_SPEED_STEP, STEP_TIME, 0.11);
      return new Performer(feet, this.walking(centre, side, null));
    };
    this.walkers = [
      { performer: place(-1, 0.3, 0), side: -1, role: "carrier" },
      { performer: place(1, 0.3, 0), side: 1, role: "carrier" },
      { performer: place(-1, 1.2, -0.5), side: -1, role: "attendant" },
      { performer: place(1, 1.25, 0.3), side: 1, role: "attendant" },
    ];
    this.hero = this.rider();
  }

  /** Steps the procession on by `seconds`. */
  advance(seconds: number) {
    const ticks = Math.round(seconds / TICK);
    for (let i = 0; i < ticks; i++) this.step();
  }

  step() {
    this.time += TICK;
    const [left, right] = this.walkers;
    for (const walker of this.walkers) {
      const footing = walker.performer.footing(this.time);
      // Carriers hold the rider's knees; the rider is solved from last tick's carriers, close enough at 240 a second.
      const hold = walker.role === "carrier" ? (walker.side < 0 ? this.hero.kneeL : this.hero.kneeR) : null;
      walker.performer.solve(this.walking(footing.centre, walker.side, hold, walker.role === "attendant"), footing);
    }
    this.hero = this.rider(left.performer.skeleton, right.performer.skeleton);
  }

  /** A walker's intent: upright, facing the gate, the inner hand up holding the rider's knee if he carries. */
  private walking(centre: Vec3, side: number, hold: Vec3 | null, waving = false): Intent {
    const forward = headingDir(this.heading);
    const right = headingRight(this.heading);
    const look = add(addScaled(centre, forward, 8), { x: 0, y: 1.8, z: 0 });
    const intent: Intent = {
      heading: this.heading,
      weight: 0,
      crouch: hold ? 0.03 : 0.01,
      hipsForward: 0,
      pelvisLean: 0,
      pelvisTilt: 0,
      chestTurn: 0,
      chestLean: hold ? -0.04 : 0.02,
      chestTilt: hold ? side * 0.06 : 0,
      arch: 0.3,
      look,
      handL: null,
      handR: null,
      elbowL: null,
      elbowR: null,
      armSwing: 0,
    };
    if (hold) {
      const grip = add(hold, { x: 0, y: -0.05, z: 0 });
      // The inner arm comes up round the rider's leg; the outer one steadies his shin.
      const outerGrip = addScaled(addScaled(hold, forward, 0.12), { x: 0, y: -1, z: 0 }, 0.28);
      if (side < 0) {
        intent.handR = grip;
        intent.elbowR = normalize(add(scale(right, -0.4), { x: 0, y: -1, z: 0 }));
        intent.handL = outerGrip;
      } else {
        intent.handL = grip;
        intent.elbowL = normalize(add(scale(right, 0.4), { x: 0, y: -1, z: 0 }));
        intent.handR = outerGrip;
      }
    }
    if (waving) {
      // One arm up, cheering the rider on.
      const up = add(addScaled(addScaled(centre, right, side * 0.32), forward, 0.1), { x: 0, y: 2.05 + 0.05 * Math.sin(this.time * 9), z: 0 });
      if (side < 0) intent.handL = up;
      else intent.handR = up;
    }
    return intent;
  }

  /**
   * The matador on the carriers' shoulders: pelvis between their inner
   * shoulders, legs hanging in front of their chests, arms raised.
   */
  private rider(left?: Skeleton, right?: Skeleton): Skeleton {
    const forward = headingDir(this.heading);
    const side = headingRight(this.heading);
    const start = this.walkers[0].performer.feet.centre();
    const seat = left && right ? lerp(left.shoulderR, right.shoulderL, 0.5) : add(addScaled(start, side, 0.3), { x: 0, y: 1.42, z: 0 });
    const pelvisAt = add(seat, { x: 0, y: 0.1, z: 0 });
    // Shins hang in front of the carriers' chests, toes pointing down.
    const ankleAt = (s: number) => add(addScaled(addScaled(pelvisAt, forward, 0.36), side, 0.17 * s), { x: 0, y: -0.62, z: 0 });
    const footQ = bodyQuat(this.heading, 0.9);
    const footL = footFromAnkle(ankleAt(-1), footQ, 0);
    const footR = footFromAnkle(ankleAt(1), footQ, 0);
    const wave = Math.sin(this.time * 4.2);
    const intent: Intent = {
      heading: this.heading,
      weight: 0,
      // Placed by hand: as tall as the seat, the hips set back behind the hanging feet.
      crouch: STAND_HEIGHT - pelvisAt.y,
      hipsForward: -0.36 - 0.02,
      pelvisLean: -0.35,
      pelvisTilt: 0,
      chestTurn: 0.15 * wave,
      chestLean: 0.25,
      chestTilt: 0,
      arch: 0.9,
      look: add(addScaled(pelvisAt, side, 6 * wave), { x: 0, y: 6, z: 0 }),
      handL: add(addScaled(addScaled(pelvisAt, side, -0.42), forward, 0.05), { x: 0, y: 1.2 + 0.05 * wave, z: 0 }),
      handR: add(addScaled(addScaled(pelvisAt, side, 0.42), forward, 0.05), { x: 0, y: 1.2 - 0.05 * wave, z: 0 }),
      elbowL: normalize(add(scale(side, -1), { x: 0, y: -0.2, z: 0 })),
      elbowR: normalize(add(scale(side, 1), { x: 0, y: -0.2, z: 0 })),
      armSwing: 0,
    };
    return solveBody(intent, footL, footR);
  }

  /** The middle of the group on the sand. */
  centre() {
    return lerp(this.walkers[0].performer.feet.centre(), this.walkers[1].performer.feet.centre(), 0.5);
  }
}
