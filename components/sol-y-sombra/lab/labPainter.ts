import type { Ring } from "@/lib/sol-y-sombra/rig/ring";
import { add, addScaled, cross, dot, lerp, normalize, scale, sub, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import { NEAR, type Camera, type Projected } from "../render/camera";
import { bullItems, bullShadowParts, type BullColours } from "../render/bullFigure";
import { matadorItems, matadorLimbs, type MatadorColours } from "../render/matadorFigure";
import { capsulePath, discPath, polygonPath } from "../render/shapes";

/*
 * The motion lab's plain dressing of the rig: a sand ring, a grid to judge
 * foot contact by, flat-coloured bodies with ink outlines, the two-faced
 * cape, shadows from a low sun, and the dust. It exists to judge movement,
 * so it can also draw the bones and mark planted feet.
 */

export type LabPalette = {
  skyTop: string;
  skyLow: string;
  stands: string;
  standsShade: string;
  sand: string;
  sandFar: string;
  grid: string;
  wall: string;
  wallTop: string;
  shadow: string;
  ink: string;
  matador: MatadorColours;
  bull: BullColours;
  capeFront: [number, number, number];
  capeBack: [number, number, number];
  /** The gold braid round the cape's edge. */
  braid: string;
  dust: string;
  planted: string;
};

export const LAB_LIGHT: LabPalette = {
  skyTop: "#f6e7c8",
  skyLow: "#f1d6a6",
  stands: "#d9b98a",
  standsShade: "#b99468",
  sand: "#e6c48b",
  sandFar: "#dcb577",
  grid: "rgb(120 78 34 / 0.14)",
  wall: "#8e2b20",
  wallTop: "#f2e3c2",
  shadow: "rgb(84 46 20 / 0.32)",
  ink: "#2a1a12",
  matador: {
    ink: "#2a1a12",
    suit: "#26375e",
    gold: "#d9a537",
    skin: "#c98f6c",
    skinShade: "#9c6649",
    hair: "#3b2519",
    stocking: "#efb3c0",
    slipper: "#1d1a1a",
    hat: "#151313",
    shirt: "#f6efe2",
    tie: "#7c1420",
  },
  bull: {
    light: "#4b3a30",
    body: "#271d18",
    shade: "#120d0b",
    far: "#170f0d",
    ink: "#100b09",
    sheen: "#7a6152",
    horn: "#f0e3c6",
    hornTip: "#352820",
    hoof: "#0d0a09",
    muzzle: "#5b4a40",
    eyeWhite: "#f3e6cf",
    pupil: "#120c09",
  },
  capeFront: [204, 24, 44],
  capeBack: [172, 26, 52],
  braid: "#d9a537",
  dust: "rgb(233 206 158 / 1)",
  planted: "#2f9e6a",
};

export const LAB_DARK: LabPalette = {
  skyTop: "#121a33",
  skyLow: "#2a2c4a",
  stands: "#2d3150",
  standsShade: "#1f2340",
  sand: "#a3896a",
  sandFar: "#8c7559",
  grid: "rgb(255 236 200 / 0.1)",
  wall: "#6f1f1a",
  wallTop: "#d9c9a6",
  shadow: "rgb(10 10 30 / 0.4)",
  ink: "#0d0a0a",
  matador: {
    ink: "#0d0a0a",
    suit: "#2f4472",
    gold: "#e3b448",
    skin: "#b98467",
    skinShade: "#8a5a42",
    hair: "#33201a",
    stocking: "#d99eac",
    slipper: "#111",
    hat: "#0d0c0c",
    shirt: "#e8e0d2",
    tie: "#8a1826",
  },
  bull: {
    light: "#3f3029",
    body: "#1f1714",
    shade: "#0c0908",
    far: "#110c0b",
    ink: "#080606",
    sheen: "#6b5446",
    horn: "#e2d4b8",
    hornTip: "#2c221b",
    hoof: "#0b0a09",
    muzzle: "#4d3e36",
    eyeWhite: "#ecdfc8",
    pupil: "#0c0807",
  },
  capeFront: [212, 34, 54],
  capeBack: [166, 28, 54],
  braid: "#e3b448",
  dust: "rgb(210 190 160 / 1)",
  planted: "#47c98e",
};

/** Sunlight comes from up and behind the stands to the left. */
const SUN: Vec3 = normalize({ x: -0.42, y: -1, z: -0.36 });

type Item = { depth: number; paint: () => void };

export type LabOptions = { bones: boolean; contacts: boolean };

const RING_RADIUS = 18;

export class LabPainter {
  private readonly ctx: CanvasRenderingContext2D;
  private shadowCanvas: HTMLCanvasElement | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  paint(ring: Ring, camera: Camera, palette: LabPalette, options: LabOptions) {
    const ctx = this.ctx;
    this.paintBackdrop(camera, palette);
    this.paintGround(camera, palette, ring);
    this.paintShadows(ring, camera, palette);

    const items: Item[] = [];
    this.figureItems(items, ring, camera, palette);
    this.capeItems(items, ring, camera, palette);
    this.hemItems(items, ring, camera, palette);
    this.dustItems(items, ring, camera, palette);
    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) item.paint();

    if (options.bones) this.paintBones(ring, camera);
    if (options.contacts) this.paintContacts(ring, camera, palette);
    ctx.globalAlpha = 1;
  }

  /* ---------- The ring ---------- */

  private paintBackdrop(camera: Camera, p: LabPalette) {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, camera.height);
    sky.addColorStop(0, p.skyTop);
    sky.addColorStop(1, p.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, camera.width, camera.height);
    // The stands: a band that rises behind the barrier all the way round.
    const band = (radius: number, height: number) => {
      const pts: Projected[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(
          camera.project({
            x: Math.cos(a) * radius,
            y: height,
            z: Math.sin(a) * radius,
          }),
        );
      }
      return pts;
    };
    const top = band(RING_RADIUS + 14, 11).filter((q) => q.depth > 1);
    if (top.length > 2) {
      ctx.fillStyle = p.stands;
      ctx.beginPath();
      ctx.moveTo(0, camera.height);
      let horizon = camera.height;
      for (const q of top) horizon = Math.min(horizon, q.y);
      ctx.rect(0, horizon, camera.width, camera.height - horizon);
      ctx.fill();
    }
  }

  private paintGround(camera: Camera, p: LabPalette, ring: Ring) {
    const ctx = this.ctx;
    // The floor as a fan of wedges, so parts behind the eye are simply left out.
    ctx.fillStyle = p.sand;
    ctx.beginPath();
    const segments = 128;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const corners = [
        { x: 0, y: 0, z: 0 },
        { x: Math.cos(a0) * RING_RADIUS, y: 0, z: Math.sin(a0) * RING_RADIUS },
        { x: Math.cos(a1) * RING_RADIUS, y: 0, z: Math.sin(a1) * RING_RADIUS },
      ];
      const projected = clipToFront(corners, camera);
      if (projected.length >= 3) polygonPath(ctx, projected);
    }
    ctx.fill();

    // The barrier, segment by segment, far ones first.
    const wall: { depth: number; pts: Projected[]; top: Projected[] }[] = [];
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const corners = [
        { x: Math.cos(a0) * RING_RADIUS, y: 0, z: Math.sin(a0) * RING_RADIUS },
        { x: Math.cos(a1) * RING_RADIUS, y: 0, z: Math.sin(a1) * RING_RADIUS },
        {
          x: Math.cos(a1) * RING_RADIUS,
          y: 1.3,
          z: Math.sin(a1) * RING_RADIUS,
        },
        {
          x: Math.cos(a0) * RING_RADIUS,
          y: 1.3,
          z: Math.sin(a0) * RING_RADIUS,
        },
      ];
      if (corners.some((c) => camera.depthOf(c) < 0.5)) continue;
      const pts = corners.map((c) => camera.project(c));
      wall.push({
        depth: camera.depthOf(corners[0]),
        pts,
        top: [pts[3], pts[2]],
      });
    }
    wall.sort((a, b) => b.depth - a.depth);
    for (const w of wall) {
      ctx.fillStyle = p.wall;
      ctx.beginPath();
      polygonPath(ctx, w.pts);
      ctx.fill();
      ctx.strokeStyle = p.wallTop;
      ctx.lineWidth = Math.max(1, w.pts[3].scale * 0.08);
      ctx.beginPath();
      ctx.moveTo(w.top[0].x, w.top[0].y);
      ctx.lineTo(w.top[1].x, w.top[1].y);
      ctx.stroke();
    }

    // A metre grid round the action, to judge whether feet hold still.
    const centre = ring.feet.centre();
    const cx = Math.round(centre.x);
    const cz = Math.round(centre.z);
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -9; k <= 9; k++) {
      for (const [a, b] of [
        [
          { x: cx + k, y: 0, z: cz - 9 },
          { x: cx + k, y: 0, z: cz + 9 },
        ],
        [
          { x: cx - 9, y: 0, z: cz + k },
          { x: cx + 9, y: 0, z: cz + k },
        ],
      ]) {
        const seg = clipSegment(a, b, camera);
        if (!seg) continue;
        ctx.moveTo(seg[0].x, seg[0].y);
        ctx.lineTo(seg[1].x, seg[1].y);
      }
    }
    ctx.stroke();
  }

  /* ---------- Shadows, all in one layer so overlaps don't darken ---------- */

  private paintShadows(ring: Ring, camera: Camera, p: LabPalette) {
    const ctx = this.ctx;
    const canvas = (this.shadowCanvas ??= document.createElement("canvas"));
    if (canvas.width !== ctx.canvas.width || canvas.height !== ctx.canvas.height) {
      canvas.width = ctx.canvas.width;
      canvas.height = ctx.canvas.height;
    }
    const sc = canvas.getContext("2d")!;
    sc.setTransform(ctx.getTransform());
    sc.clearRect(0, 0, camera.width, camera.height);
    sc.fillStyle = "#000";
    sc.beginPath();
    const onGround = (q: Vec3) => camera.project(addScaled(q, SUN, -q.y / SUN.y));
    const limb = (a: Vec3, b: Vec3, ra: number, rb: number) => {
      const pa = onGround(a);
      const pb = onGround(b);
      capsulePath(sc, pa, ra * pa.scale, pb, rb * pb.scale);
    };
    for (const [a, b, ra, rb] of matadorLimbs(ring.skeleton)) limb(a, b, ra, rb);
    for (const part of bullShadowParts(ring.bullPose)) limb(part.a, part.b, part.ra, part.rb);
    sc.fill();
    // The cape's shadow.
    const { pos, triangles } = ring.cape;
    sc.beginPath();
    for (let t = 0; t < triangles.length; t += 3) {
      const pts = [triangles[t], triangles[t + 1], triangles[t + 2]].map((i) => onGround({ x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2] }));
      polygonPath(sc, pts);
    }
    sc.fill();
    ctx.save();
    // Colour the black silhouette with the shadow colour, then lay it down.
    sc.globalCompositeOperation = "source-in";
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.fillStyle = p.shadow;
    sc.fillRect(0, 0, canvas.width, canvas.height);
    sc.globalCompositeOperation = "source-over";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  }

  /* ---------- The matador and the bull ---------- */

  private figureItems(items: Item[], ring: Ring, camera: Camera, p: LabPalette) {
    const strands = [...ring.tassels.map((c) => c.points), ...ring.fringes.map((c) => c.points)];
    const holds = { left: ring.grip.leftHold, right: ring.grip.rightHold };
    items.push(...matadorItems(this.ctx, ring.skeleton, strands, camera, p.matador, holds));
    items.push(...bullItems(this.ctx, ring.bullPose, camera, p.bull));
  }

  /* ---------- The cape ---------- */

  private capeItems(items: Item[], ring: Ring, camera: Camera, p: LabPalette) {
    const ctx = this.ctx;
    const { pos, triangles, count } = ring.cape;
    const at = (i: number): Vec3 => ({
      x: pos[i * 3],
      y: pos[i * 3 + 1],
      z: pos[i * 3 + 2],
    });
    // Smooth normals, averaged over the faces round each particle, so folds shade as curves.
    const normals: Vec3[] = Array.from({ length: count }, () => ({
      x: 0,
      y: 0,
      z: 0,
    }));
    for (let t = 0; t < triangles.length; t += 3) {
      const [i, j, k] = [triangles[t], triangles[t + 1], triangles[t + 2]];
      const n = cross(sub(at(j), at(i)), sub(at(k), at(i)));
      for (const v of [i, j, k]) normals[v] = add(normals[v], n);
    }
    const light = scale(SUN, -1);
    for (let t = 0; t < triangles.length; t += 3) {
      const a = at(triangles[t]);
      const b = at(triangles[t + 1]);
      const c = at(triangles[t + 2]);
      const n = normalize(add(add(normals[triangles[t]], normals[triangles[t + 1]]), normals[triangles[t + 2]]));
      const centre = scale(add(add(a, b), c), 1 / 3);
      const toEye = scale(camera.viewDir(centre), -1);
      const front = dot(normalize(cross(sub(b, a), sub(c, a))), toEye) > 0;
      const facing = front ? n : scale(n, -1);
      // Light through the folds: a strong key from the sun, a soft fill from the sand.
      const lit = 0.6 + 0.34 * Math.max(0, dot(facing, light)) + 0.1 * Math.max(0, -facing.y);
      const base = front ? p.capeFront : p.capeBack;
      const colour = `rgb(${Math.round(base[0] * lit)} ${Math.round(base[1] * lit)} ${Math.round(base[2] * lit)})`;
      const pts = [a, b, c].map((q) => camera.project(q));
      if (pts.some((q) => q.depth < NEAR)) continue;
      items.push({
        depth: camera.depthOf(centre),
        paint: () => {
          ctx.beginPath();
          polygonPath(ctx, pts);
          ctx.fillStyle = colour;
          ctx.fill();
          ctx.strokeStyle = colour;
          ctx.lineWidth = 1;
          ctx.stroke();
        },
      });
    }
  }

  /** The gold braid along the cape's hem and sides. */
  private hemItems(items: Item[], ring: Ring, camera: Camera, p: LabPalette) {
    const ctx = this.ctx;
    const { pos, shape } = ring.cape;
    const at = (c: number, r: number): Vec3 => {
      const i = (r * shape.columns + c) * 3;
      return { x: pos[i], y: pos[i + 1], z: pos[i + 2] };
    };
    const edge: Vec3[] = [];
    for (let r = 0; r < shape.rows; r++) edge.push(at(0, r));
    for (let c = 1; c < shape.columns; c++) edge.push(at(c, shape.rows - 1));
    for (let r = shape.rows - 2; r >= 0; r--) edge.push(at(shape.columns - 1, r));
    for (let k = 0; k < edge.length - 1; k++) {
      const a = camera.project(edge[k]);
      const b = camera.project(edge[k + 1]);
      items.push({
        depth: Math.min(a.depth, b.depth) - 0.004,
        paint: () => {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = p.braid;
          ctx.lineCap = "round";
          ctx.lineWidth = Math.max(1.2, a.scale * 0.03);
          ctx.stroke();
        },
      });
    }
  }

  private dustItems(items: Item[], ring: Ring, camera: Camera, p: LabPalette) {
    const ctx = this.ctx;
    const d = ring.dust;
    for (let i = 0; i < d.count; i++) {
      const q = camera.project({ x: d.x[i], y: d.y[i], z: d.z[i] });
      const alpha = d.opacity(i) * 0.5;
      if (alpha < 0.01) continue;
      const r = d.size[i] * q.scale;
      items.push({
        depth: q.depth,
        paint: () => {
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          discPath(ctx, q, r);
          ctx.fillStyle = p.dust;
          ctx.fill();
          ctx.globalAlpha = 1;
        },
      });
    }
  }

  /* ---------- Judging aids ---------- */

  private paintBones(ring: Ring, camera: Camera) {
    const ctx = this.ctx;
    const s = ring.skeleton;
    const b = ring.bullPose;
    const chains: Vec3[][] = [
      [s.footL.toe, s.footL.ankle, s.kneeL, s.hipL, s.pelvis, s.hipR, s.kneeR, s.footR.ankle, s.footR.toe],
      [s.pelvis, s.spine1, s.spine2, s.neckBase, s.neckTop, s.head],
      [s.handTipL, s.wristL, s.elbowL, s.shoulderL, s.neckBase, s.shoulderR, s.elbowR, s.wristR, s.handTipR],
      b.spine,
      [b.withers, b.neckBase, b.poll, b.muzzle],
      ...Object.values(b.legs).map((l) => [l.root, l.mid, l.knee, l.fetlock, l.hoof]),
    ];
    ctx.strokeStyle = "#19c3ff";
    ctx.fillStyle = "#19c3ff";
    ctx.lineWidth = 1.5;
    for (const chain of chains) {
      const pts = chain.map((q) => camera.project(q));
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      for (const q of pts) {
        ctx.beginPath();
        discPath(ctx, q, 2.5);
        ctx.fill();
      }
    }
  }

  private paintContacts(ring: Ring, camera: Camera, p: LabPalette) {
    const ctx = this.ctx;
    const feet = ring.feet.pose(ring.time);
    const marks: { at: Vec3; on: boolean }[] = [
      {
        at: lerp(ring.skeleton.footL.toe, ring.skeleton.footL.heel, 0.5),
        on: feet.steppingL === null,
      },
      {
        at: lerp(ring.skeleton.footR.toe, ring.skeleton.footR.heel, 0.5),
        on: feet.steppingR === null,
      },
      ...ring.bull.plantedHooves().map((h) => ({ at: h.hoof, on: h.planted })),
    ];
    for (const m of marks) {
      const q = camera.project({ x: m.at.x, y: 0, z: m.at.z });
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, 0.07 * q.scale, 0.025 * q.scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = m.on ? p.planted : "rgb(220 60 60 / 0.8)";
      ctx.fill();
    }
  }
}

/* ---------- Clipping against the eye ---------- */

function clipToFront(corners: Vec3[], camera: Camera): Projected[] {
  const near = 0.4;
  const out: Vec3[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const da = camera.depthOf(a);
    const db = camera.depthOf(b);
    if (da >= near) out.push(a);
    if (da >= near !== db >= near) out.push(lerp(a, b, (near - da) / (db - da)));
  }
  return out.map((q) => camera.project(q));
}

function clipSegment(a: Vec3, b: Vec3, camera: Camera): [Projected, Projected] | null {
  const near = 0.4;
  const da = camera.depthOf(a);
  const db = camera.depthOf(b);
  if (da < near && db < near) return null;
  let pa = a;
  let pb = b;
  if (da < near) pa = lerp(a, b, (near - da) / (db - da));
  if (db < near) pb = lerp(a, b, (near - da) / (db - da));
  return [camera.project(pa), camera.project(pb)];
}
