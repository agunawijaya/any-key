import { mix } from "@/lib/kit/color";

/*
 * How every performer and prop is painted. A part is a closed path filled
 * flat, then shaded the way a 2D animator would: a crescent of shade on the
 * side away from the key light, a thin rim of stage light on the lit edge,
 * and an ink line tinted from the fill (never pure black), heavier on the
 * shadow side. Paths are built fresh each frame from the pose.
 */

export type Pt = { x: number; y: number };

export const pt = (x: number, y: number): Pt => ({ x, y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const len = (a: Pt) => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Pt): Pt => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
export const perp = (a: Pt): Pt => ({ x: -a.y, y: a.x });
export const rotate = (a: Pt, angle: number): Pt => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
export const polar = (angle: number, r: number): Pt => ({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const ease = (v: number) => {
  const c = clamp(v);
  return c * c * (3 - 2 * c);
};

// ---------- Shapes ----------

/** A limb segment: two circles joined by their outer tangents. */
export function capsule(a: Pt, b: Pt, ra: number, rb: number, path = new Path2D()): Path2D {
  const d = dist(a, b);
  if (d < 1e-3 || d <= Math.abs(ra - rb)) {
    const r = Math.max(ra, rb);
    const c = ra >= rb ? a : b;
    path.moveTo(c.x + r, c.y);
    path.arc(c.x, c.y, r, 0, Math.PI * 2);
    return path;
  }
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  // The tangent touches each circle at this angle off the axis.
  const off = Math.acos((ra - rb) / d);
  path.moveTo(a.x + Math.cos(angle + off) * ra, a.y + Math.sin(angle + off) * ra);
  path.arc(a.x, a.y, ra, angle + off, angle - off + Math.PI * 2);
  path.lineTo(b.x + Math.cos(angle - off) * rb, b.y + Math.sin(angle - off) * rb);
  path.arc(b.x, b.y, rb, angle - off, angle + off);
  path.closePath();
  return path;
}

/** A smooth closed shape through the points (Catmull-Rom turned into Bézier curves). */
export function blob(points: Pt[], tension = 1, path = new Path2D()): Path2D {
  const n = points.length;
  if (n < 3) return path;
  const k = tension / 6;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    path.bezierCurveTo(p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k, p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k, p2.x, p2.y);
  }
  path.closePath();
  return path;
}

/** A smooth open line through the points. */
export function curve(points: Pt[], path = new Path2D(), tension = 1): Path2D {
  const n = points.length;
  if (n < 2) return path;
  const k = tension / 6;
  path.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    path.bezierCurveTo(p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k, p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k, p2.x, p2.y);
  }
  return path;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rotation = 0, path = new Path2D()): Path2D {
  path.moveTo(cx + Math.cos(rotation) * rx, cy + Math.sin(rotation) * rx);
  path.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rotation, 0, Math.PI * 2);
  return path;
}

export function roundRect(x: number, y: number, w: number, h: number, r: number, path = new Path2D()): Path2D {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  path.moveTo(x + rr, y);
  path.arcTo(x + w, y, x + w, y + h, rr);
  path.arcTo(x + w, y + h, x, y + h, rr);
  path.arcTo(x, y + h, x, y, rr);
  path.arcTo(x, y, x + w, y, rr);
  path.closePath();
  return path;
}

export function poly(points: Pt[], path = new Path2D()): Path2D {
  points.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  path.closePath();
  return path;
}

// ---------- Light and paint ----------

export type Light = {
  /** Unit vector pointing towards the key light, on screen (up is negative y). */
  dir: Pt;
  /** Shade colour mixed into fills on the dark side. */
  shadow: string;
  /** How strongly fills are shaded, 0 to 1. */
  shadeAmount: number;
  /** Width of the shade crescent in model units. */
  shadeDepth: number;
  /** A thin rim of back light on the lit edge, in model units; none in flat daylight. */
  rim?: { color: string; width: number; alpha: number };
  /** Ink line width in model units; 0 for no line. */
  ink: number;
  /** Colour the ink leans towards. */
  inkTone: string;
};

export type PartStyle = {
  shade?: boolean;
  rim?: boolean;
  ink?: boolean;
  /** Override the ink colour. */
  inkColor?: string;
  /** Multiply the ink width. */
  inkScale?: number;
  alpha?: number;
};

const tones = new Map<string, { shade: string; ink: string }>();

/** The shade and ink that go with a fill under a light, cached because they are asked for every frame. */
export function tonesFor(fill: string, light: Light) {
  const key = `${fill}|${light.shadow}|${light.shadeAmount}|${light.inkTone}`;
  let t = tones.get(key);
  if (!t) {
    t = { shade: mix(fill, light.shadow, light.shadeAmount), ink: mix(mix(fill, "#000000", 0.55), light.inkTone, 0.35) };
    tones.set(key, t);
  }
  return t;
}

/** Paints parts under one light. Scenes set the light; figures and props just ask for parts. */
export class Painter {
  readonly ctx: CanvasRenderingContext2D;
  light: Light;

  constructor(ctx: CanvasRenderingContext2D, light: Light) {
    this.ctx = ctx;
    this.light = light;
  }

  part(path: Path2D, fill: string, style: PartStyle = {}) {
    const { ctx, light } = this;
    const { shade = true, rim = true, ink = true, alpha = 1 } = style;
    const t = tonesFor(fill, light);
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    ctx.fillStyle = fill;
    ctx.fill(path);
    if ((shade && light.shadeAmount > 0) || (rim && light.rim)) {
      ctx.save();
      ctx.clip(path);
      if (shade && light.shadeAmount > 0) {
        // Everything the path covers that the same path nudged towards the light doesn't: the crescent away from it.
        const crescent = new Path2D();
        crescent.addPath(path);
        crescent.addPath(path, new DOMMatrix().translate(light.dir.x * light.shadeDepth, light.dir.y * light.shadeDepth));
        ctx.fillStyle = t.shade;
        ctx.fill(crescent, "evenodd");
      }
      if (rim && light.rim) {
        // The outline nudged away from the light leaves a sliver inside the lit edge.
        ctx.translate(-light.dir.x * light.rim.width, -light.dir.y * light.rim.width);
        ctx.globalAlpha *= light.rim.alpha;
        ctx.strokeStyle = light.rim.color;
        ctx.lineWidth = light.rim.width * 2;
        ctx.stroke(path);
      }
      ctx.restore();
    }
    if (ink && light.ink > 0) {
      ctx.strokeStyle = style.inkColor ?? t.ink;
      ctx.lineWidth = light.ink * (style.inkScale ?? 1);
      ctx.lineJoin = "round";
      ctx.stroke(path);
    }
    if (alpha !== 1) ctx.globalAlpha /= alpha;
  }

  /** A flat fill with no shading or ink: highlights, glints, shadows on the floor. */
  flat(path: Path2D, fill: string | CanvasGradient, alpha = 1) {
    const { ctx } = this;
    const before = ctx.globalAlpha;
    ctx.globalAlpha = before * alpha;
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.globalAlpha = before;
  }

  line(path: Path2D, color: string, width: number, alpha = 1, cap: CanvasLineCap = "round") {
    const { ctx } = this;
    const before = ctx.globalAlpha;
    ctx.globalAlpha = before * alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = cap;
    ctx.lineJoin = "round";
    ctx.stroke(path);
    ctx.globalAlpha = before;
  }

  /** A soft round shadow on the floor under a performer or a prop. */
  contactShadow(cx: number, cy: number, rx: number, ry: number, color: string, alpha: number) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
}

/** A deterministic random stream, for scenery and casting that must look the same every visit. */
export function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
