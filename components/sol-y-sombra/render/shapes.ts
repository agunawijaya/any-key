import { type Projected } from "./camera";

/*
 * Flat shapes for drawing projected 3D bodies: tapered capsules (limbs,
 * necks, horns), discs (heads, joints) and polygons (cloth). Paths only;
 * the caller fills and strokes them, which is where a style's look lives.
 */

/** Adds a tapered capsule between two projected points to a path (a context's current path, or a Path2D). */
export function capsulePath(path: CanvasPath, a: Projected, ra: number, b: Projected, rb: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(ra - rb) + 0.01) {
    const big = ra >= rb ? { p: a, r: ra } : { p: b, r: rb };
    path.moveTo(big.p.x + big.r, big.p.y);
    path.arc(big.p.x, big.p.y, big.r, 0, Math.PI * 2);
    return;
  }
  const th = Math.atan2(dy, dx);
  const phi = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)));
  path.moveTo(a.x + ra * Math.cos(th + phi), a.y + ra * Math.sin(th + phi));
  path.arc(a.x, a.y, ra, th + phi, th + Math.PI * 2 - phi);
  path.arc(b.x, b.y, rb, th - phi, th + phi);
  path.closePath();
}

export function discPath(path: CanvasPath, p: Projected, r: number) {
  path.moveTo(p.x + r, p.y);
  path.arc(p.x, p.y, r, 0, Math.PI * 2);
}

export function polygonPath(path: CanvasPath, points: { x: number; y: number }[]) {
  if (!points.length) return;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) path.lineTo(points[i].x, points[i].y);
  path.closePath();
}

/** A smooth closed outline through points (a Catmull–Rom curve drawn as Béziers). */
export function smoothClosedPath(path: CanvasPath, points: { x: number; y: number }[], tension = 0.5) {
  const n = points.length;
  if (n < 3) return polygonPath(path, points);
  path.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const k = tension / 3;
    path.bezierCurveTo(p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k, p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k, p2.x, p2.y);
  }
  path.closePath();
}

/** A smooth open line through points. */
export function smoothLinePath(path: CanvasPath, points: { x: number; y: number }[], tension = 0.5) {
  const n = points.length;
  if (!n) return;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const k = tension / 3;
    path.bezierCurveTo(p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k, p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k, p2.x, p2.y);
  }
}
