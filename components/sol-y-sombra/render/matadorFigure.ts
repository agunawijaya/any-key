import type { Skeleton } from "@/lib/sol-y-sombra/rig/human";
import { add, cross, dot, local, normalize, rightOf, scale, sub, type Quat, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import { NEAR, type Camera } from "./camera";
import type { DrawItem } from "./bullFigure";
import { capsulePath, discPath, smoothLinePath } from "./shapes";

/*
 * The matador, dressed: the suit of lights as tapered pieces with ink
 * outlines, a shirt front and tie that show when he faces us, gold down the
 * outside of each thigh, tassels and fringe, and a head that shows which way
 * he looks: a face (eyes, brows, a nose that sticks out in profile, a mouth),
 * ears, a hairline, the small black ornament pinned at the back of the head,
 * and the two-lobed hat.
 */

export type MatadorColours = {
  ink: string;
  /** Breeches; the jacket too unless `jacket` is given. */
  suit: string;
  jacket?: string;
  gold: string;
  skin: string;
  skinShade: string;
  hair: string;
  stocking: string;
  slipper: string;
  hat: string;
  shirt: string;
  tie: string;
};

type Key = "suit" | "jacket" | "gold" | "skin" | "stocking" | "slipper" | "hand";
type Limb = [Vec3, Vec3, number, number, Key];

/** The body as tapered pieces, with what each is made of. */
export function matadorLimbs(s: Skeleton): Limb[] {
  return [
    [s.footL.heel, s.footL.toe, 0.035, 0.03, "slipper"],
    [s.footR.heel, s.footR.toe, 0.035, 0.03, "slipper"],
    [s.kneeL, s.footL.ankle, 0.052, 0.04, "stocking"],
    [s.kneeR, s.footR.ankle, 0.052, 0.04, "stocking"],
    // Tight breeches, a narrow sash at the waist, a short jacket broad across the shoulders.
    [s.hipL, s.kneeL, 0.074, 0.054, "suit"],
    [s.hipR, s.kneeR, 0.074, 0.054, "suit"],
    [s.hipL, s.hipR, 0.085, 0.085, "suit"],
    [s.pelvis, s.spine1, 0.105, 0.11, "gold"],
    [s.spine1, s.spine2, 0.115, 0.145, "jacket"],
    [s.spine2, s.neckBase, 0.15, 0.11, "jacket"],
    [s.shoulderL, s.shoulderR, 0.065, 0.065, "gold"],
    [s.neckBase, s.neckTop, 0.048, 0.045, "skin"],
    [s.shoulderL, s.elbowL, 0.055, 0.045, "jacket"],
    [s.shoulderR, s.elbowR, 0.055, 0.045, "jacket"],
    [s.elbowL, s.wristL, 0.045, 0.034, "jacket"],
    [s.elbowR, s.wristR, 0.045, 0.034, "jacket"],
    [s.wristL, s.handTipL, 0.033, 0.024, "hand"],
    [s.wristR, s.handTipR, 0.033, 0.024, "hand"],
  ];
}

/**
 * A hand: a palm, four two-jointed fingers and a thumb, in the hand's own
 * frame. Holding the cape the fingers curl into a fist round the cloth; free,
 * they open and spread a little. The palm faces the way the wrist bends.
 */
function handItem(
  ctx: CanvasRenderingContext2D,
  elbow: Vec3,
  wrist: Vec3,
  tip: Vec3,
  side: number,
  hold: number,
  camera: Camera,
  c: MatadorColours,
): DrawItem | null {
  const along = normalize(sub(tip, wrist));
  const forearm = normalize(sub(wrist, elbow));
  const bend = sub(along, forearm);
  let palm = sub(bend, scale(along, dot(bend, along)));
  if (Math.hypot(palm.x, palm.y, palm.z) < 1e-3) palm = sub({ x: 0, y: -1, z: 0 }, scale(along, -along.y));
  palm = normalize(palm, { x: 0, y: -1, z: 0 });
  // Right hand: thumb on the left of the fingers, seen from the back of the hand; mirrored for the left.
  const thumbSide = scale(normalize(cross(palm, along)), -side);
  const curl = 0.2 + 0.7 * hold;
  const at = (origin: Vec3, a: number, b: number, n: number) => add(add(add(origin, scale(along, a)), scale(thumbSide, b)), scale(palm, n));
  const fingerDir = (angle: number) => normalize(add(scale(along, Math.cos(angle)), scale(palm, Math.sin(angle))));

  type Bone = { a: Vec3; b: Vec3; ra: number; rb: number };
  const bones: Bone[] = [];
  const knuckles = at(wrist, 0.075, 0, 0);
  bones.push({ a: at(wrist, 0.012, 0.004, 0), b: at(wrist, 0.064, 0.002, 0), ra: 0.03, rb: 0.034 });
  const spread = 0.34 * (1 - hold);
  const fingers = [
    { offset: 0.024, length: 0.068 },
    { offset: 0.008, length: 0.076 },
    { offset: -0.008, length: 0.072 },
    { offset: -0.023, length: 0.058 },
  ];
  const tips: Vec3[] = [];
  const mids: Vec3[] = [];
  fingers.forEach(({ offset, length }, i) => {
    const base = add(knuckles, scale(thumbSide, offset));
    const fan = add(fingerDir(curl * 0.9), scale(thumbSide, spread * (1.5 - i)));
    const mid = add(base, scale(normalize(fan), length * 0.55));
    const end = add(mid, scale(fingerDir(curl * 1.9), length * 0.45));
    bones.push({ a: base, b: mid, ra: 0.0105, rb: 0.0095 }, { a: mid, b: end, ra: 0.0095, rb: 0.0085 });
    tips.push(end);
    mids.push(mid);
  });
  const thumbBase = at(wrist, 0.025, 0.026, 0.006);
  const thumbTip = add(thumbBase, scale(normalize(add(add(scale(along, 0.75), scale(thumbSide, 0.55 - 0.3 * hold)), scale(palm, 0.45 * hold))), 0.058));
  bones.push({ a: thumbBase, b: thumbTip, ra: 0.013, rb: 0.01 });

  const projected = bones.map((bone) => ({ bone, a: camera.project(bone.a), b: camera.project(bone.b) }));
  if (projected.some((p) => p.a.depth < NEAR || p.b.depth < NEAR)) return null;
  const centre = camera.project(at(wrist, 0.05, 0, 0));
  const slits = [0, 1, 2].map((i) => ({
    from: camera.project(scale(add(tips[i], tips[i + 1]), 0.5)),
    to: camera.project(add(scale(add(tips[i], tips[i + 1]), 0.25), scale(add(mids[i], mids[i + 1]), 0.25))),
  }));
  const lineWidth = Math.max(1, centre.scale * 0.012);
  return {
    depth: centre.depth - 0.01,
    paint: () => {
      const path = new Path2D();
      for (const { bone, a, b } of projected) capsulePath(path, a, bone.ra * a.scale, b, bone.rb * b.scale);
      ctx.lineJoin = "round";
      ctx.lineWidth = lineWidth * 2;
      ctx.strokeStyle = c.ink;
      ctx.stroke(path);
      ctx.fillStyle = c.skin;
      ctx.fill(path);
      // Short slits between the fingertips, so the fingers read as fingers and not a mitten.
      ctx.lineWidth = Math.max(0.6, lineWidth * 0.6);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < slits.length; i++) {
        ctx.moveTo(slits[i].from.x, slits[i].from.y);
        ctx.lineTo(slits[i].to.x, slits[i].to.y);
      }
      ctx.stroke();
    },
  };
}

/** How squarely a surface faces the camera: below zero it faces away. */
const facing = (camera: Camera, at: Vec3, normal: Vec3) => dot(normal, scale(camera.viewDir(at), -1));

/** How firmly each hand holds something, 0 open to 1 closed round the cloth. */
export type Holds = { left: number; right: number };

/** `hat: false` for people who aren't matadors: bare-headed, hair all over. */
export function matadorItems(
  ctx: CanvasRenderingContext2D,
  s: Skeleton,
  strands: Vec3[][],
  camera: Camera,
  c: MatadorColours,
  holds: Holds,
  options: { hat?: boolean } = {},
): DrawItem[] {
  const items: DrawItem[] = [];
  const hat = options.hat ?? true;
  const fills: Record<Key, string> = {
    suit: c.suit,
    jacket: c.jacket ?? c.suit,
    gold: c.gold,
    skin: c.skin,
    stocking: c.stocking,
    slipper: c.slipper,
    hand: c.skin,
  };
  const ink = (scaleAt: number) => Math.max(1, scaleAt * 0.012);

  for (const [elbow, wrist, tip, side, hold] of [
    [s.elbowL, s.wristL, s.handTipL, -1, holds.left],
    [s.elbowR, s.wristR, s.handTipR, 1, holds.right],
  ] as const) {
    const item = handItem(ctx, elbow, wrist, tip, side, hold, camera, c);
    if (item) items.push(item);
  }

  for (const [a, b, ra, rb, key] of matadorLimbs(s)) {
    if (key === "hand") continue;
    const pa = camera.project(a);
    const pb = camera.project(b);
    if (pa.depth < NEAR || pb.depth < NEAR) continue;
    items.push({
      depth: (pa.depth + pb.depth) / 2,
      paint: () => {
        ctx.beginPath();
        capsulePath(ctx, pa, ra * pa.scale, pb, rb * pb.scale);
        ctx.fillStyle = fills[key];
        ctx.fill();
        ctx.lineWidth = ink(pa.scale);
        ctx.strokeStyle = c.ink;
        ctx.stroke();
      },
    });
  }

  // Gold braid down the outside of each thigh, on the side we can see.
  const right = rightOf(s.pelvisQ);
  for (const [hip, knee, side] of [
    [s.hipL, s.kneeL, -1],
    [s.hipR, s.kneeR, 1],
  ] as const) {
    const outward = scale(right, side);
    const top = add(hip, scale(outward, 0.08));
    const bottom = add(knee, scale(outward, 0.056));
    if (facing(camera, top, outward) < 0.05) continue;
    const pa = camera.project(top);
    const pb = camera.project(bottom);
    items.push({
      depth: (pa.depth + pb.depth) / 2 - 0.07,
      paint: () => {
        ctx.beginPath();
        capsulePath(ctx, pa, 0.016 * pa.scale, pb, 0.012 * pb.scale);
        ctx.fillStyle = c.gold;
        ctx.fill();
      },
    });
  }

  // The shirt front and tie, between the lapels of the short jacket.
  const chestForward = normalize(sub(local(s.neckBase, s.chestQ, 1, 0, 0), s.neckBase));
  if (facing(camera, s.neckBase, chestForward) > 0.12) {
    const C = (f: number, u: number, r: number) => camera.project(local(s.neckBase, s.chestQ, f, u, r));
    const shirt = [C(0.085, -0.005, -0.045), C(0.085, -0.005, 0.045), C(0.125, -0.17, 0.022), C(0.125, -0.17, -0.022)];
    const tie = [C(0.098, -0.02, 0), C(0.13, -0.16, 0)];
    items.push({
      depth: camera.depthOf(s.neckBase) - 0.16,
      paint: () => {
        ctx.beginPath();
        ctx.moveTo(shirt[0].x, shirt[0].y);
        for (const q of shirt.slice(1)) ctx.lineTo(q.x, q.y);
        ctx.closePath();
        ctx.fillStyle = c.shirt;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tie[0].x, tie[0].y);
        ctx.lineTo(tie[1].x, tie[1].y);
        ctx.strokeStyle = c.tie;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1, tie[0].scale * 0.018);
        ctx.stroke();
      },
    });
  }

  for (const strand of strands) {
    const pts = strand.map((q) => camera.project(q));
    items.push({
      depth: pts[0].depth - 0.02,
      paint: () => {
        ctx.beginPath();
        smoothLinePath(ctx, pts);
        ctx.strokeStyle = c.gold;
        ctx.lineWidth = Math.max(1.2, pts[0].scale * 0.016);
        ctx.lineCap = "round";
        ctx.stroke();
      },
    });
  }

  const head = camera.project(s.head);
  items.push({ depth: head.depth - 0.06, paint: () => paintHead(ctx, s.head, s.headQ, camera, c, hat) });
  return items;
}

/**
 * The head as a ball with a face on it: every feature sits on the ball's
 * surface in the head's own frame and shows only while its side faces us,
 * so turning the head slides the face round, and a profile shows the nose.
 */
function paintHead(ctx: CanvasRenderingContext2D, centre: Vec3, q: Quat, camera: Camera, c: MatadorColours, wearsHat: boolean) {
  const R = 0.1;
  const at = (f: number, u: number, r: number) => local(centre, q, f, u, r);
  const visible = (p: Vec3) => facing(camera, p, normalize(sub(p, centre)));
  const head = camera.project(centre);
  const ink = Math.max(1, head.scale * 0.012);

  // The ornament pinned at the back of the head: behind the head when he faces us.
  const ornament = at(-0.1, -0.035, 0);
  const ornamentBehind = wearsHat && visible(ornament) < 0;
  const paintOrnament = () => {
    const p = camera.project(ornament);
    ctx.beginPath();
    discPath(ctx, p, 0.026 * p.scale);
    ctx.fillStyle = c.hair;
    ctx.fill();
    ctx.lineWidth = ink;
    ctx.strokeStyle = c.ink;
    ctx.stroke();
  };
  if (ornamentBehind) paintOrnament();

  const skull = new Path2D();
  discPath(skull, head, R * head.scale);
  ctx.fillStyle = c.skin;
  ctx.fill(skull);
  ctx.save();
  ctx.clip(skull);
  // Shade under the jaw, then the hair, which covers the ball from the forehead over to the nape.
  const jaw = camera.project(at(0.03, -0.11, 0));
  ctx.beginPath();
  discPath(ctx, jaw, 0.06 * jaw.scale);
  ctx.fillStyle = c.skinShade;
  ctx.globalAlpha = 0.45;
  ctx.fill();
  ctx.globalAlpha = 1;
  const hair = hairCap(centre, q, camera, R * 1.01);
  ctx.fillStyle = c.hair;
  ctx.fill(hair);
  ctx.strokeStyle = c.hair;
  ctx.lineWidth = 0.6;
  ctx.stroke(hair);
  ctx.restore();

  // Ears on the sides.
  for (const side of [-1, 1]) {
    const ear = at(-0.005, -0.01, R * side);
    if (visible(ear) < 0.05) continue;
    const p = camera.project(ear);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 0.017 * p.scale, 0.024 * p.scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.skin;
    ctx.fill();
    ctx.lineWidth = ink;
    ctx.strokeStyle = c.ink;
    ctx.stroke();
  }

  // The face.
  for (const side of [-1, 1]) {
    const eye = at(0.087, 0.008, 0.035 * side);
    const seen = visible(eye);
    if (seen < 0.05) continue;
    const p = camera.project(eye);
    ctx.globalAlpha = Math.min(1, seen * 5);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 0.012 * p.scale, 0.014 * p.scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.ink;
    ctx.fill();
    const b0 = camera.project(at(0.09, 0.03, 0.014 * side));
    const b1 = camera.project(at(0.08, 0.034, 0.054 * side));
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineWidth = Math.max(1, 0.01 * p.scale);
    ctx.strokeStyle = c.hair;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (visible(at(0.094, -0.048, 0)) > 0.1) {
    const m0 = camera.project(at(0.09, -0.05, -0.018));
    const m1 = camera.project(at(0.093, -0.052, 0.018));
    ctx.beginPath();
    ctx.moveTo(m0.x, m0.y);
    ctx.lineTo(m1.x, m1.y);
    ctx.lineWidth = Math.max(1, 0.008 * head.scale);
    ctx.strokeStyle = c.ink;
    ctx.stroke();
  }
  // The nose stands off the face, so in profile it breaks the outline and shows the way he faces.
  if (visible(at(0.1, -0.01, 0)) > -0.35) {
    const n0 = camera.project(at(0.093, 0.0, 0));
    const n1 = camera.project(at(0.112, -0.026, 0));
    ctx.beginPath();
    capsulePath(ctx, n0, 0.01 * n0.scale, n1, 0.013 * n1.scale);
    ctx.fillStyle = c.skin;
    ctx.fill();
    ctx.lineWidth = ink;
    ctx.strokeStyle = c.ink;
    ctx.stroke();
  }

  ctx.lineWidth = ink;
  ctx.strokeStyle = c.ink;
  ctx.stroke(skull);
  if (wearsHat && !ornamentBehind) paintOrnament();
  if (!wearsHat) return;

  // The hat: wider than the head, low on the crown, with a rounded lobe standing out over each ear.
  const hat = new Path2D();
  for (const side of [-1, 1]) {
    const inner = camera.project(at(-0.01, 0.085, 0.04 * side));
    const lobe = camera.project(at(-0.016, 0.07, 0.1 * side));
    capsulePath(hat, inner, 0.038 * inner.scale, lobe, 0.034 * lobe.scale);
  }
  const front = camera.project(at(0.028, 0.09, 0));
  const back = camera.project(at(-0.046, 0.094, 0));
  capsulePath(hat, back, 0.04 * back.scale, front, 0.036 * front.scale);
  ctx.lineWidth = ink * 1.6;
  ctx.strokeStyle = c.ink;
  ctx.stroke(hat);
  ctx.fillStyle = c.hat;
  ctx.fill(hat);
}

/**
 * The hair as a cap on the head's ball, tilted back so it starts high on
 * the forehead and ends low on the nape. It is tiled into small patches and
 * only those facing us are drawn, so the face is never covered.
 */
function hairCap(centre: Vec3, q: Quat, camera: Camera, radius: number) {
  const pole = normalize({ x: -0.55, y: 1, z: 0 });
  const side = { x: 0, y: 0, z: 1 };
  const across = normalize(cross(side, pole));
  const reach = 1.66;
  const rings = 6;
  const segments = 24;
  const point = (ring: number, seg: number) => {
    const theta = (ring / rings) * reach;
    const phi = (seg / segments) * Math.PI * 2;
    const dir = add(scale(pole, Math.cos(theta)), add(scale(across, Math.sin(theta) * Math.cos(phi)), scale(side, Math.sin(theta) * Math.sin(phi))));
    return local(centre, q, dir.x * radius, dir.y * radius, dir.z * radius);
  };
  const path = new Path2D();
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < segments; k++) {
      const corners = [point(r, k), point(r + 1, k), point(r + 1, k + 1), point(r, k + 1)];
      const middle = scale(add(add(corners[0], corners[1]), add(corners[2], corners[3])), 0.25);
      if (facing(camera, middle, normalize(sub(middle, centre))) <= 0) continue;
      const pts = corners.map((p) => camera.project(p));
      path.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) path.lineTo(p.x, p.y);
      path.closePath();
    }
  }
  return path;
}
