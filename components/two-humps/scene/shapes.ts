/* Small drawing helpers shared by everything that stands in the diorama. */

export type Point = [number, number];

/**
 * A smooth curve through `points` (Catmull–Rom, drawn as Béziers). With
 * `closed` the curve wraps round to the start, for outlines.
 */
export function smoothPath(path: CanvasPath, points: Point[], closed = true, tension = 0.5) {
  const n = points.length;
  if (n < 2) return;
  const at = (i: number) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  path.moveTo(points[0][0], points[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = tension / 3;
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) path.closePath();
}

/** A tapering limb or neck: a smooth band round a centre line, `widths` per point. */
export function bandPath(centre: Point[], widths: number[]): Path2D {
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < centre.length; i++) {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(centre.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = widths[i] / 2;
    left.push([centre[i][0] + nx * w, centre[i][1] + ny * w]);
    right.push([centre[i][0] - nx * w, centre[i][1] - ny * w]);
  }
  const path = new Path2D();
  smoothPath(path, [...left, ...right.reverse()], true, 0.45);
  return path;
}

/** Where a two-segment limb's middle joint sits, reaching from `root` to `tip`. `bend` picks the side. */
export function solveJoint(root: Point, tip: Point, upper: number, lower: number, bend: 1 | -1): Point {
  const dx = tip[0] - root[0];
  const dy = tip[1] - root[1];
  const reach = Math.min(Math.hypot(dx, dy), upper + lower - 1e-6);
  const base = Math.atan2(dy, dx);
  const cos = (upper * upper + reach * reach - lower * lower) / (2 * upper * reach);
  const angle = base + bend * Math.acos(Math.max(-1, Math.min(1, cos)));
  return [root[0] + Math.cos(angle) * upper, root[1] + Math.sin(angle) * upper];
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
