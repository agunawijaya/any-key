import type { BullPose } from "./bull";
import { Chain } from "./chain";
import { blendIntent, restIntent, TWO_HAND_GRIP, type Grip } from "./choreography";
import { Cloth, type Collider } from "./cloth";
import { Footwork, stancePlant } from "./feet";
import type { Intent, Skeleton } from "./human";
import { Performer } from "./performer";
import { add, addScaled, lerp, local, normalize, rightOf, smootherstep, sub, type Vec3 } from "./vec";

/*
 * Someone on the sand with a cape: the matador, or one of the two men of
 * his crew. A performer's body, the cloth in their hands, the tassels at
 * their knees and the fringes on their shoulders.
 *
 * What they do comes from their act, which the ring swaps as the afternoon
 * goes on. A new act never pops: for half a second it blends from wherever
 * the last one left the body.
 */

export const CAPE = {
  columns: 17,
  rows: 12,
  topWidth: 1.25,
  bottomWidth: 2.2,
  height: 1.12,
  mass: 2.6,
};

/** How hard the air pushes on the cape: heavy silk that billows open when it is swept. */
const CAPE_AIR = 1.5;

/** Hands hold a pinch of cloth: the pinned particles sit this far apart along the hands' line. */
const PINCH = 0.035;

/** How long a new act takes to blend in. */
const HANDOVER = 0.5;

export type ActInput = {
  time: number;
  /** The middle of the feet on the sand, now. */
  centre: Vec3;
  /** Between the horns. */
  bullHead: Vec3;
  bull: BullPose;
};

/** What one person is doing: an intent for the body and a grip on the cape, each tick. */
export interface Act {
  /** Ring time when it has played out; Infinity holds until something replaces it. */
  readonly until: number;
  intent(input: ActInput): Intent;
  grip(input: ActInput): Grip;
}

export type Role = "matador" | "crew";

export const BOTH_HANDS: Grip = { ...TWO_HAND_GRIP, rightHold: 1, leftHold: 1 };

/** Standing still, the cape held low in both hands, watching something. */
export class Holding implements Act {
  readonly until = Infinity;
  constructor(
    private readonly heading: number,
    private readonly look: (input: ActInput) => Vec3,
  ) {}

  intent(input: ActInput) {
    return restIntent(input.centre, this.heading, this.look(input));
  }

  grip() {
    return BOTH_HANDS;
  }
}

export class Torero {
  readonly performer: Performer;
  readonly cape: Cloth;
  readonly tassels: Chain[];
  readonly fringes: Chain[];
  grip: Grip = BOTH_HANDS;
  act: Act;
  private handover: Intent | null = null;
  private handoverTime = 0;
  private planned: Intent;

  constructor(
    readonly role: Role,
    at: Vec3,
    heading: number,
    look: Vec3,
  ) {
    const feet = new Footwork(stancePlant(at, heading, "L"), stancePlant(at, heading, "R"));
    this.performer = new Performer(feet, restIntent(at, heading, look));
    this.planned = this.performer.intent;
    this.act = new Holding(heading, () => look);

    this.cape = new Cloth(CAPE);
    this.cape.iterations = 4;
    this.cape.hangBetween(this.skeleton.gripR, this.skeleton.gripL, TWO_HAND_GRIP.right, TWO_HAND_GRIP.left);
    this.tassels = [-1, 1].map((side) => new Chain({ links: 3, linkLength: 0.038, limpness: 0.9, damping: 0.97 }, this.kneeAnchor(side)));
    this.fringes = this.fringeAnchors().map((a) => new Chain({ links: 2, linkLength: 0.034, limpness: 0.85, damping: 0.95 }, a));
  }

  get feet() {
    return this.performer.feet;
  }

  get skeleton(): Skeleton {
    return this.performer.skeleton;
  }

  get intent(): Intent {
    return this.performer.intent;
  }

  /** The intent as the act asked for it this tick, before weight and gaze were worked in. */
  get plannedIntent(): Intent {
    return this.planned;
  }

  /** Starts a new act now. */
  perform(act: Act, time: number) {
    this.handover = this.planned;
    this.handoverTime = time;
    this.act = act;
  }

  /** One tick of the body: the act's intent, blended in from the last act, solved over the feet. */
  update(time: number, bull: BullPose) {
    const footing = this.performer.footing(time);
    const input: ActInput = { time, centre: footing.centre, bullHead: lerp(bull.horns[0][1], bull.horns[1][1], 0.5), bull };
    let intent = this.act.intent(input);
    this.grip = this.act.grip(input);
    if (this.handover) intent = blendIntent(this.handover, intent, smootherstep(this.handoverTime, this.handoverTime + HANDOVER, time));
    // Kept before weight and gaze are worked out, which carry their own state and mustn't be applied twice.
    this.planned = intent;
    this.performer.solve(intent, footing);
  }

  /** The cloth, the tassels and the fringes: everything that only follows the body. */
  secondary(dt: number, wind: Vec3, others: Collider[]) {
    this.cape.colliders = [...this.bodyColliders(), ...others];
    this.cape.setPins(this.pins());
    this.cape.step(dt, { gravity: 9.8, wind, airDrag: CAPE_AIR });
    this.tassels.forEach((chain, i) => chain.step(dt, this.kneeAnchor(i === 0 ? -1 : 1), { x: 0, y: -1, z: 0 }, 9.8, wind));
    const anchors = this.fringeAnchors();
    this.fringes.forEach((chain, i) => chain.step(dt, anchors[i], { x: 0, y: -1, z: 0 }, 9.8, wind));
  }

  capeCentre(): Vec3 {
    const { pos, count } = this.cape;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i < count; i++) {
      x += pos[i * 3];
      y += pos[i * 3 + 1];
      z += pos[i * 3 + 2];
    }
    return { x: x / count, y: y / count, z: z / count };
  }

  /** The cloth particle a hand takes hold of, for picking the cape up off the sand. */
  gripParticle(hand: "right" | "left"): Vec3 {
    const { columns } = this.cape.shape;
    return this.cape.particle(Math.round((hand === "right" ? TWO_HAND_GRIP.right : TWO_HAND_GRIP.left) * (columns - 1)));
  }

  private kneeAnchor(side: number) {
    const s = this.skeleton;
    const knee = side < 0 ? s.kneeL : s.kneeR;
    return addScaled(knee, rightOf(s.pelvisQ), 0.055 * side);
  }

  private fringeAnchors(): Vec3[] {
    const s = this.skeleton;
    const anchors: Vec3[] = [];
    for (const [shoulder, side] of [
      [s.shoulderL, -1],
      [s.shoulderR, 1],
    ] as const) {
      for (const along of [-0.05, -0.017, 0.017, 0.05]) anchors.push(local(shoulder, s.chestQ, along, 0.01, side * 0.035));
    }
    return anchors;
  }

  private pins() {
    const s = this.skeleton;
    const { columns } = this.cape.shape;
    const across = normalize(sub(s.gripL, s.gripR), normalize(sub(s.shoulderL, s.shoulderR)));
    const pins = [];
    for (const [u, hold, grip] of [
      [this.grip.right, this.grip.rightHold, s.gripR],
      [this.grip.left, this.grip.leftHold, s.gripL],
    ] as const) {
      if (hold <= 0.001) continue;
      const c = Math.round(u * (columns - 1));
      // A pinch of cloth: the particle under the fist and its neighbour towards the other hand.
      pins.push({ index: c, target: addScaled(grip, across, -PINCH / 2), weight: hold });
      pins.push({ index: c + (u < 0.5 ? 1 : -1), target: addScaled(grip, across, (u < 0.5 ? 1 : -1) * PINCH), weight: hold * 0.9 });
    }
    return pins;
  }

  /** The body as the cloth feels it: trunk, head and legs. */
  bodyColliders(): Collider[] {
    const s = this.skeleton;
    return [
      { kind: "capsule", a: add(s.pelvis, { x: 0, y: 0.05, z: 0 }), b: s.neckBase, r: 0.15 },
      { kind: "sphere", c: s.head, r: 0.13 },
      { kind: "capsule", a: s.hipL, b: s.kneeL, r: 0.08 },
      { kind: "capsule", a: s.hipR, b: s.kneeR, r: 0.08 },
      { kind: "capsule", a: s.kneeL, b: s.footL.ankle, r: 0.06 },
      { kind: "capsule", a: s.kneeR, b: s.footR.ankle, r: 0.06 },
    ];
  }
}
