import type { BullPose, LegPose } from "@/lib/sol-y-sombra/rig/bull";
import { add, cross, dot, lerp, local, normalize, rotate, scale, sub, upOf, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import { NEAR, type Camera, type Projected } from "./camera";
import { capsulePath, smoothLinePath } from "./shapes";

/*
 * The bull, dressed: the body and neck as one outlined silhouette, the head
 * as a second one laid over the neck (so the jaw line reads), legs that sort
 * themselves in front of or behind the body, horns, and a tail that tapers
 * to a brush. The face is drawn only on the sides that face the camera: an
 * eye with the white showing under a brow pressed down towards the nose
 * (which is what makes it angry, not startled), a pale muzzle with nostrils,
 * the line of the mouth, and the curls of the forehead.
 *
 * Every shape is a volume in the bull's own 3D pose, projected, so the bull
 * turns, tosses and charges as one body. A style chooses colours and ink.
 */

export type DrawItem = { depth: number; paint: () => void };

export type BullColours = {
  /** Lit back, middle and shaded belly: the body's gradient. */
  light: string;
  body: string;
  shade: string;
  /** Legs on the far side, a step darker. */
  far: string;
  ink: string;
  sheen: string;
  horn: string;
  hornTip: string;
  hoof: string;
  muzzle: string;
  eyeWhite: string;
  pupil: string;
};

type Part = { a: Vec3; b: Vec3; ra: number; rb: number };

/** A point in the head's own frame: forward from the poll, up, and to the right. */
const headPoint = (pose: BullPose) => (f: number, u: number, r: number) => local(pose.poll, pose.headQ, f, u, r);

/** The body, neck, hump and dewlap: one mass, outlined once. */
export function bullBody(pose: BullPose): Part[] {
  const parts: Part[] = [];
  const below = (q: Vec3, by: number) => ({ x: q.x, y: q.y - by, z: q.z });
  const sp = pose.spine;
  // Tail to withers: lean over the loin, deep through the chest, the flank tucked up in front of the hind legs.
  const depth = [0.3, 0.33, 0.35, 0.41, 0.45, 0.47, 0.45];
  const radius = [0.27, 0.31, 0.32, 0.38, 0.41, 0.42, 0.39];
  const core = sp.map((q, i) => below(q, depth[i]));
  for (let i = 0; i < core.length - 1; i++) parts.push({ a: core[i], b: core[i + 1], ra: radius[i], rb: radius[i + 1] });
  // The haunch, round over the hind legs.
  parts.push({ a: below(sp[1], 0.28), b: below(sp[1], 0.42), ra: 0.3, rb: 0.27 });
  parts.push({ a: core[5], b: pose.brisket, ra: 0.37, rb: 0.2 });
  parts.push({ a: core[3], b: pose.belly, ra: 0.3, rb: 0.3 });
  // The neck, and the great hump of muscle that rises over it when the head goes down.
  parts.push({ a: core[6], b: pose.poll, ra: 0.34, rb: 0.16 });
  parts.push({ a: lerp(core[6], pose.withers, 0.7), b: pose.crest, ra: 0.3, rb: 0.21 });
  parts.push({ a: pose.crest, b: lerp(pose.crest, pose.poll, 0.55), ra: 0.21, rb: 0.16 });
  // The dewlap: a fold of skin under the throat. Each point of its hem is webbed up to the neck,
  // so it hangs from the neck as one piece and no daylight shows between them.
  const d = pose.dewlap;
  const fold = [0.06, 0.09, 0.11, 0.1, 0.09];
  for (let i = 0; i < d.length - 1; i++) parts.push({ a: d[i], b: d[i + 1], ra: fold[i], rb: fold[i + 1] });
  d.forEach((hem, i) => {
    const t = i / (d.length - 1);
    const neck = lerp(pose.poll, core[6], 0.15 + t * 0.85);
    parts.push({ a: hem, b: neck, ra: fold[i], rb: 0.16 + t * 0.12 });
  });
  return parts;
}

/** The head: a broad brow, cheeks narrowing to the muzzle, a strong jaw, ears out under the horns. */
export function bullHead(pose: BullPose): Part[] {
  const H = headPoint(pose);
  const parts: Part[] = [
    { a: H(0.04, -0.04, 0), b: H(0.09, -0.08, 0), ra: 0.155, rb: 0.15 },
    { a: H(0.1, -0.13, 0), b: H(0.29, -0.31, 0), ra: 0.14, rb: 0.105 },
    { a: H(0.31, -0.35, 0), b: H(0.35, -0.39, 0), ra: 0.1, rb: 0.092 },
    { a: H(0.02, -0.2, 0), b: H(0.26, -0.39, 0), ra: 0.1, rb: 0.07 },
  ];
  for (const s of [-1, 1]) parts.push({ a: H(-0.02, -0.07, 0.11 * s), b: H(-0.07, -0.12, 0.27 * s), ra: 0.048, rb: 0.026 });
  return parts;
}

/** A leg, from the muscle where it leaves the body down to the hoof. */
export function bullLeg(leg: LegPose): { parts: Part[]; hoof: Part } {
  return {
    parts: [
      { a: lerp(leg.root, leg.mid, -0.3), b: leg.mid, ra: leg.fore ? 0.18 : 0.21, rb: 0.1 },
      { a: leg.mid, b: leg.knee, ra: leg.fore ? 0.095 : 0.09, rb: 0.058 },
      { a: leg.knee, b: leg.fetlock, ra: 0.05, rb: 0.044 },
      { a: leg.fetlock, b: lerp(leg.fetlock, leg.hoof, 0.5), ra: 0.052, rb: 0.046 },
    ],
    hoof: { a: lerp(leg.fetlock, leg.hoof, 0.45), b: leg.hoof, ra: 0.046, rb: 0.055 },
  };
}

/** The tail: thick at the root, thin along its length, ending in a pointed brush. */
export function bullTail(pose: BullPose): Part[] {
  const t = pose.tail;
  const parts: Part[] = [];
  for (let i = 0; i < t.length - 2; i++) {
    const k = i / (t.length - 1);
    parts.push({ a: t[i], b: t[i + 1], ra: 0.034 - k * 0.022, rb: 0.034 - ((i + 1) / (t.length - 1)) * 0.022 });
  }
  const last = t[t.length - 1];
  const before = t[t.length - 2];
  // The brush: a long teardrop of hair, full in the middle and soft at the end.
  const tip = add(last, scale(normalize(sub(last, before)), 0.16));
  parts.push({ a: before, b: last, ra: 0.014, rb: 0.034 });
  parts.push({ a: last, b: tip, ra: 0.034, rb: 0.016 });
  return parts;
}

/** Every capsule of the bull, for shadows. */
export function bullShadowParts(pose: BullPose): Part[] {
  const legs = Object.values(pose.legs).flatMap((leg) => {
    const { parts, hoof } = bullLeg(leg);
    return [...parts, hoof];
  });
  const horns = pose.horns.flatMap((h) => [0, 1, 2, 3].map((i) => ({ a: h[i], b: h[i + 1], ra: HORN_RADII[i], rb: HORN_RADII[i + 1] })));
  return [...bullBody(pose), ...bullHead(pose), ...legs, ...horns, ...bullTail(pose)];
}

const HORN_RADII = [0.048, 0.041, 0.033, 0.024, 0.008];

export function bullItems(ctx: CanvasRenderingContext2D, pose: BullPose, camera: Camera, c: BullColours): DrawItem[] {
  const items: DrawItem[] = [];
  const pathOf = (parts: Part[]) => {
    const path = new Path2D();
    for (const p of parts) {
      const a = camera.project(p.a);
      const b = camera.project(p.b);
      if (a.depth < NEAR || b.depth < NEAR) continue;
      capsulePath(path, a, p.ra * a.scale, b, p.rb * b.scale);
    }
    return path;
  };
  const scaleAt = camera.project(pose.withers).scale;
  const ink = Math.max(1.3, scaleAt * 0.02);
  const bodyDepth = camera.depthOf(pose.spine[3]);
  const top = camera.project(add(pose.withers, { x: 0, y: 0.2, z: 0 }));
  const bottom = camera.project(add(pose.brisket, { x: 0, y: -0.35, z: 0 }));
  const gradient = () => {
    const g = ctx.createLinearGradient(0, top.y, 0, bottom.y);
    g.addColorStop(0, c.light);
    g.addColorStop(0.45, c.body);
    g.addColorStop(1, c.shade);
    return g;
  };
  const outline = (path: Path2D, width = ink * 2) => {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    ctx.strokeStyle = c.ink;
    ctx.stroke(path);
  };

  const body = pathOf(bullBody(pose));
  const near: { path: Path2D; hoof: Path2D }[] = [];
  for (const leg of Object.values(pose.legs)) {
    const { parts, hoof } = bullLeg(leg);
    const path = pathOf(parts);
    const hoofPath = pathOf([hoof]);
    if (camera.depthOf(leg.root) < bodyDepth) {
      near.push({ path, hoof: hoofPath });
      continue;
    }
    items.push({
      depth: bodyDepth + 0.4,
      paint: () => {
        outline(path);
        outline(hoofPath);
        ctx.fillStyle = c.far;
        ctx.fill(path);
        ctx.fillStyle = c.hoof;
        ctx.fill(hoofPath);
      },
    });
  }

  const tail = pathOf(bullTail(pose));
  const tailNear = camera.depthOf(pose.tail[Math.floor(pose.tail.length / 2)]) < camera.depthOf(pose.tailhead);
  if (!tailNear) {
    items.push({
      depth: bodyDepth + 0.5,
      paint: () => {
        outline(tail, ink * 1.4);
        ctx.fillStyle = c.far;
        ctx.fill(tail);
      },
    });
  }

  // The body, the near legs and a near tail share one outline pass: where they overlap there is no seam.
  items.push({
    depth: bodyDepth,
    paint: () => {
      outline(body);
      for (const leg of near) {
        outline(leg.path);
        outline(leg.hoof);
      }
      if (tailNear) outline(tail, ink * 1.4);
      const shade = gradient();
      ctx.fillStyle = shade;
      ctx.fill(body);
      paintSheen(ctx, pose, camera, c, body, scaleAt);
      for (const leg of near) {
        ctx.fillStyle = shade;
        ctx.fill(leg.path);
        ctx.fillStyle = c.hoof;
        ctx.fill(leg.hoof);
      }
      if (tailNear) {
        ctx.fillStyle = c.body;
        ctx.fill(tail);
      }
    },
  });

  // The head lies over the neck with its own outline, so the jaw and cheek read against the body.
  const H = headPoint(pose);
  const headCentre = H(0.15, -0.18, 0);
  const headDepth = camera.depthOf(headCentre);
  const head = pathOf(bullHead(pose));
  items.push({
    depth: Math.min(headDepth, bodyDepth - 0.05),
    paint: () => {
      outline(head);
      ctx.fillStyle = gradient();
      ctx.fill(head);
      paintFace(ctx, pose, camera, c, head, ink);
    },
  });

  // Horns: the far one goes behind the head, the near one in front of it.
  for (const horn of pose.horns) {
    const behind = camera.depthOf(horn[3]) > headDepth;
    const pts = horn.map((q) => camera.project(q));
    items.push({
      depth: Math.min(headDepth, bodyDepth - 0.05) + (behind ? 0.02 : -0.02),
      paint: () => {
        const path = new Path2D();
        for (let i = 0; i < 4; i++) capsulePath(path, pts[i], HORN_RADII[i] * pts[i].scale, pts[i + 1], HORN_RADII[i + 1] * pts[i + 1].scale);
        outline(path, ink * 1.5);
        const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[4].x, pts[4].y);
        grad.addColorStop(0, c.horn);
        grad.addColorStop(0.62, c.horn);
        grad.addColorStop(1, c.hornTip);
        ctx.fillStyle = grad;
        ctx.fill(path);
      },
    });
  }
  return items;
}

/** A sheen of sun along the back and over the hump, fading at both ends. */
function paintSheen(ctx: CanvasRenderingContext2D, pose: BullPose, camera: Camera, c: BullColours, body: Path2D, scaleAt: number) {
  ctx.save();
  ctx.clip(body);
  const pts = [...pose.spine.slice(1), pose.crest].map((q) => camera.project(add(q, { x: 0, y: 0.04, z: 0 })));
  const first = pts[0];
  const last = pts[pts.length - 1];
  const fade = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
  fade.addColorStop(0, "transparent");
  fade.addColorStop(0.25, c.sheen);
  fade.addColorStop(0.8, c.sheen);
  fade.addColorStop(1, "transparent");
  ctx.beginPath();
  smoothLinePath(ctx, pts);
  ctx.strokeStyle = fade;
  ctx.globalAlpha = 0.45;
  ctx.lineCap = "butt";
  ctx.lineWidth = scaleAt * 0.12;
  ctx.stroke();
  ctx.restore();
}

/** How squarely a surface faces the camera, from its outward normal: below zero it faces away. */
const facing = (camera: Camera, at: Vec3, normal: Vec3) => dot(normal, scale(camera.viewDir(at), -1));

const toward = (a: Projected, b: Projected, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function paintFace(ctx: CanvasRenderingContext2D, pose: BullPose, camera: Camera, c: BullColours, head: Path2D, ink: number) {
  const H = headPoint(pose);
  const skull = H(0.07, -0.06, 0);
  ctx.save();
  ctx.clip(head);

  // The muzzle, paler, fading into the face.
  const muzzle = camera.project(H(0.36, -0.37, 0));
  const glow = ctx.createRadialGradient(muzzle.x, muzzle.y, 0, muzzle.x, muzzle.y, 0.13 * muzzle.scale);
  glow.addColorStop(0, c.muzzle);
  glow.addColorStop(0.55, c.muzzle);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(muzzle.x - 0.14 * muzzle.scale, muzzle.y - 0.14 * muzzle.scale, 0.28 * muzzle.scale, 0.28 * muzzle.scale);

  // The curly, slightly paler hair of the broad forehead, between the horns.
  const brow = H(0.14, -0.04, 0);
  if (facing(camera, brow, normalize(sub(brow, skull))) > 0.1) {
    const p = camera.project(brow);
    const tuft = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 0.1 * p.scale);
    tuft.addColorStop(0, c.sheen);
    tuft.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = tuft;
    ctx.fillRect(p.x - 0.1 * p.scale, p.y - 0.1 * p.scale, 0.2 * p.scale, 0.2 * p.scale);
    ctx.globalAlpha = 1;
  }

  // Nostrils, and the line of the mouth along each cheek that faces us.
  for (const s of [-1, 1]) {
    const nostril = H(0.42, -0.35, 0.045 * s);
    if (facing(camera, nostril, normalize(sub(nostril, H(0.3, -0.36, 0)))) > 0.05) {
      const q = camera.project(nostril);
      const inner = camera.project(H(0.43, -0.38, 0.02 * s));
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.quadraticCurveTo(toward(q, inner, 0.5).x - 0.01 * q.scale, toward(q, inner, 0.5).y, inner.x, inner.y);
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = Math.max(1.2, 0.02 * q.scale);
      ctx.stroke();
    }
    const corner = H(0.24, -0.42, 0.075 * s);
    if (facing(camera, corner, normalize(sub(corner, H(0.24, -0.36, 0)))) > 0.05) {
      const a = camera.project(H(0.4, -0.44, 0.04 * s));
      const b = camera.project(corner);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = Math.max(1, ink * 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.clip(head);
  for (const s of [-1, 1]) paintEye(ctx, pose, camera, c, s, ink);
  ctx.restore();
}

/** One eye, on side `s`, if that side of the head faces us. */
function paintEye(ctx: CanvasRenderingContext2D, pose: BullPose, camera: Camera, c: BullColours, s: number, ink: number) {
  const eye = headPoint(pose)(0.165, -0.1, 0.122 * s);
  // A bull's eyes sit on the sides of the head but look forward too: the eye faces out and ahead.
  const normal = normalize(rotate(pose.headQ, { x: 0.55, y: 0.12, z: s }));
  const seen = facing(camera, eye, normal);
  if (seen < 0.03) return;
  // The eye is drawn in its own plane, square to where it faces, so it narrows only as it turns away.
  const up = normalize(sub(upOf(pose.headQ), scale(normal, dot(upOf(pose.headQ), normal))));
  const ahead = scale(normalize(cross(up, normal)), s);
  const E = (f: number, u: number) => camera.project(add(add(add(eye, scale(ahead, f)), scale(up, u)), scale(normal, 0.01)));
  const back = E(-0.062, 0.014);
  const front = E(0.068, -0.014);
  const upper = E(0.004, 0.05);
  const lower = E(0.002, -0.038);
  const almond = new Path2D();
  almond.moveTo(back.x, back.y);
  almond.quadraticCurveTo(upper.x, upper.y, front.x, front.y);
  almond.quadraticCurveTo(lower.x, lower.y, back.x, back.y);
  almond.closePath();
  ctx.globalAlpha = Math.min(1, seen * 5);
  ctx.fillStyle = c.eyeWhite;
  ctx.fill(almond);
  // A dark eye looking forward, the white showing behind it.
  ctx.save();
  ctx.clip(almond);
  const iris = E(0.024, -0.004);
  ctx.beginPath();
  ctx.arc(iris.x, iris.y, 0.029 * iris.scale, 0, Math.PI * 2);
  ctx.fillStyle = c.pupil;
  ctx.fill();
  const glint = E(0.03, 0.008);
  ctx.beginPath();
  ctx.arc(glint.x, glint.y, Math.max(0.8, 0.006 * glint.scale), 0, Math.PI * 2);
  ctx.fillStyle = c.eyeWhite;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = Math.max(1, ink * 0.75);
  ctx.strokeStyle = c.ink;
  ctx.stroke(almond);
  // The brow: heavy, high at the back, pressed down over the front of the eye.
  const b = [E(-0.08, 0.05), E(0.086, 0.012), E(0.08, 0.05), E(-0.072, 0.09)];
  ctx.beginPath();
  ctx.moveTo(b[0].x, b[0].y);
  for (const q of b.slice(1)) ctx.lineTo(q.x, q.y);
  ctx.closePath();
  ctx.fillStyle = c.ink;
  ctx.fill();
  ctx.globalAlpha = 1;
}
