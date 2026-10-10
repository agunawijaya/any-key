/*
 * The Storybook's brushes: seeded noise for anything hand-made, colour mixing,
 * smooth paths through points, and the paper the whole picture is printed on.
 */

export type Pt = { x: number; y: number };

/* ---------- Noise ---------- */

/** A repeatable pseudo-random number in [0, 1) for an integer pair and a seed. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise in [0, 1). */
export function noise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Layered noise in [0, 1): broad shapes with finer detail on top. */
export function fbm2(x: number, y: number, seed = 0, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x, y, seed + i * 31) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

/** A tiny seeded generator for scattering props. */
export function scatter(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Colour ---------- */

type Rgb = [number, number, number];
const parsed = new Map<string, Rgb>();

function rgbOf(hex: string): Rgb {
  let rgb = parsed.get(hex);
  if (!rgb) {
    const n = parseInt(hex.slice(1), 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    parsed.set(hex, rgb);
  }
  return rgb;
}

/** `a` blended towards `b` by t, as an rgb() string. */
export function mix(a: string, b: string, t: number): string {
  const x = rgbOf(a);
  const y = rgbOf(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * k)} ${Math.round(x[1] + (y[1] - x[1]) * k)} ${Math.round(x[2] + (y[2] - x[2]) * k)})`;
}

/** A hex colour with an opacity. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgb(${r} ${g} ${b} / ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/* ---------- Paths ---------- */

/** A closed curve through the points (Catmull-Rom turned into Béziers). */
export function smoothClosed(ctx: CanvasRenderingContext2D | Path2D, pts: Pt[], tension = 0.5) {
  const n = pts.length;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const k = tension / 3;
    ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k, p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k, p2.x, p2.y);
  }
  ctx.closePath();
}

/** An open curve through the points. */
export function smoothOpen(ctx: CanvasRenderingContext2D | Path2D, pts: Pt[], tension = 0.5) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const k = tension / 3;
    ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * k, p1.y + (p2.y - p0.y) * k, p2.x - (p3.x - p1.x) * k, p2.y - (p3.y - p1.y) * k, p2.x, p2.y);
  }
}

/** A brush stroke that swells in the middle and tapers to points, along a curve. */
export function taperedStroke(ctx: CanvasRenderingContext2D, pts: Pt[], width: number, startTaper = 1, endTaper = 1) {
  if (pts.length < 2) return;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const w = (width / 2) * profile(i / (pts.length - 1), startTaper, endTaper);
    left.push({ x: pts[i].x - (dy / len) * w, y: pts[i].y + (dx / len) * w });
    right.push({ x: pts[i].x + (dy / len) * w, y: pts[i].y - (dx / len) * w });
  }
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
}

/** Width along a stroke: full in the middle, thinning towards the tapered ends. */
function profile(t: number, startTaper: number, endTaper: number) {
  const head = startTaper > 0 ? Math.min(1, t / (0.35 * startTaper)) : 1;
  const tail = endTaper > 0 ? Math.min(1, (1 - t) / (0.5 * endTaper)) : 1;
  return Math.max(0.08, Math.sqrt(head) * Math.sqrt(tail));
}

/* ---------- Paper ---------- */

/**
 * A tile of printing paper: fine grain, a few fibres and soft blotches,
 * drawn once and repeated over the whole picture.
 */
export function paperTile(size: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tileable blotches: noise sampled on a torus of period `size / 64`.
      const period = size / 64;
      const u = (x / size) * period;
      const v = (y / size) * period;
      const blotch = tileNoise(u, v, period, seed);
      const grain = hash2(x, y, seed + 7);
      const value = 200 + blotch * 40 + (grain - 0.5) * 46;
      const i = (y * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  // Fibres: faint hairlines, wrapped at the edges so the tile stays seamless.
  const rand = scatter(seed + 99);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < size / 6; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const angle = rand() * Math.PI;
    const len = 4 + rand() * 14;
    ctx.strokeStyle = rand() < 0.5 ? "rgb(255 255 255 / 0.35)" : "rgb(120 120 120 / 0.18)";
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(x + ox + Math.cos(angle + 0.4) * len * 0.5, y + oy + Math.sin(angle + 0.4) * len * 0.5, x + ox + Math.cos(angle) * len, y + oy + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
  }
  return canvas;
}

function tileNoise(u: number, v: number, period: number, seed: number) {
  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = smooth(u - ix);
  const fy = smooth(v - iy);
  const at = (x: number, y: number) => hash2(((x % period) + period) % period, ((y % period) + period) % period, seed);
  const a = at(ix, iy);
  const b = at(ix + 1, iy);
  const c = at(ix, iy + 1);
  const d = at(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
