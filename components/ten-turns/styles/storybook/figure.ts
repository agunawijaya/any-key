/*
 * How the Storybook paints a character: a figure is a handful of closed
 * shapes (a head, a body, two ears) painted as one, the way an illustrator
 * inks a silhouette and fills it. The ink line is heavier on the side away
 * from the light, the shade is a crescent on that side, and at night a thin
 * rim of moonlight runs round the lit edge.
 */

import { scatter, smoothOpen, type Pt } from "./paint";

export type Part = Pt[];

/** Outward-facing points on the silhouette, with their normals. */
export type Edge = { p: Pt; n: Pt };

export type FigurePaint = {
  fill: string;
  shade: string;
  ink: string;
  /** Half the ink line, in the figure's own units. */
  line: number;
  /** Unit vector towards the light, on screen (up is negative y). */
  light: Pt;
  /** How far the lit fill is pushed towards the light: the width of the shade crescent. */
  shadeDepth: number;
  rim?: { color: string; width: number };
  sheen?: { color: string; radius: number };
};

const area = (part: Part) => {
  let sum = 0;
  for (let i = 0; i < part.length; i++) {
    const a = part[i];
    const b = part[(i + 1) % part.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
};

/** Every part winds the same way, so overlapping parts fill as one under the nonzero rule. */
const oriented = (part: Part): Part => (area(part) < 0 ? part.reverse() : part);

export function ellipse(cx: number, cy: number, rx: number, ry: number, rotation = 0, segments = 44): Part {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const pts: Part = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  }
  return oriented(pts);
}

/** Points along a smooth curve through the control points. */
export function curve(control: Pt[], samples = 18): Pt[] {
  if (control.length < 3) {
    const [a, b] = control;
    return Array.from({ length: samples }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / (samples - 1), y: a.y + ((b.y - a.y) * i) / (samples - 1) }));
  }
  const out: Pt[] = [];
  const segs = control.length - 1;
  for (let i = 0; i < samples; i++) {
    const u = (i / (samples - 1)) * segs;
    const k = Math.min(segs - 1, Math.floor(u));
    const t = u - k;
    const p0 = control[Math.max(0, k - 1)];
    const p1 = control[k];
    const p2 = control[k + 1];
    const p3 = control[Math.min(control.length - 1, k + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    out.push({
      x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    });
  }
  return out;
}

/**
 * A limb, an ear or a scarf end: a shape that follows a spine, as wide as
 * `width(t)` along it (t from 0 to 1), with rounded ends.
 */
export function limb(control: Pt[], width: (t: number) => number, samples = 18): Part {
  const spine = curve(control, samples);
  const left: Pt[] = [];
  const right: Pt[] = [];
  const normals: Pt[] = [];
  for (let i = 0; i < spine.length; i++) {
    const a = spine[Math.max(0, i - 1)];
    const b = spine[Math.min(spine.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
    normals.push(n);
    const w = width(i / (spine.length - 1)) / 2;
    left.push({ x: spine[i].x + n.x * w, y: spine[i].y + n.y * w });
    right.push({ x: spine[i].x - n.x * w, y: spine[i].y - n.y * w });
  }
  // A cap sweeps from one side of the limb round its end to the other, bulging outwards.
  const cap = (centre: Pt, n: Pt, w: number) => {
    const pts: Pt[] = [];
    const tangent = { x: n.y, y: -n.x };
    for (let i = 1; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      pts.push({ x: centre.x + (n.x * Math.cos(a) + tangent.x * Math.sin(a)) * w, y: centre.y + (n.y * Math.cos(a) + tangent.y * Math.sin(a)) * w });
    }
    return pts;
  };
  const last = spine.length - 1;
  const endCap = cap(spine[last], normals[last], width(1) / 2);
  const startCap = cap(spine[0], { x: -normals[0].x, y: -normals[0].y }, width(0) / 2);
  return oriented([...left, ...endCap, ...right.reverse(), ...startCap]);
}

/** A closed shape through the given points, smoothed. */
export function blobOf(control: Pt[], samplesPerSpan = 6): Part {
  const n = control.length;
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const p0 = control[(k - 1 + n) % n];
    const p1 = control[k];
    const p2 = control[(k + 1) % n];
    const p3 = control[(k + 2) % n];
    for (let i = 0; i < samplesPerSpan; i++) {
      const t = i / samplesPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      pts.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return oriented(pts);
}

export function inside(p: Pt, part: Part): boolean {
  let hit = false;
  for (let i = 0, j = part.length - 1; i < part.length; j = i++) {
    const a = part[i];
    const b = part[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The silhouette's outer edge: every point of every part that no other part covers. */
export function edges(parts: Part[]): Edge[][] {
  const runs: Edge[][] = [];
  parts.forEach((part, index) => {
    let run: Edge[] = [];
    for (let i = 0; i < part.length; i++) {
      const p = part[i];
      const covered = parts.some((other, j) => j !== index && inside(p, other));
      if (covered) {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      const a = part[(i - 1 + part.length) % part.length];
      const b = part[(i + 1) % part.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      run.push({ p, n: { x: (b.y - a.y) / len, y: -(b.x - a.x) / len } });
    }
    if (run.length > 1) runs.push(run);
  });
  return runs;
}

/**
 * Tufts of fur along the silhouette: little points of fur sticking out where
 * `where` allows. Long, narrow tufts read as fur standing on end.
 */
export function furTufts(parts: Part[], options: { seed: number; spacing: number; length: number; width: number; where?: (e: Edge) => boolean }): Part[] {
  const rand = scatter(options.seed);
  const tufts: Part[] = [];
  for (const run of edges(parts)) {
    let travelled = rand() * options.spacing;
    for (let i = 1; i < run.length; i++) {
      travelled += Math.hypot(run[i].p.x - run[i - 1].p.x, run[i].p.y - run[i - 1].p.y);
      if (travelled < options.spacing) continue;
      travelled = 0;
      const e = run[i];
      if (options.where && !options.where(e)) continue;
      const tangent = { x: -e.n.y, y: e.n.x };
      const len = options.length * (0.6 + rand() * 0.7);
      const half = options.width * (0.4 + rand() * 0.25);
      const lean = (rand() - 0.5) * 0.9;
      const base = { x: e.p.x - e.n.x * half * 0.6, y: e.p.y - e.n.y * half * 0.6 };
      tufts.push(
        oriented([
          { x: base.x + tangent.x * half, y: base.y + tangent.y * half },
          { x: e.p.x + (e.n.x + tangent.x * lean) * len, y: e.p.y + (e.n.y + tangent.y * lean) * len },
          { x: base.x - tangent.x * half, y: base.y - tangent.y * half },
        ]),
      );
    }
  }
  return tufts;
}

export function tracePath(ctx: CanvasRenderingContext2D, parts: Part[]) {
  ctx.beginPath();
  for (const part of parts) {
    ctx.moveTo(part[0].x, part[0].y);
    for (let i = 1; i < part.length; i++) ctx.lineTo(part[i].x, part[i].y);
    ctx.closePath();
  }
}

/** Inks, fills and shades a group of parts as one silhouette. */
export function paintFigure(ctx: CanvasRenderingContext2D, parts: Part[], paint: FigurePaint) {
  const { light, line } = paint;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // A heavier line on the shadow side: the ink silhouette, nudged away from the light.
  ctx.save();
  ctx.translate(-light.x * line * 1.1, -light.y * line * 1.1);
  tracePath(ctx, parts);
  ctx.lineWidth = line * 2;
  ctx.strokeStyle = paint.ink;
  ctx.stroke();
  ctx.restore();

  tracePath(ctx, parts);
  ctx.lineWidth = line * 2;
  ctx.strokeStyle = paint.ink;
  ctx.stroke();
  ctx.fillStyle = paint.shade;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.translate(light.x * paint.shadeDepth, light.y * paint.shadeDepth);
  tracePath(ctx, parts);
  ctx.fillStyle = paint.fill;
  ctx.fill();
  ctx.restore();

  if (paint.sheen) {
    const box = bounds(parts);
    const cx = (box.left + box.right) / 2 + light.x * (box.right - box.left) * 0.22;
    const cy = (box.top + box.bottom) / 2 + light.y * (box.bottom - box.top) * 0.22;
    ctx.save();
    tracePath(ctx, parts);
    ctx.clip();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, paint.sheen.radius);
    glow.addColorStop(0, paint.sheen.color);
    glow.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(box.left - 1, box.top - 1, box.right - box.left + 2, box.bottom - box.top + 2);
    ctx.restore();
  }

  if (paint.rim) {
    ctx.save();
    tracePath(ctx, parts);
    ctx.clip();
    ctx.strokeStyle = paint.rim.color;
    ctx.lineWidth = paint.rim.width * 2;
    for (const run of edges(parts)) {
      let open = false;
      ctx.beginPath();
      for (const e of run) {
        const lit = e.n.x * light.x + e.n.y * light.y > 0.3;
        if (lit && !open) {
          ctx.moveTo(e.p.x, e.p.y);
          open = true;
        } else if (lit) ctx.lineTo(e.p.x, e.p.y);
        else open = false;
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export function bounds(parts: Part[]) {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const part of parts) {
    for (const p of part) {
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
    }
  }
  return { left, right, top, bottom };
}

/** A plain inked line, for whiskers, brows and stitches. */
export function inkLine(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, color: string) {
  ctx.beginPath();
  smoothOpen(ctx, pts);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}
