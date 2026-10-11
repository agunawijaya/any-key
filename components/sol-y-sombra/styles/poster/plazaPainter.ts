import {
  around,
  gallery,
  GATE_TUNNEL,
  gateCut,
  inAisle,
  inGate,
  inToril,
  PLAZA,
  roofRim,
  row,
  standsLit,
  wallRadius,
  type SunPatch,
} from "@/lib/sol-y-sombra/plaza";
import { mix } from "@/lib/kit/color";
import { createRng } from "@/lib/kit/rng";
import { lerp, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import { NEAR, type Camera, type Projected } from "../../render/camera";
import { polygonPath } from "../../render/shapes";
import type { Pair, PosterPalette } from "./palette";

/*
 * The plaza in poster inks: a flat sky, the bowl of stands built segment by
 * segment round the ring (roof, arcaded gallery, rows of seats, the wall,
 * the passage, the red barrier), the great gate, and the sand split by the
 * shadow line, with its two painted circles.
 *
 * The bowl is drawn far to near, each segment from the roof down, so a
 * style can slip the crowd in row by row (`onRow`) and every person ends up
 * in front of the row behind them and behind the row in front.
 */

export const SEGMENTS = 144;

/** A soft halo drawn once and stamped round every lamp. */
function makeGlow(colour: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, colour);
  grad.addColorStop(1, "rgb(0 0 0 / 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return canvas;
}

export type RowHook = (segment: number, rowIndex: number) => void;

type Segment = { k: number; a0: number; a1: number; mid: number; depth: number; lit: boolean; pick: (pair: Pair) => string };

type Quad = [Vec3, Vec3, Vec3, Vec3];

export class PlazaPainter {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly marks: { at: Vec3; angle: number; length: number }[];
  private readonly stars: { x: number; y: number; r: number; twinkle: number }[];

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    const rng = createRng("sol-y-sombra/poster/sand");
    // Crayon marks on the sand: the lithographer's grain, fixed to the ground so they don't swim.
    this.marks = Array.from({ length: 420 }, () => {
      const r = Math.sqrt(rng.float()) * (PLAZA.ring - 0.3);
      const a = rng.float() * Math.PI * 2;
      return { at: { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }, angle: rng.float() * Math.PI, length: 0.25 + rng.float() * 0.6 };
    });
    this.stars = Array.from({ length: 140 }, () => ({ x: rng.float(), y: rng.float() * 0.55, r: 0.5 + rng.float() * 1.3, twinkle: rng.float() * Math.PI * 2 }));
  }

  /* ---------- Sky ---------- */

  paintSky(camera: Camera, p: PosterPalette, time: number) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, camera.height * 0.75);
    g.addColorStop(0, p.skyTop);
    g.addColorStop(1, p.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, camera.width, camera.height);
    if (p.stars) {
      ctx.fillStyle = p.stars;
      for (const s of this.stars) {
        ctx.globalAlpha = 0.45 + 0.4 * Math.sin(time * 1.3 + s.twinkle);
        ctx.beginPath();
        ctx.arc(s.x * camera.width, s.y * camera.height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- The bowl ---------- */

  /**
   * The stands, seen from the sand. Every layer of the bowl (roof, gallery,
   * each row from the top down, the wall, the passage, the barrier) is closer
   * to the sand than the layer above and behind it, so painting whole layers
   * from the outside in overlaps correctly from anywhere in the ring. Each
   * layer is gathered into one path per colour and filled at once, which is
   * what keeps thousands of quads cheap. `onRow` is called for each segment
   * of a row once that row's seats are down, so the crowd of each row sits
   * on it.
   */
  paintStands(camera: Camera, p: PosterPalette, sun: Vec3, onRow: RowHook, gateGlow = 0, torilOpen = false) {
    const segments: Segment[] = [];
    for (let k = 0; k < SEGMENTS; k++) {
      const a0 = (k / SEGMENTS) * Math.PI * 2;
      const a1 = ((k + 1) / SEGMENTS) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      const depth = camera.depthOf(around(mid, wallRadius(), 3));
      if (depth <= 0) continue;
      const lit = standsLit(mid, sun);
      segments.push({ k, a0, a1, mid, depth, lit, pick: (pair: Pair) => (lit ? pair.sun : pair.shade) });
    }
    segments.sort((a, b) => b.depth - a.depth);
    const ring = (seg: Segment, r: number, h: number): [Vec3, Vec3] => [around(seg.a0, r, h), around(seg.a1, r, h)];
    const g = gallery();
    const rim = roofRim();
    const cut = gateCut();
    const batch = new Batch(this.ctx, camera);

    // The roof, sloping up and out over the gallery, then the gallery's arches.
    for (const seg of segments) {
      const [r0, r1] = ring(seg, g.radius - 0.3, g.height);
      const [r2, r3] = ring(seg, rim.radius, rim.height);
      batch.quad([r0, r1, r3, r2], seg.pick(p.roof));
    }
    batch.flush();
    this.paintGallery(camera, p, sun);

    // The rows, top first: each row's risers, then its steps, then the people sitting on it.
    for (let i = PLAZA.rows - 1; i >= 0; i--) {
      const { radius, height } = row(i);
      const steps: [Quad, string][] = [];
      for (const seg of segments) {
        if (i < cut.rows && inGate(seg.mid, wallRadius())) continue;
        const front = ring(seg, radius, height);
        const back = ring(seg, radius + PLAZA.rowDepth, height);
        const next = ring(seg, radius + PLAZA.rowDepth, height + PLAZA.rowRise);
        const aisle = inAisle(seg.mid, radius);
        batch.quad([back[0], back[1], next[1], next[0]], aisle ? seg.pick(p.wall) : seg.pick(p.riser));
        steps.push([[front[0], front[1], back[1], back[0]], aisle ? seg.pick(p.arch) : seg.pick(p.step)]);
      }
      batch.flush();
      for (const [quad, colour] of steps) batch.quad(quad, colour);
      batch.flush();
      for (const seg of segments) onRow(seg.k, i);
    }

    // The wall under the first row, with the great gate cut through it; the passage.
    const wall = wallRadius();
    const first = row(0);
    for (const seg of segments) {
      if (inGate(seg.mid, wall)) continue;
      batch.quad([...ring(seg, wall, 0), ...ring(seg, first.radius, first.height).reverse()] as Quad, seg.pick(p.wall));
    }
    batch.flush();
    this.paintGate(camera, p, sun, gateGlow, segments);
    for (const seg of segments) batch.quad([...ring(seg, PLAZA.ring + 0.15, 0), ...ring(seg, wall, 0).reverse()] as Quad, seg.pick(p.passage));
    batch.flush();
    this.paintGateFrame(camera, p);
    const toril = segments.filter((seg) => inToril(seg.mid));
    if (torilOpen) this.paintTorilOpen(camera, p, toril);

    // The barrier, its boards and its cap, with a door left open where the gate is, and the bulls' door when it's open.
    const seams = new Path2D();
    let seamWidth = 1;
    for (const seg of segments) {
      if (inGate(seg.mid, PLAZA.ring)) continue;
      if (torilOpen && inToril(seg.mid)) continue;
      const [b0, b1] = ring(seg, PLAZA.ring, 0);
      const [t0, t1] = ring(seg, PLAZA.ring, PLAZA.barrierHeight - 0.14);
      const [c0, c1] = ring(seg, PLAZA.ring, PLAZA.barrierHeight);
      batch.quad([b0, b1, t1, t0], seg.pick(p.barrier));
      batch.quad([t0, t1, c1, c0], seg.pick(p.barrierTop));
      if (seg.k % 2 === 0) {
        const a = camera.project(b0);
        const b = camera.project(t0);
        if (a.depth > NEAR && b.depth > NEAR) {
          seams.moveTo(a.x, a.y);
          seams.lineTo(b.x, b.y);
          seamWidth = Math.max(seamWidth, a.scale * 0.012);
        }
      }
    }
    batch.flush();
    this.ctx.save();
    this.ctx.globalAlpha = 0.4;
    this.ctx.lineWidth = Math.min(3, seamWidth);
    this.ctx.strokeStyle = p.ink;
    this.ctx.stroke(seams);
    this.ctx.restore();
    if (!torilOpen) this.paintTorilShut(camera, p, toril);
  }

  /** The bulls' door standing open: the dark way to the pens in the wall, the door swung back into the passage. */
  private paintTorilOpen(camera: Camera, p: PosterPalette, toril: Segment[]) {
    if (!toril.length) return;
    const ctx = this.ctx;
    const a0 = Math.min(...toril.map((s) => s.a0));
    const a1 = Math.max(...toril.map((s) => s.a1));
    const wall = wallRadius() - 0.02;
    const corners = [around(a0, wall, 0), around(a1, wall, 0), around(a1, wall, PLAZA.torilHeight), around(a0, wall, PLAZA.torilHeight)].map((q) =>
      camera.project(q),
    );
    if (corners.some((q) => q.depth < NEAR)) return;
    ctx.beginPath();
    polygonPath(ctx, corners);
    ctx.fillStyle = p.gateDark;
    ctx.fill();
    ctx.lineWidth = Math.max(1, corners[0].scale * 0.03);
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // The door, hinged at one post, swung back flat against the passage's far side.
    const hinge = around(a0, PLAZA.ring, 0);
    const out = { x: Math.cos(a0), y: 0, z: Math.sin(a0) };
    const leaf = [hinge, { ...hinge, x: hinge.x + out.x * PLAZA.torilWidth, z: hinge.z + out.z * PLAZA.torilWidth }];
    const panel = [leaf[0], leaf[1], { ...leaf[1], y: PLAZA.barrierHeight }, { ...leaf[0], y: PLAZA.barrierHeight }].map((q) => camera.project(q));
    if (panel.some((q) => q.depth < NEAR)) return;
    ctx.beginPath();
    polygonPath(ctx, panel);
    ctx.fillStyle = toril[0].pick(p.barrier);
    ctx.fill();
    ctx.stroke();
  }

  /** The bulls' door shut: only its edges and its iron straps show in the boards. */
  private paintTorilShut(camera: Camera, p: PosterPalette, toril: Segment[]) {
    if (!toril.length) return;
    const ctx = this.ctx;
    const a0 = Math.min(...toril.map((s) => s.a0));
    const a1 = Math.max(...toril.map((s) => s.a1));
    const edge = (a: number) => [camera.project(around(a, PLAZA.ring - 0.01, 0.02)), camera.project(around(a, PLAZA.ring - 0.01, PLAZA.barrierHeight - 0.16))];
    const strap = (h: number) => [camera.project(around(a0, PLAZA.ring - 0.01, h)), camera.project(around(a0 + (a1 - a0) * 0.45, PLAZA.ring - 0.01, h))];
    const lines = [edge(a0), edge(a1), strap(0.3), strap(PLAZA.barrierHeight - 0.4)];
    if (lines.flat().some((q) => q.depth < NEAR)) return;
    ctx.save();
    ctx.strokeStyle = p.ink;
    ctx.lineCap = "round";
    for (const [a, b] of lines) {
      ctx.lineWidth = Math.max(1.2, a.scale * 0.035);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The gallery: a face of arches, each a bay between two columns, its dark interior showing through. */
  private paintGallery(camera: Camera, p: PosterPalette, sun: Vec3) {
    const g = gallery();
    const ctx = this.ctx;
    const batch = new Batch(ctx, camera);
    const bays = SEGMENTS / 2;
    const openings = { lit: new Path2D(), shade: new Path2D() };
    const columns = { lit: new Path2D(), shade: new Path2D() };
    let lineWidth = 1;
    const order: { b: number; depth: number }[] = [];
    for (let b = 0; b < bays; b++) {
      const mid = ((b + 0.5) / bays) * Math.PI * 2;
      const depth = camera.depthOf(around(mid, g.radius, g.floor));
      if (depth > NEAR) order.push({ b, depth });
    }
    order.sort((a, b) => b.depth - a.depth);
    for (const { b } of order) {
      const a0 = (b / bays) * Math.PI * 2;
      const a1 = ((b + 1) / bays) * Math.PI * 2;
      const lit = standsLit((a0 + a1) / 2, sun);
      const at = (u: number, h: number) => lerp(around(a0, g.radius, h), around(a1, g.radius, h), u);
      batch.quad([at(0, g.floor), at(1, g.floor), at(1, g.height), at(0, g.height)], lit ? p.arch.sun : p.arch.shade);
      const spring = g.floor + PLAZA.galleryHeight * 0.55;
      const top = g.floor + PLAZA.galleryHeight * 0.86;
      const side = 0.16;
      const pts: Vec3[] = [at(side, g.floor + 0.05)];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(at(side + (1 - 2 * side) * t, spring + (top - spring) * Math.sin(Math.PI * t)));
      }
      pts.push(at(1 - side, g.floor + 0.05));
      const projected = pts.map((q) => camera.project(q));
      if (projected.some((q) => q.depth < NEAR) || offScreen(projected, camera)) continue;
      const path = lit ? openings.lit : openings.shade;
      projected.forEach((q, i) => (i ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
      path.closePath();
      const line = lit ? columns.lit : columns.shade;
      projected.forEach((q, i) => (i ? line.lineTo(q.x, q.y) : line.moveTo(q.x, q.y)));
      lineWidth = Math.max(lineWidth, projected[0].scale * 0.05);
    }
    batch.flush();
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = p.gateDark;
    ctx.fill(openings.lit);
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = p.ink;
    ctx.fill(openings.shade);
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.min(6, lineWidth);
    ctx.strokeStyle = p.column.sun;
    ctx.stroke(columns.lit);
    ctx.strokeStyle = p.column.shade;
    ctx.stroke(columns.shade);
    ctx.restore();
  }

  /**
   * The great gate: a block of masonry where the stands are cut away for it,
   * and through its arch a vaulted passage running out under the stands. Its
   * walls are dark by the mouth and catch more light towards the far end,
   * which is dark when the gate is shut and the bright evening outside when
   * it stands open.
   */
  private paintGate(camera: Camera, p: PosterPalette, sun: Vec3, glow: number, segments: Segment[]) {
    const ctx = this.ctx;
    const wall = wallRadius();
    const lit = standsLit(PLAZA.gateAzimuth, sun);
    const stone = lit ? p.wall.sun : p.wall.shade;
    const top = gateCut().top;
    const batch = new Batch(ctx, camera);
    for (const seg of segments) {
      if (!inGate(seg.mid, wall)) continue;
      batch.quad([around(seg.a0, wall, 0), around(seg.a1, wall, 0), around(seg.a1, wall, top), around(seg.a0, wall, top)], stone);
    }
    batch.flush();

    // The passage, in its own frame: along it, across it, up.
    const a = PLAZA.gateAzimuth;
    const along = { x: Math.cos(a), z: Math.sin(a) };
    const across = { x: -Math.sin(a), z: Math.cos(a) };
    const half = PLAZA.gateWidth / 2;
    const spring = PLAZA.gateHeight - half;
    const at = (depth: number, side: number, h: number): Vec3 => ({
      x: along.x * (wall + depth) + across.x * side,
      y: h,
      z: along.z * (wall + depth) + across.z * side,
    });
    // The arch's outline, left foot round to right foot: walls, then the vault.
    const section = (depth: number) => {
      const pts: Vec3[] = [at(depth, -half, 0), at(depth, -half, spring)];
      for (let i = 1; i < 12; i++) {
        const t = Math.PI * (1 - i / 12);
        pts.push(at(depth, Math.cos(t) * half, spring + Math.sin(t) * half));
      }
      pts.push(at(depth, half, spring), at(depth, half, 0));
      return pts;
    };
    const mouth = section(-0.02).map((q) => camera.project(q));
    const end = section(GATE_TUNNEL).map((q) => camera.project(q));
    if ([...mouth, ...end].some((q) => q.depth < NEAR) || offScreen(mouth, camera)) return;
    const near = mouth.map((q) => q);
    const far = end;
    const trace = (pts: Projected[]) => {
      const path = new Path2D();
      pts.forEach((q, i) => (i ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
      path.closePath();
      return path;
    };
    const dark = p.gateDark;
    const open = glow > 0;
    const farTone = open ? mix(p.gateGlow, dark, 0.25) : mix(dark, "#000000", 0.25);
    const nearMid = camera.project(at(0, 0, spring * 0.6));
    const farMid = camera.project(at(GATE_TUNNEL, 0, spring * 0.6));
    const depthShade = (from: string, to: string) => {
      const g = ctx.createLinearGradient(nearMid.x, nearMid.y, farMid.x, farMid.y);
      g.addColorStop(0, from);
      g.addColorStop(1, to);
      return g;
    };

    ctx.save();
    ctx.clip(trace(mouth));
    // The far end: the evening outside, sky over a strip of street, or darkness.
    const outside = trace(far);
    if (open) {
      const sky = ctx.createLinearGradient(0, far[7].y, 0, far[0].y);
      sky.addColorStop(0, "#fff6dc");
      sky.addColorStop(0.62, p.gateGlow);
      sky.addColorStop(0.63, mix(p.gateGlow, "#6b3a1e", 0.45));
      sky.addColorStop(1, mix(p.gateGlow, "#6b3a1e", 0.3));
      ctx.fillStyle = sky;
    } else ctx.fillStyle = mix(dark, "#000000", 0.4);
    ctx.fill(outside);
    // The walls and the vault, each strip from the mouth to the far end.
    for (let i = 0; i < near.length - 1; i++) {
      const strip = trace([near[i], near[i + 1], far[i + 1], far[i]]);
      const vault = i > 0 && i < near.length - 2;
      const base = vault ? mix(dark, "#000000", 0.15) : dark;
      ctx.fillStyle = depthShade(base, vault ? mix(farTone, dark, 0.35) : farTone);
      ctx.fill(strip);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.stroke(strip);
    }
    // The floor, catching the light that pours in.
    const floor = trace([near[near.length - 1], near[0], far[0], far[far.length - 1]]);
    ctx.fillStyle = depthShade(mix(dark, p.sand.shade, 0.35), open ? mix(p.gateGlow, "#ffffff", 0.25) : dark);
    ctx.fill(floor);
    // Courses of stone along the passage, so it reads as a tunnel and not a painted shape.
    ctx.strokeStyle = mix(dark, "#000000", 0.35);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, nearMid.scale * 0.03);
    for (let d = 1; d < GATE_TUNNEL; d += 1.4) {
      const ring = section(d).map((q) => camera.project(q));
      ctx.beginPath();
      ring.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The light of the evening outside, falling through the open gate and the
   * door in the barrier onto the sand in a widening fan.
   */
  paintGateLight(camera: Camera, p: PosterPalette, glow: number) {
    const a = PLAZA.gateAzimuth;
    const half = PLAZA.gateWidth / 2;
    const towards = (r: number, offset: number) => {
      const dir = { x: Math.cos(a), z: Math.sin(a) };
      const side = { x: -dir.z, z: dir.x };
      return { x: dir.x * r + side.x * offset, y: 0.01, z: dir.z * r + side.z * offset };
    };
    const corners = [towards(wallRadius(), -half), towards(wallRadius(), half), towards(PLAZA.ring - 9, half * 2.4), towards(PLAZA.ring - 9, -half * 2.4)];
    const pts = corners.map((q) => camera.project(q));
    if (pts.some((q) => q.depth < NEAR)) return;
    const from = camera.project(towards(wallRadius(), 0));
    const to = camera.project(towards(PLAZA.ring - 9, 0));
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    g.addColorStop(0, p.gateGlow);
    g.addColorStop(1, "rgb(0 0 0 / 0)");
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.55 * glow;
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  /** The gate's frame: an arch of stone round the opening, drawn once over the bowl. */
  paintGateFrame(camera: Camera, p: PosterPalette) {
    const wall = wallRadius() - 0.05;
    const half = PLAZA.gateWidth / 2 / wall;
    const a = PLAZA.gateAzimuth;
    const spring = PLAZA.gateHeight - PLAZA.gateWidth / 2;
    const n = 18;
    const inner: Vec3[] = [];
    const outer: Vec3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const angle = Math.PI * (1 - t);
      const u = Math.cos(angle);
      const v = Math.sin(angle);
      inner.push(around(a + half * u, wall, spring + (PLAZA.gateWidth / 2) * v));
      outer.push(around(a + half * u * 1.22, wall, spring + (PLAZA.gateWidth / 2) * 1.22 * v));
    }
    const legs = [around(a - half, wall, 0), around(a + half, wall, 0), around(a + half * 1.22, wall, 0), around(a - half * 1.22, wall, 0)];
    const ctx = this.ctx;
    const pi = inner.map((q) => camera.project(q));
    const po = outer.map((q) => camera.project(q));
    const pl = legs.map((q) => camera.project(q));
    if ([...pi, ...po, ...pl].some((q) => q.depth < NEAR)) return;
    // The arch stands behind the barrier: keep it above the barrier's top edge.
    const edge: Projected[] = [];
    for (let i = 0; i <= 12; i++) edge.push(camera.project(around(a - half * 1.6 + (half * 3.2 * i) / 12, PLAZA.ring, PLAZA.barrierHeight)));
    if (edge.some((q) => q.depth < NEAR)) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(edge[0].x, -10000);
    for (const q of edge) ctx.lineTo(q.x, q.y);
    ctx.lineTo(edge[edge.length - 1].x, -10000);
    ctx.closePath();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(pl[3].x, pl[3].y);
    for (const q of po) ctx.lineTo(q.x, q.y);
    ctx.lineTo(pl[2].x, pl[2].y);
    ctx.lineTo(pl[1].x, pl[1].y);
    for (const q of [...pi].reverse()) ctx.lineTo(q.x, q.y);
    ctx.lineTo(pl[0].x, pl[0].y);
    ctx.closePath();
    ctx.fillStyle = p.arch.sun;
    ctx.fill();
    ctx.lineWidth = Math.max(1, pi[0].scale * 0.04);
    ctx.strokeStyle = p.ink;
    ctx.stroke();
    // Voussoirs: the wedge stones of the arch.
    ctx.beginPath();
    for (let i = 1; i < n; i += 2) {
      ctx.moveTo(pi[i].x, pi[i].y);
      ctx.lineTo(po[i].x, po[i].y);
    }
    ctx.lineWidth = Math.max(1, pi[0].scale * 0.02);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- Lamps, for the evening festival ---------- */

  private glow: HTMLCanvasElement | null = null;

  /** Lanterns along the gallery and on the barrier, each with a soft warm halo. */
  paintLamps(camera: Camera, p: PosterPalette) {
    if (!p.lamp) return;
    const ctx = this.ctx;
    const halo = (this.glow ??= makeGlow(p.lampGlow));
    const g = gallery();
    const lamps: { at: Vec3; size: number }[] = [];
    for (let k = 0; k < SEGMENTS; k += 2) {
      const a = (k / SEGMENTS) * Math.PI * 2;
      lamps.push({ at: around(a, g.radius - 0.1, g.floor + PLAZA.galleryHeight * 0.5), size: 2.4 });
    }
    for (let k = 1; k < SEGMENTS; k += 4) {
      const a = (k / SEGMENTS) * Math.PI * 2;
      if (inGate(a, PLAZA.ring)) continue;
      lamps.push({ at: around(a, PLAZA.ring + 0.05, PLAZA.barrierHeight + 0.25), size: 1.6 });
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const lamp of lamps) {
      const q = camera.project(lamp.at);
      if (q.depth < NEAR) continue;
      const r = lamp.size * q.scale;
      ctx.drawImage(halo, q.x - r, q.y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.fillStyle = p.lamp;
    for (const lamp of lamps) {
      const q = camera.project(lamp.at);
      if (q.depth < NEAR) continue;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(1.2, 0.09 * q.scale), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------- The sand ---------- */

  paintSand(camera: Camera, p: PosterPalette, patch: SunPatch) {
    const ctx = this.ctx;
    const floor = this.discPath(camera, { x: 0, y: 0, z: 0 }, PLAZA.ring);
    if (!floor) return;
    ctx.save();
    ctx.clip(floor);
    ctx.fillStyle = p.sand.shade;
    ctx.fillRect(0, 0, camera.width, camera.height);
    const sunny = this.discPath(camera, patch.centre, patch.radius);
    if (sunny) {
      ctx.fillStyle = p.sand.sun;
      ctx.fill(sunny);
    }
    this.paintMarks(camera, p, patch);
    // The two painted circles, in each side's light.
    for (const inset of PLAZA.rings) {
      const r = PLAZA.ring - inset;
      const outer = this.discPath(camera, { x: 0, y: 0, z: 0 }, r + 0.07);
      const inner = this.discPath(camera, { x: 0, y: 0, z: 0 }, r - 0.07);
      if (!outer || !inner) continue;
      const band = new Path2D();
      band.addPath(outer);
      band.addPath(inner);
      ctx.fillStyle = p.painted.shade;
      ctx.fill(band, "evenodd");
      if (sunny) {
        ctx.save();
        ctx.clip(sunny);
        ctx.fillStyle = p.painted.sun;
        ctx.fill(band, "evenodd");
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private paintMarks(camera: Camera, p: PosterPalette, patch: SunPatch) {
    const ctx = this.ctx;
    const inSun = new Path2D();
    const inShade = new Path2D();
    let width = 0.8;
    for (const m of this.marks) {
      const a = camera.project(m.at);
      if (a.depth < NEAR) continue;
      const b = camera.project({ x: m.at.x + Math.cos(m.angle) * m.length, y: 0, z: m.at.z + Math.sin(m.angle) * m.length });
      const path = Math.hypot(m.at.x - patch.centre.x, m.at.z - patch.centre.z) < patch.radius ? inSun : inShade;
      path.moveTo(a.x, a.y);
      path.lineTo(b.x, b.y);
      width = Math.max(width, a.scale * 0.03);
    }
    ctx.lineCap = "round";
    ctx.lineWidth = Math.min(4, width);
    ctx.strokeStyle = p.sandMark.sun;
    ctx.stroke(inSun);
    ctx.strokeStyle = p.sandMark.shade;
    ctx.stroke(inShade);
  }

  /** A level circle on the ground, cut to what lies in front of the eye. */
  discPath(camera: Camera, centre: Vec3, radius: number): Path2D | null {
    const pts: Projected[] = [];
    const n = 120;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const q = { x: centre.x + Math.cos(a) * radius, y: centre.y, z: centre.z + Math.sin(a) * radius };
      if (camera.depthOf(q) < NEAR) continue;
      pts.push(camera.project(q));
    }
    if (pts.length < 3) return null;
    const path = new Path2D();
    pts.forEach((q, i) => (i ? path.lineTo(q.x, q.y) : path.moveTo(q.x, q.y)));
    path.closePath();
    return path;
  }
}

/** Whether every point of a shape is off the same side of the screen. */
function offScreen(pts: Projected[], camera: Camera) {
  const m = 40;
  return pts.every((q) => q.x < -m) || pts.every((q) => q.x > camera.width + m) || pts.every((q) => q.y < -m) || pts.every((q) => q.y > camera.height + m);
}

/**
 * Quads gathered by colour into one path each and filled together. A hairline
 * of the same colour round each fill hides the seams between neighbours.
 */
class Batch {
  private readonly paths = new Map<string, Path2D>();

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly camera: Camera,
  ) {}

  quad(corners: Quad, colour: string) {
    const pts = corners.map((q) => this.camera.project(q));
    if (pts.some((q) => q.depth < NEAR) || offScreen(pts, this.camera)) return;
    let path = this.paths.get(colour);
    if (!path) {
      path = new Path2D();
      this.paths.set(colour, path);
    }
    path.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
    path.closePath();
  }

  flush() {
    const ctx = this.ctx;
    ctx.lineWidth = 0.8;
    for (const [colour, path] of this.paths) {
      ctx.fillStyle = colour;
      ctx.fill(path);
      ctx.strokeStyle = colour;
      ctx.stroke(path);
    }
    this.paths.clear();
  }
}
