import { TICK } from "./choreography";
import { Footwork, type FeetPose } from "./feet";
import { solveBody, type Intent, type Skeleton } from "./human";
import { add, addScaled, angleDelta, clamp, flat, headingDir, headingOf, lerp, smootherstep, sub, type Vec3 } from "./vec";

/*
 * One person on the sand: their footwork, and the two things about a body
 * that carry over from one tick to the next. Weight travels from foot to
 * foot with some mass; the eyes follow what they are told to watch, but a
 * neck turns only so far and never snaps from one shoulder to the other.
 *
 * The matador is one; the men who carry him out on their shoulders are
 * others. Each tick: ask for the footing, work out an intent from it, solve.
 */

export type Footing = { pose: FeetPose; centre: Vec3 };

export class Performer {
  readonly feet: Footwork;
  skeleton: Skeleton;
  intent: Intent;
  private weight = 0;
  private weightSpeed = 0;
  private gazeYaw = 0;
  private gazeSpeed = 0;

  constructor(feet: Footwork, intent: Intent) {
    this.feet = feet;
    this.intent = intent;
    const pose = feet.pose(0);
    this.skeleton = solveBody(intent, pose.left, pose.right);
  }

  /** Where the feet are now, and the middle of them on the sand. */
  footing(time: number): Footing {
    const pose = this.feet.pose(time);
    return { pose, centre: flat(lerp(pose.left.ankle, pose.right.ankle, 0.5)) };
  }

  /** Solves the body for an intent, adding the weight's travel and a steady gaze. */
  solve(intent: Intent, footing: Footing) {
    const { pose, centre } = footing;
    let next = this.shiftWeightOffStepping(intent, pose);
    next = this.steadyGaze(next, centre);
    this.intent = next;
    this.skeleton = solveBody(next, pose.left, pose.right);
    return this.skeleton;
  }

  /** A foot can't carry weight while it is in the air: the body leans onto the other one. */
  private shiftWeightOffStepping(intent: Intent, pose: FeetPose): Intent {
    const off = (s: number | null, kind: string | null) =>
      s === null ? 0 : (kind === "pivot" ? 0.35 : 0.85) * smootherstep(0, 0.2, s) * (1 - smootherstep(0.8, 1, s));
    const offL = off(pose.steppingL, pose.kindL);
    const offR = off(pose.steppingR, pose.kindR);
    const target = clamp(intent.weight + offL - offR, -0.95, 0.95);
    // Weight has mass: it travels from foot to foot, it never teleports.
    const stiffness = 190;
    this.weightSpeed += (stiffness * (target - this.weight) - 2 * Math.sqrt(stiffness) * this.weightSpeed) * TICK;
    this.weight += this.weightSpeed * TICK;
    const stepping = Math.max(offL, offR);
    // A walking body swings its arms against its legs.
    const swing = intent.handL === null ? (offL > offR ? 1 : -1) * stepping * 0.8 : 0;
    return { ...intent, weight: this.weight, armSwing: intent.armSwing + swing };
  }

  /**
   * The eyes follow what they're asked to, but when it goes behind the head
   * waits at the side it went, then swings across when it comes round.
   */
  private steadyGaze(intent: Intent, centre: Vec3): Intent {
    const chestHeading = intent.heading + intent.chestTurn;
    const eye = add(centre, { x: 0, y: 1.6, z: 0 });
    const toLook = sub(intent.look, eye);
    const wanted = this.gazeYaw + angleDelta(this.gazeYaw, angleDelta(chestHeading, headingOf(toLook)));
    const target = clamp(wanted, -1.25, 1.25);
    const stiffness = 260;
    this.gazeSpeed += (stiffness * (target - this.gazeYaw) - 2 * Math.sqrt(stiffness) * this.gazeSpeed) * TICK;
    this.gazeYaw += this.gazeSpeed * TICK;
    const far = Math.max(1, Math.hypot(toLook.x, toLook.z));
    const look = add(addScaled(eye, headingDir(chestHeading + this.gazeYaw), far), { x: 0, y: toLook.y, z: 0 });
    return { ...intent, look };
  }
}
