import { mix } from "@/lib/kit/color";
import { add, blob, capsule, clamp, curve, dist, ellipse, len, lerp, norm, perp, pt, rotate, scale, sub, type Painter, type Pt } from "./paint";

/*
 * The performers' bodies. A figure is a 2D skeleton posed in its own model
 * space (pelvis at the origin, y down, a standing adult about 113 units
 * tall), with two-bone IK for the arms and legs so a hand can be put exactly
 * on a key, a string or a drum head. `face` turns the body from facing the
 * audience (0) towards screen right (+1) or left (-1): shoulders narrow,
 * features slide round the head and the far side tucks behind.
 *
 * Arms and legs are named the player's own way: the right hand bows a
 * violin even when it is on the left of the screen.
 */

export type HairStyle = "short" | "crop" | "bob" | "bun" | "ponytail" | "long" | "curly" | "afro" | "bald" | "spiky" | "waves" | "hijab" | "cap" | "beanie" | "braids";
export type Outfit = "suit" | "gown" | "shirt" | "tee" | "hoodie" | "jacket" | "kebaya" | "tracksuit" | "tank" | "vest" | "sweater";

export type Look = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  outfit: Outfit;
  top: string;
  /** Collar, lapels, stripes, a tie. */
  trim: string;
  bottom: string;
  shoes: string;
  /** A long skirt or sarong over the legs. */
  skirt?: boolean;
  /** Short sleeves show the forearm. */
  shortSleeves?: boolean;
  glasses?: boolean;
  beard?: boolean;
  /** Headphones over the head, in this colour. */
  headphones?: string;
  /** Wider (above 1) or slimmer (below 1). */
  build?: number;
  /** Taller (above 1) or shorter. */
  height?: number;
  /** A printed or woven motif over the top, in `trim`'s colour. */
  pattern?: "batik" | "sequins" | "stripes";
};

export type Grip = "open" | "fist" | "pinch" | "flat" | "point" | "hold" | "relaxed";
export type Eyes = "open" | "closed" | "half" | "wide" | "up";

export type ArmPose = {
  hand: Pt;
  /** Which way the elbow points; by default out and down, away from the body. */
  elbow?: "out" | "in" | "up" | "down";
  /** 0 to 1: how much of the elbow's bend points at the audience and so foreshortens. */
  depth?: number;
  grip?: Grip;
  /** Hand direction in radians; by default it carries on from the forearm. */
  angle?: number;
};

export type LegPose = {
  foot: Pt;
  /** Put the knee here instead of solving for it: seated figures whose thighs point at the audience. */
  knee?: Pt;
  /** Toe direction: -1 left, 1 right, 0 towards us. */
  toe?: number;
};

export type Pose = {
  lean: number;
  face: number;
  /** Squash and stretch of the spine, 1 at rest. */
  spine?: number;
  /** Where the pelvis sits, in model space; normally the origin. */
  pelvis?: Pt;
  head: { tilt: number; nod: number; turn?: number; eyes: Eyes; mouth: number; brows?: number };
  arms: { left: ArmPose; right: ArmPose };
  legs: { left: LegPose; right: LegPose };
  /** 0 to 1: the chest swells on a breath in. */
  breath?: number;
};

/** Every joint, worked out from a pose. */
export type Skeleton = {
  pelvis: Pt;
  chest: Pt;
  neck: Pt;
  head: Pt;
  headR: { x: number; y: number };
  headAngle: number;
  axis: Pt;
  up: Pt;
  shoulder: { left: Pt; right: Pt };
  elbow: { left: Pt; right: Pt };
  wrist: { left: Pt; right: Pt };
  hip: { left: Pt; right: Pt };
  knee: { left: Pt; right: Pt };
  ankle: { left: Pt; right: Pt };
  /** Half the shoulder width as seen. */
  halfWidth: number;
  /** The torso's top corners as seen: wider than the shoulder joints once the body turns. */
  corner: { left: Pt; right: Pt };
  /** -1..1, how far the body has turned. */
  face: number;
  /** Which arm is nearer the audience when turned. */
  nearArm: "left" | "right";
};

const TORSO = 44;
const UPPER_ARM = 17;
const FOREARM = 15.5;
const THIGH = 19.5;
const SHIN = 18.5;
const NECK = 7;
const HEAD_RX = 10.8;
const HEAD_RY = 12.4;

/** Two-bone IK: the two places the middle joint can go so the end reaches `target`, and where the end lands. */
export function reach(root: Pt, target: Pt, a: number, b: number): { mids: [Pt, Pt]; end: Pt; straight: Pt } {
  const toTarget = sub(target, root);
  const d = clamp(len(toTarget), Math.abs(a - b) + 0.01, a + b - 0.01);
  const dir = norm(toTarget);
  // Law of cosines for the angle at the root.
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const angle = Math.acos(cosA);
  return {
    mids: [add(root, scale(rotate(dir, angle), a)), add(root, scale(rotate(dir, -angle), a))],
    end: add(root, scale(dir, d)),
    // Where the joint would appear if the whole bend pointed at the audience.
    straight: add(root, scale(dir, (d * a) / (a + b))),
  };
}

/** Of two candidate joints, the one furthest along a direction. */
const pick = (mids: [Pt, Pt], dir: Pt) => (mids[0].x * dir.x + mids[0].y * dir.y >= mids[1].x * dir.x + mids[1].y * dir.y ? mids[0] : mids[1]);

export function skeleton(look: Look, pose: Pose): Skeleton {
  const h = look.height ?? 1;
  const build = look.build ?? 1;
  const pelvis = pose.pelvis ?? pt(0, 0);
  const face = clamp(pose.face, -1, 1);
  const turnWidth = 0.62 + 0.38 * Math.cos((face * Math.PI) / 2);
  const up = rotate(pt(0, -1), pose.lean);
  const axis = rotate(pt(1, 0), pose.lean);
  const breath = pose.breath ?? 0;
  const chest = add(pelvis, scale(up, TORSO * h * (pose.spine ?? 1)));
  const halfWidth = 14.2 * build * turnWidth * (1 + breath * 0.04);
  // Seen side on, the two shoulders (and hips) close up behind each other, though the body keeps its depth.
  const spread = Math.max(0.16, Math.cos((face * Math.PI) / 2));
  const jointHalf = 13.2 * build * spread * (1 + breath * 0.04);
  // Turning shifts the shoulder line a little the way the body faces.
  const shift = scale(axis, face * 2.2);
  const lift = scale(up, -2.5 + breath * 0.8);
  const shoulderRight = add(add(chest, scale(axis, face * 3.5)), add(scale(axis, -jointHalf), lift));
  const shoulderLeft = add(add(chest, scale(axis, face * 3.5)), add(scale(axis, jointHalf), lift));
  const corner = { left: add(add(chest, shift), add(scale(axis, halfWidth), lift)), right: add(add(chest, shift), add(scale(axis, -halfWidth), lift)) };
  const neck = add(chest, add(scale(up, 2), scale(axis, face * 3)));
  const headAngle = pose.lean + pose.head.tilt;
  const headUp = rotate(pt(0, -1), headAngle);
  // A nod tips the head forward round the top of the neck.
  const nodDir = rotate(pt(face >= 0 ? 1 : -1, 0), headAngle);
  const head = add(add(neck, scale(headUp, NECK * h + HEAD_RY * 0.78)), add(scale(nodDir, pose.head.nod * 3 * Math.abs(face)), scale(headUp, -Math.abs(pose.head.nod) * 2.2)));
  const arm = (side: "left" | "right") => {
    const shoulder = side === "left" ? shoulderLeft : shoulderRight;
    const p = pose.arms[side];
    const { mids, end, straight } = reach(shoulder, p.hand, UPPER_ARM * h, FOREARM * h);
    const outward = side === "left" ? 1 : -1;
    const hint = p.elbow ?? "out";
    const dir = hint === "out" ? pt(outward, 0.35) : hint === "in" ? pt(-outward, 0.2) : hint === "up" ? pt(0, -1) : pt(0, 1);
    const elbow = lerp(pick(mids, dir), straight, clamp(p.depth ?? 0));
    return { shoulder, elbow, wrist: end };
  };
  const leg = (side: "left" | "right") => {
    const hip = add(pelvis, scale(axis, (side === "left" ? 8 : -8) * build * spread));
    const p = pose.legs[side];
    if (p.knee) {
      // A knee placed by hand: the shin hangs from it, at its own length.
      const shin = sub(p.foot, p.knee);
      return { hip, knee: p.knee, ankle: add(p.knee, scale(norm(shin), Math.min(len(shin), SHIN * h))) };
    }
    const { mids, end, straight } = reach(hip, p.foot, THIGH * h, SHIN * h);
    // Knees bend the way the body faces; seen from the front, that bend points at us and foreshortens.
    const forward = face === 0 ? pt(side === "left" ? 1 : -1, 0) : pt(Math.sign(face), 0);
    const knee = lerp(straight, pick(mids, forward), clamp(Math.abs(face) * 1.2 + 0.08));
    return { hip, knee, ankle: end };
  };
  const l = arm("left");
  const r = arm("right");
  const ll = leg("left");
  const rl = leg("right");
  return {
    pelvis,
    chest,
    neck,
    head,
    headR: { x: HEAD_RX * (0.94 + 0.06 * turnWidth), y: HEAD_RY },
    headAngle,
    axis,
    up,
    shoulder: { left: l.shoulder, right: r.shoulder },
    elbow: { left: l.elbow, right: r.elbow },
    wrist: { left: l.wrist, right: r.wrist },
    hip: { left: ll.hip, right: rl.hip },
    knee: { left: ll.knee, right: rl.knee },
    ankle: { left: ll.ankle, right: rl.ankle },
    halfWidth,
    corner,
    face,
    nearArm: face >= 0 ? "right" : "left",
  };
}

/** A body ready to draw in pieces, so instruments can slot in between them. */
export class Figure {
  readonly look: Look;
  pose!: Pose;
  sk!: Skeleton;
  private p: Painter;

  constructor(painter: Painter, look: Look) {
    this.p = painter;
    this.look = look;
  }

  set(pose: Pose) {
    this.pose = pose;
    this.sk = skeleton(this.look, pose);
    return this;
  }

  /** Everything, in the usual order, for a performer whose instrument sits in front. */
  draw() {
    this.legs();
    this.torso();
    this.head();
    this.arm("left");
    this.arm("right");
  }

  // ---------- Legs ----------

  legs(only?: "left" | "right") {
    const { look, sk, p } = this;
    const sides: ("left" | "right")[] = only ? [only] : sk.face >= 0 ? ["left", "right"] : ["right", "left"];
    for (const side of sides) {
      const hip = sk.hip[side];
      const knee = sk.knee[side];
      const ankle = sk.ankle[side];
      this.shoe(side);
      const trousers = look.skirt ? look.skin : look.bottom;
      p.part(capsule(knee, ankle, 5.2, 4), trousers);
      p.part(capsule(hip, knee, 6.6, 5.4), look.bottom);
    }
    if (look.skirt) this.skirt();
  }

  private shoe(side: "left" | "right") {
    const { look, sk, p, pose } = this;
    const ankle = sk.ankle[side];
    const toe = pose.legs[side].toe ?? (sk.face === 0 ? (side === "left" ? 0.25 : -0.25) : Math.sign(sk.face));
    const along = clamp(toe, -1, 1);
    const tip = add(ankle, pt(along * 9, 3.2));
    const heel = add(ankle, pt(-along * 3, 2.6));
    p.part(capsule(heel, tip, 3.6, 3.4 + (1 - Math.abs(along)) * 1.2), look.shoes, { inkScale: 0.9 });
  }

  private skirt() {
    const { look, sk, p } = this;
    const waistL = add(sk.pelvis, add(scale(sk.axis, 11), scale(sk.up, 4)));
    const waistR = add(sk.pelvis, add(scale(sk.axis, -11), scale(sk.up, 4)));
    const kneeMid = lerp(sk.knee.left, sk.knee.right, 0.5);
    const low = Math.max(sk.ankle.left.y, sk.ankle.right.y) - 3;
    const spread = Math.max(14, Math.abs(sk.knee.left.x - sk.knee.right.x) / 2 + 7);
    const hemL = pt(kneeMid.x + spread + 3, low);
    const hemR = pt(kneeMid.x - spread - 3, low);
    p.part(blob([waistL, add(lerp(waistL, hemL, 0.5), pt(3, 0)), hemL, pt(kneeMid.x, low + 2), hemR, add(lerp(waistR, hemR, 0.5), pt(-3, 0)), waistR], 0.7), look.bottom);
  }

  // ---------- Torso ----------

  torso() {
    const { look, sk, p } = this;
    const { chest, pelvis, axis, up, halfWidth } = sk;
    const o = (base: Pt, x: number, y: number) => add(base, add(scale(axis, x), scale(up, y)));
    const w = halfWidth;
    const hipW = 10.5 * (look.build ?? 1) * (w / 14.2);
    const waist = lerp(pelvis, chest, 0.42);
    const shape = [
      o(chest, -w * 0.45, 3.2),
      o(chest, w * 0.45, 3.2),
      o(sk.corner.left, 1.5, 0.5),
      o(sk.corner.left, 2.6, -6),
      o(waist, w * 0.78, 0),
      o(pelvis, hipW, -1),
      o(pelvis, hipW * 0.9, -4.5),
      o(pelvis, -hipW * 0.9, -4.5),
      o(pelvis, -hipW, -1),
      o(waist, -w * 0.78, 0),
      o(sk.corner.right, -2.6, -6),
      o(sk.corner.right, -1.5, 0.5),
    ];
    // The belt line of the trousers peeks out under a short top.
    p.part(blob([o(pelvis, hipW, 0), o(pelvis, hipW * 0.95, 4.5), o(pelvis, -hipW * 0.95, 4.5), o(pelvis, -hipW, 0), o(pelvis, -hipW * 0.8, -6), o(pelvis, hipW * 0.8, -6)]), look.bottom, { rim: false });
    const torso = blob(shape, 0.85);
    p.part(torso, look.top);
    if (look.pattern) this.motif(torso);
    this.outfitDetail(o, w);
  }

  /** A motif clipped to the top: batik's interlocking ovals, sequins, or stripes. */
  private motif(torso: Path2D) {
    const { look, sk, p } = this;
    const { ctx } = p;
    const c = sk.chest;
    ctx.save();
    ctx.clip(torso);
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = look.trim;
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = 0.7;
    if (look.pattern === "batik") {
      // Kawung: four ovals round a dot, repeated on a diagonal grid.
      for (let y = -6; y < 54; y += 7) {
        for (let x = -24; x <= 24; x += 7) {
          const at = { x: c.x + x + ((y / 7) % 2 ? 3.5 : 0), y: c.y + y };
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2 + Math.PI / 4;
            ctx.beginPath();
            ctx.ellipse(at.x + Math.cos(a) * 1.9, at.y + Math.sin(a) * 1.9, 1.7, 0.9, a, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillRect(at.x - 0.4, at.y - 0.4, 0.8, 0.8);
        }
      }
    } else if (look.pattern === "sequins") {
      for (let y = -6; y < 54; y += 2.6) for (let x = -24; x <= 24; x += 2.6) ctx.fillRect(c.x + x + ((y * 0.38) % 1.3), c.y + y, 0.9, 0.9);
    } else {
      for (let x = -30; x <= 30; x += 5) ctx.fillRect(c.x + x, c.y - 8, 1.6, 64);
    }
    ctx.restore();
  }

  private outfitDetail(o: (base: Pt, x: number, y: number) => Pt, w: number) {
    const { look, sk, p } = this;
    const { chest, pelvis, face } = sk;
    const cx = face * 4;
    const ink = (path: Path2D, color: string, width = 1.1, alpha = 1) => p.line(path, color, width, alpha);
    switch (look.outfit) {
      case "suit":
      case "jacket": {
        // Shirt front, then lapels folding over it.
        p.part(blob([o(chest, cx - 4.6, 2.6), o(chest, cx + 4.6, 2.6), o(chest, cx + 1.2, -16), o(chest, cx - 1.2, -16)], 0.4), look.trim, { rim: false });
        p.part(blob([o(chest, cx + 4.8, 2.8), o(chest, cx + 8.5, -3), o(chest, cx + 4.5, -6), o(chest, cx + 1.4, -17)], 0.3), look.top, { shade: false });
        p.part(blob([o(chest, cx - 4.8, 2.8), o(chest, cx - 8.5, -3), o(chest, cx - 4.5, -6), o(chest, cx - 1.4, -17)], 0.3), look.top, { shade: false });
        if (look.outfit === "suit") {
          // A bow tie.
          const knot = o(chest, cx, 1.2);
          p.part(blob([add(knot, pt(-4.2, -1.8)), add(knot, pt(-0.6, -0.4)), add(knot, pt(-4.2, 2)), add(knot, pt(4.2, 2)), add(knot, pt(0.6, -0.4)), add(knot, pt(4.2, -1.8))], 0.5), "#1b1720", { rim: false, shade: false });
        }
        const button = o(chest, cx + 0.4, -20);
        p.flat(ellipse(button.x, button.y, 1, 1), "#00000055");
        break;
      }
      case "gown": {
        const neckline = curve([o(chest, -w * 0.5, 2.4), o(chest, cx, -5), o(chest, w * 0.5, 2.4)]);
        ink(neckline, look.trim, 1.6, 0.9);
        p.part(blob([o(chest, -w * 0.36, 2.8), o(chest, cx, -4), o(chest, w * 0.36, 2.8), o(chest, cx, 3.2)], 0.6), look.skin, { ink: false, rim: false });
        break;
      }
      case "kebaya": {
        // A fitted blouse with a lace edge and a brooch at the front.
        ink(curve([o(chest, cx - 1, 3), o(chest, cx - 2.5, -14), o(pelvis, cx - 4, -2)]), look.trim, 1.4, 0.95);
        for (let i = 0; i < 6; i++) {
          const at = o(chest, cx - 2 - i * 0.25, -i * 3.6);
          p.flat(ellipse(at.x, at.y, 1.1, 1.1), look.trim, 0.85);
        }
        const brooch = o(chest, cx - 2, -4);
        p.part(ellipse(brooch.x, brooch.y, 2.2, 2.2), "#e8c35a", { rim: false });
        break;
      }
      case "hoodie": {
        p.part(blob([o(chest, -w * 0.62, 1.5), o(chest, -w * 0.4, 6), o(chest, w * 0.4, 6), o(chest, w * 0.62, 1.5), o(chest, cx, -2)], 0.7), look.trim, { rim: false });
        ink(curve([o(chest, cx - 2.4, -1), o(chest, cx - 2.6, -11)]), look.trim, 1.2);
        ink(curve([o(chest, cx + 2.4, -1), o(chest, cx + 2.6, -11)]), look.trim, 1.2);
        p.part(blob([o(pelvis, cx - 9, 3), o(pelvis, cx + 9, 3), o(pelvis, cx + 7.5, 12), o(pelvis, cx - 7.5, 12)], 0.4), look.top, { rim: false });
        break;
      }
      case "tracksuit": {
        p.part(blob([o(chest, cx - 3.4, 2.6), o(chest, cx + 3.4, 2.6), o(chest, cx, -3)], 0.4), look.trim, { rim: false });
        ink(curve([o(chest, cx, -3), o(pelvis, cx, -5)]), look.trim, 1.2, 0.9);
        ink(curve([o(chest, -w + 1, 0), o(waist(sk), -w * 0.8, 0)]), look.trim, 2, 0.95);
        ink(curve([o(chest, w - 1, 0), o(waist(sk), w * 0.8, 0)]), look.trim, 2, 0.95);
        break;
      }
      case "tee":
      case "tank": {
        ink(curve([o(chest, cx - 5, 2.6), o(chest, cx, -1.8), o(chest, cx + 5, 2.6)]), look.trim, 1.6);
        break;
      }
      case "shirt": {
        p.part(blob([o(chest, cx - 4, 3), o(chest, cx - 0.4, -3), o(chest, cx - 6, 1.2)], 0.3), look.trim, { rim: false, shade: false });
        p.part(blob([o(chest, cx + 4, 3), o(chest, cx + 0.4, -3), o(chest, cx + 6, 1.2)], 0.3), look.trim, { rim: false, shade: false });
        ink(curve([o(chest, cx, -3), o(pelvis, cx, -3)]), look.trim, 0.9, 0.6);
        break;
      }
      case "vest": {
        p.part(blob([o(chest, cx - 4, 3), o(chest, cx + 4, 3), o(chest, cx + 2, -14), o(pelvis, cx, -6), o(chest, cx - 2, -14)], 0.4), look.trim, { rim: false });
        break;
      }
      case "sweater": {
        p.part(blob([o(chest, -w * 0.4, 3), o(chest, w * 0.4, 3), o(chest, w * 0.36, 0.5), o(chest, -w * 0.36, 0.5)], 0.6), look.trim, { rim: false });
        for (let i = 0; i < 3; i++) ink(curve([o(pelvis, -w * 0.8, -3 - i * 1.8), o(pelvis, w * 0.8, -3 - i * 1.8)]), look.trim, 0.8, 0.55);
        break;
      }
    }
  }

  // ---------- Head ----------

  head() {
    const { look, sk, p, pose } = this;
    const { head, headR, headAngle, face } = sk;
    const rx = headR.x;
    const ry = headR.y;
    const local = (x: number, y: number) => add(head, rotate(pt(x, y), headAngle));
    const turn = clamp(face + (pose.head.turn ?? 0), -1, 1);
    // Neck.
    p.part(capsule(sk.neck, local(0, ry * 0.55), 4.2, 3.8), look.skin, { rim: false });
    this.hairBack(local, rx, ry, turn);
    // Ears: the far one hides as the head turns.
    for (const s of [-1, 1]) {
      const showing = 1 - clamp(turn * s * 1.6);
      if (showing < 0.25) continue;
      const ear = local(s * rx * (0.98 - Math.abs(turn) * 0.25) - turn * 3, 1.5);
      p.part(ellipse(ear.x, ear.y, 2.4 * showing + 0.6, 3.4, headAngle), look.skin, { inkScale: 0.8 });
    }
    // The skull and jaw: a soft egg, narrower at the chin, the chin following the turn.
    const shapePts = [
      local(0, -ry),
      local(rx * 0.86, -ry * 0.72),
      local(rx, 0),
      local(rx * 0.82 + turn * 1.5, ry * 0.58),
      local(turn * 3.2, ry * 1.02),
      local(-rx * 0.82 + turn * 1.5, ry * 0.58),
      local(-rx, 0),
      local(-rx * 0.86, -ry * 0.72),
    ];
    p.part(blob(shapePts, 1), look.skin);
    this.features(local, rx, ry, turn);
    this.hairFront(local, rx, ry, turn);
    if (look.glasses) this.glasses(local, rx, turn);
    if (look.headphones) this.headphones(local, rx, ry, turn);
  }

  private features(local: (x: number, y: number) => Pt, rx: number, ry: number, turn: number) {
    const { look, p, pose } = this;
    const eyeY = 1.6;
    const spread = 4.6 * (1 - Math.abs(turn) * 0.35);
    const centre = turn * rx * 0.48;
    const eyes = pose.head.eyes;
    const ink = "#2a1d26";
    const blinkSquash = eyes === "half" ? 0.45 : 1;
    // Cheeks first, under everything.
    for (const s of [-1, 1]) {
      const at = local(centre + s * (spread + 2.2), eyeY + 4.6);
      p.flat(ellipse(at.x, at.y, 2.6, 1.6), "#ff7a8a", 0.22);
    }
    for (const s of [-1, 1]) {
      const far = Math.sign(turn) === -s;
      const size = far ? 1 - Math.abs(turn) * 0.45 : 1;
      if (far && Math.abs(turn) > 0.85) continue;
      const at = local(centre + s * spread * (far ? 0.82 : 1), eyeY);
      if (eyes === "closed") {
        p.line(curve([add(at, pt(-2.2 * size, -0.4)), add(at, pt(0, 1.2)), add(at, pt(2.2 * size, -0.4))]), ink, 1.15);
      } else if (eyes === "up") {
        p.line(curve([add(at, pt(-2.2 * size, 0.8)), add(at, pt(0, -1)), add(at, pt(2.2 * size, 0.8))]), ink, 1.15);
      } else {
        const ex = 1.55 * size;
        const ey = (eyes === "wide" ? 2.6 : 2.15) * blinkSquash;
        p.flat(ellipse(at.x + turn * 0.5, at.y, ex, ey, this.sk.headAngle), ink);
        p.flat(ellipse(at.x + turn * 0.5 - 0.5, at.y - ey * 0.4, 0.55, 0.55), "#ffffff", 0.9);
      }
      // Brows.
      const lift = (pose.head.brows ?? 0) * 1.4;
      const browAt = local(centre + s * spread * (far ? 0.82 : 1), eyeY - 4.2 - lift);
      // Inner end a touch higher than the outer: calm, not cross.
      p.line(curve([add(browAt, pt(-2 * size * s, -0.35)), add(browAt, pt(0, -0.6)), add(browAt, pt(2.2 * size * s, 0.35))]), look.hair, 1.15, 0.9);
    }
    // Nose: a small hook pointing the way the head faces.
    const nose = local(centre + turn * 2.2, eyeY + 4.2);
    p.line(curve([add(nose, pt(-turn * 0.5, -2.2)), add(nose, pt(turn * 1.6, 0.2)), add(nose, pt(-turn * 0.6, 0.8))]), "#00000040", 1);
    // Mouth: a smile, opening into an oval when singing or calling out.
    const mouth = local(centre + turn * 1.6, eyeY + 8.2);
    const open = pose.head.mouth;
    if (open > 0.15) {
      p.part(ellipse(mouth.x, mouth.y + open * 0.8, 2.2 + open * 0.6, 0.8 + open * 2.2), "#5a2632", { shade: false, rim: false, inkScale: 0.6 });
    } else {
      p.line(curve([add(mouth, pt(-2.4, -0.3)), add(mouth, pt(0, 0.9)), add(mouth, pt(2.4, -0.3))]), "#5a2632", 1.05, 0.9);
    }
    if (look.beard) {
      // A beard follows the jaw from ear to ear; the mouth and upper lip stay clear.
      const outer = [local(-rx * 0.98, ry * 0.18), local(-rx * 0.8 + turn * 1.5, ry * 0.68), local(turn * 3.2, ry * 1.12), local(rx * 0.8 + turn * 1.5, ry * 0.68), local(rx * 0.98, ry * 0.18)];
      const inner = [local(rx * 0.72 + turn * 1.5, ry * 0.24), local(rx * 0.5 + turn * 2, ry * 0.62), local(turn * 3, ry * 0.84), local(-rx * 0.5 + turn * 2, ry * 0.62), local(-rx * 0.72 + turn * 1.5, ry * 0.24)];
      p.part(blob([...outer, ...inner], 0.55), mix(look.hair, look.skin, 0.12), { rim: false, inkScale: 0.7 });
      p.line(curve([add(mouth, pt(-3, -1.1)), add(mouth, pt(0, -1.7)), add(mouth, pt(3, -1.1))]), look.hair, 1.3, 0.85);
    }
  }

  private hairBack(local: (x: number, y: number) => Pt, rx: number, ry: number, turn: number) {
    const { look, p } = this;
    const c = look.hair;
    switch (look.hairStyle) {
      case "long":
      case "waves":
        p.part(blob([local(-rx * 1.05, -ry * 0.5), local(rx * 1.05, -ry * 0.5), local(rx * 1.2, ry * 1.2), local(rx * 0.7 - turn * 3, ry * 1.9), local(-rx * 0.7 - turn * 3, ry * 1.9), local(-rx * 1.2, ry * 1.2)], 0.9), c);
        break;
      case "bob":
        p.part(blob([local(-rx * 1.12, -ry * 0.4), local(rx * 1.12, -ry * 0.4), local(rx * 1.18, ry * 0.75), local(-rx * 1.18, ry * 0.75)], 0.9), c);
        break;
      case "ponytail": {
        const tail = local(-turn * rx * 1.1, -ry * 0.1);
        p.part(capsule(local(-turn * rx * 0.9, -ry * 0.4), add(tail, pt(-turn * 6, 14)), 4.2, 2.2), c);
        break;
      }
      case "braids":
        for (const s of [-1, 1]) p.part(capsule(local(s * rx * 0.95, 0), local(s * rx * 1.05, ry * 1.9), 3, 2), c);
        break;
      case "afro":
        p.part(blob([local(-rx * 1.5, -ry * 0.2), local(-rx * 1.1, -ry * 1.35), local(0, -ry * 1.6), local(rx * 1.1, -ry * 1.35), local(rx * 1.5, -ry * 0.2), local(rx * 1.2, ry * 0.5), local(-rx * 1.2, ry * 0.5)], 1), c);
        break;
      case "curly":
        p.part(blob([local(-rx * 1.25, -ry * 0.1), local(-rx * 1.05, -ry * 1.1), local(0, -ry * 1.3), local(rx * 1.05, -ry * 1.1), local(rx * 1.25, -ry * 0.1), local(rx * 1.05, ry * 0.45), local(-rx * 1.05, ry * 0.45)], 1), c);
        break;
      case "hijab":
        p.part(blob([local(-rx * 1.25, -ry * 0.1), local(-rx * 1.0, -ry * 1.15), local(0, -ry * 1.3), local(rx * 1.0, -ry * 1.15), local(rx * 1.25, -ry * 0.1), local(rx * 1.35, ry * 1.4), local(0, ry * 1.85), local(-rx * 1.35, ry * 1.4)], 0.9), c);
        break;
      default:
        break;
    }
  }

  private hairFront(local: (x: number, y: number) => Pt, rx: number, ry: number, turn: number) {
    const { look, p } = this;
    const c = look.hair;
    const part = turn * rx * 0.35;
    switch (look.hairStyle) {
      case "short":
      case "crop":
      case "waves":
      case "long":
      case "bob":
      case "ponytail":
      case "braids": {
        const fringe = look.hairStyle === "crop" ? 0.62 : look.hairStyle === "short" ? 0.5 : 0.36;
        p.part(
          blob(
            [
              local(-rx * 1.04, -ry * 0.05),
              local(-rx * 0.95, -ry * 0.78),
              local(part, -ry * 1.1),
              local(rx * 0.95, -ry * 0.78),
              local(rx * 1.04, -ry * 0.05),
              local(rx * 0.6, -ry * fringe),
              local(part + 2, -ry * (fringe - 0.12)),
              local(-rx * 0.5, -ry * fringe),
            ],
            0.9,
          ),
          c,
        );
        break;
      }
      case "bun": {
        p.part(blob([local(-rx * 1.02, -ry * 0.1), local(-rx * 0.9, -ry * 0.85), local(0, -ry * 1.08), local(rx * 0.9, -ry * 0.85), local(rx * 1.02, -ry * 0.1), local(rx * 0.5, -ry * 0.55), local(-rx * 0.5, -ry * 0.55)], 0.9), c);
        const bun = local(-turn * 4, -ry * 1.22);
        p.part(ellipse(bun.x, bun.y, 5.2, 4.4), c);
        break;
      }
      case "curly":
      case "afro": {
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * (1.05 + (i / 6) * 0.9);
          const at = local(Math.cos(a) * rx * 0.85 + part * 0.3, Math.sin(a) * ry * 0.95 - 1);
          p.part(ellipse(at.x, at.y, 3.6, 3.2), c, { rim: i % 2 === 0 });
        }
        break;
      }
      case "spiky": {
        const pts: Pt[] = [local(-rx * 1.02, -ry * 0.2)];
        for (let i = 0; i <= 6; i++) {
          const x = -rx + (i / 6) * rx * 2;
          pts.push(local(x * 0.95, -ry * (i % 2 ? 1.0 : 1.32)));
        }
        pts.push(local(rx * 1.02, -ry * 0.2), local(rx * 0.4, -ry * 0.62), local(-rx * 0.4, -ry * 0.62));
        p.part(blob(pts, 0.35), c);
        break;
      }
      case "hijab":
        p.part(blob([local(-rx * 0.98, ry * 0.2), local(-rx * 0.9, -ry * 0.7), local(0, -ry * 1.02), local(rx * 0.9, -ry * 0.7), local(rx * 0.98, ry * 0.2), local(rx * 0.8, -ry * 0.25), local(0, -ry * 0.62), local(-rx * 0.8, -ry * 0.25)], 0.9), c);
        break;
      case "cap": {
        p.part(blob([local(-rx * 1.06, -ry * 0.25), local(-rx * 0.9, -ry * 1.0), local(0, -ry * 1.18), local(rx * 0.9, -ry * 1.0), local(rx * 1.06, -ry * 0.25)], 0.9), look.trim);
        const brim = Math.sign(turn || 1);
        p.part(blob([local(-rx * 0.6 + turn * 4, -ry * 0.32), local(rx * 0.6 + turn * 4, -ry * 0.32), local(rx * 0.5 + brim * 6 + turn * 6, -ry * 0.12), local(-rx * 0.5 + turn * 6, -ry * 0.12)], 0.6), look.trim);
        break;
      }
      case "beanie":
        p.part(blob([local(-rx * 1.08, -ry * 0.3), local(-rx * 0.9, -ry * 1.08), local(0, -ry * 1.28), local(rx * 0.9, -ry * 1.08), local(rx * 1.08, -ry * 0.3)], 0.9), look.trim);
        p.part(capsule(local(-rx * 1.08, -ry * 0.32), local(rx * 1.08, -ry * 0.32), 2.4, 2.4), look.trim);
        break;
      default:
        break;
    }
  }

  private glasses(local: (x: number, y: number) => Pt, rx: number, turn: number) {
    const spread = 4.6 * (1 - Math.abs(turn) * 0.35);
    const centre = turn * rx * 0.48;
    const frame = "#2b2230";
    for (const s of [-1, 1]) {
      if (Math.sign(turn) === -s && Math.abs(turn) > 0.85) continue;
      const at = local(centre + s * spread, 1.6);
      this.p.line(ellipse(at.x, at.y, 3, 2.6), frame, 0.9);
    }
    this.p.line(curve([local(centre - spread + 3, 1.2), local(centre + spread - 3, 1.2)]), frame, 0.9);
  }

  private headphones(local: (x: number, y: number) => Pt, rx: number, ry: number, turn: number) {
    const { p, look } = this;
    const c = look.headphones!;
    p.line(curve([local(-rx * 1.08, 0), local(-rx * 0.9, -ry * 1.12), local(0, -ry * 1.3), local(rx * 0.9, -ry * 1.12), local(rx * 1.08, 0)]), c, 2.6);
    for (const s of [-1, 1]) {
      const showing = 1 - clamp(turn * s * 1.6);
      if (showing < 0.2) continue;
      const at = local(s * rx * (1.02 - Math.abs(turn) * 0.2) - turn * 3, 1);
      p.part(ellipse(at.x, at.y, 2.6 + showing * 1.4, 5), c);
    }
  }

  // ---------- Arms and hands ----------

  /** Upper arm, forearm and (unless told not to) the hand. */
  arm(side: "left" | "right", { hand = true, sleeveOnly = false }: { hand?: boolean; sleeveOnly?: boolean } = {}) {
    const { look, sk, p } = this;
    const shoulder = sk.shoulder[side];
    const elbow = sk.elbow[side];
    const wrist = sk.wrist[side];
    const sleeve = look.outfit === "tank" ? look.skin : look.top;
    const fore = look.shortSleeves || look.outfit === "tank" ? look.skin : look.top;
    p.part(capsule(elbow, wrist, 4.3, 3.4), fore);
    if (look.shortSleeves && look.outfit !== "tank") p.part(capsule(shoulder, lerp(shoulder, elbow, 0.55), 5.6, 5), sleeve);
    p.part(capsule(shoulder, elbow, 5.4, 4.5), look.outfit === "tank" ? look.skin : sleeve);
    if (look.shortSleeves && look.outfit !== "tank") p.part(capsule(shoulder, lerp(shoulder, elbow, 0.5), 5.8, 5.2), sleeve, { shade: false });
    if (!look.shortSleeves && look.outfit !== "tank" && !sleeveOnly) {
      // A cuff where the sleeve ends.
      const cuff = lerp(elbow, wrist, 0.93);
      p.part(ellipse(cuff.x, cuff.y, 3.6, 3.6), look.outfit === "suit" ? look.trim : look.top, { rim: false });
    }
    if (hand) this.hand(side);
  }

  hand(side: "left" | "right") {
    const { look, sk, p, pose } = this;
    const wrist = sk.wrist[side];
    const arm = pose.arms[side];
    const dir = arm.angle !== undefined ? pt(Math.cos(arm.angle), Math.sin(arm.angle)) : norm(sub(wrist, sk.elbow[side]));
    const grip = arm.grip ?? "relaxed";
    const across = perp(dir);
    // The thumb is on the inside of the hand: which side that is flips with the arm and the facing.
    const thumbSide = (side === "right" ? 1 : -1) * (sk.face < -0.3 ? -1 : 1) * (dir.y < 0 ? -1 : 1);
    const palm = add(wrist, scale(dir, 3.4));
    const skin = look.skin;
    switch (grip) {
      case "fist":
      case "hold": {
        p.part(ellipse(palm.x, palm.y, 3.9, 3.4, Math.atan2(dir.y, dir.x)), skin);
        const thumb = add(palm, scale(across, 2.6 * thumbSide));
        p.part(capsule(thumb, add(thumb, scale(dir, 2.6)), 1.3, 1.1), skin, { inkScale: 0.8 });
        break;
      }
      case "flat": {
        const tip = add(palm, scale(dir, 4));
        p.part(blob([add(wrist, scale(across, 2.8)), add(tip, scale(across, 3.2)), add(tip, scale(dir, 1.6)), add(tip, scale(across, -3.2)), add(wrist, scale(across, -2.8))], 0.8), skin);
        p.part(capsule(add(palm, scale(across, 3 * thumbSide)), add(palm, add(scale(across, 5.2 * thumbSide), scale(dir, 1.6))), 1.3, 1.1), skin, { inkScale: 0.8 });
        break;
      }
      case "point": {
        p.part(ellipse(palm.x, palm.y, 3.6, 3.2, Math.atan2(dir.y, dir.x)), skin);
        p.part(capsule(add(palm, scale(dir, 2)), add(palm, scale(dir, 7)), 1.3, 1.1), skin, { inkScale: 0.8 });
        break;
      }
      case "pinch": {
        p.part(ellipse(palm.x, palm.y, 3.5, 3.1, Math.atan2(dir.y, dir.x)), skin);
        p.part(capsule(add(palm, scale(across, 2.2 * thumbSide)), add(palm, add(scale(dir, 3.4), scale(across, 0.6 * thumbSide))), 1.25, 1), skin, { inkScale: 0.8 });
        break;
      }
      case "open": {
        p.part(ellipse(palm.x, palm.y, 3.6, 3.2, Math.atan2(dir.y, dir.x)), skin);
        for (let f = -1.5; f <= 1.5; f += 1) {
          const base = add(palm, add(scale(dir, 2.2), scale(across, f * 1.6)));
          p.part(capsule(base, add(base, add(scale(dir, 3.6 - Math.abs(f) * 0.5), scale(across, f * 0.7))), 0.95, 0.85), skin, { inkScale: 0.7, rim: false });
        }
        p.part(capsule(add(palm, scale(across, 2.4 * thumbSide)), add(palm, add(scale(across, 4.8 * thumbSide), scale(dir, 1))), 1.2, 1), skin, { inkScale: 0.8 });
        break;
      }
      default: {
        p.part(blob([add(wrist, scale(across, 2.6)), add(palm, add(scale(across, 3.2), scale(dir, 2))), add(palm, scale(dir, 4.2)), add(palm, add(scale(across, -3.2), scale(dir, 2))), add(wrist, scale(across, -2.6))], 0.8), skin);
        break;
      }
    }
  }

  /** Where the lips are: for a mouthpiece, a reed or a microphone. */
  mouth(): Pt {
    const { sk, pose } = this;
    const turn = clamp(sk.face + (pose.head.turn ?? 0), -1, 1);
    return add(sk.head, rotate(pt(turn * sk.headR.x * 0.48 + turn * 1.6, 9.8), sk.headAngle));
  }

  /** Where a hand's fingertips are, for props that sit in the hand. */
  grip(side: "left" | "right", out = 3.6): Pt {
    const { sk, pose } = this;
    const arm = pose.arms[side];
    const dir = arm.angle !== undefined ? pt(Math.cos(arm.angle), Math.sin(arm.angle)) : norm(sub(sk.wrist[side], sk.elbow[side]));
    return add(sk.wrist[side], scale(dir, out));
  }

  /** Distance from shoulder to wrist at full stretch: for checks that a target is reachable. */
  static armReach(look: Look) {
    return (UPPER_ARM + FOREARM) * (look.height ?? 1);
  }
}

const waist = (sk: Skeleton) => lerp(sk.pelvis, sk.chest, 0.42);

/** A gentle sway or bob from a phase in beats: a performer feeling the pulse. */
export const sway = (beats: number, amount: number, phase = 0) => Math.sin((beats + phase) * Math.PI) * amount;

/** Shortest distance from a point to a segment: for click tests on bows, sticks and necks. */
export function nearSegment(p: Pt, a: Pt, b: Pt) {
  const ab = sub(b, a);
  const t = clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1));
  return dist(p, add(a, scale(ab, t)));
}
