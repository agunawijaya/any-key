import { css, jitter, type Rgb } from "./color";
import { fbm2, hash2 } from "./noise";

/*
 * Painting helpers shared by every era: offscreen canvases, a canvas grain
 * laid over painted layers, soft brush strokes and dabs. Everything is made
 * at runtime from code; nothing is loaded.
 */

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

export const context = (canvas: HTMLCanvasElement) => canvas.getContext("2d")!;

const grains = new Map<string, HTMLCanvasElement>();

/**
 * A tile of canvas weave and pigment grain, grey around 128. Laid over a
 * painted layer with "overlay" it gives the paint a surface; with "multiply"
 * it darkens it unevenly.
 */
export function grainTile(seed = 1, size = 256) {
  const key = `${seed}/${size}`;
  const known = grains.get(key);
  if (known) return known;
  const canvas = makeCanvas(size, size);
  const ctx = context(canvas);
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Weave (fine crossing threads), blotches (pigment pooling) and speckle; periodic so the tile repeats cleanly.
      const weave = Math.sin((x / size) * Math.PI * 2 * 64) * Math.sin((y / size) * Math.PI * 2 * 64) * 6;
      const blotch = periodicFbm(x / size, y / size, seed) * 26;
      const speck = (hash2(x, y, seed) - 0.5) * 22;
      const v = 128 + weave + blotch + speck;
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  grains.set(key, canvas);
  return canvas;
}

/** Fractal noise on a torus, so a square tile wraps without a seam. */
function periodicFbm(u: number, v: number, seed: number) {
  const a = u * Math.PI * 2;
  const b = v * Math.PI * 2;
  const r = 1.4;
  return fbm2(Math.cos(a) * r + Math.sin(b) * r * 0.6 + 7, Math.sin(a) * r + Math.cos(b) * r * 0.6 + 3, seed, 4);
}

let grainScratch: HTMLCanvasElement | null = null;

/**
 * Lays the grain over whatever is already painted in the rectangle. Only
 * painted pixels take it: the grain is first cut to the painting's own
 * shape, so empty sky between trees stays empty.
 */
export function applyGrain(ctx: Ctx, x: number, y: number, w: number, h: number, strength = 0.5, seed = 1, scale = 1) {
  const canvas = ctx.canvas;
  if (!grainScratch || grainScratch.width < canvas.width || grainScratch.height < canvas.height) grainScratch = makeCanvas(Math.max(canvas.width, grainScratch?.width ?? 0), Math.max(canvas.height, grainScratch?.height ?? 0));
  const s = context(grainScratch);
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "source-over";
  s.globalAlpha = 1;
  s.clearRect(0, 0, grainScratch.width, grainScratch.height);
  s.setTransform(ctx.getTransform());
  const pattern = s.createPattern(grainTile(seed), "repeat")!;
  pattern.setTransform(new DOMMatrix().scale(scale));
  s.fillStyle = pattern;
  s.fillRect(x, y, w, h);
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = "destination-in";
  s.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = strength;
  ctx.drawImage(grainScratch, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/** A soft round dab of colour fading to nothing at its edge. */
export function dab(ctx: Ctx, x: number, y: number, radius: number, color: Rgb, alpha: number, squash = 1) {
  if (radius <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, css(color, alpha));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * One brush stroke along a polyline: a few overlapping, slightly offset
 * passes of varying width and opacity, the way a loaded brush leaves streaks.
 */
export function brushStroke(ctx: Ctx, points: [number, number][], width: number, color: Rgb, alpha: number, random: () => number, passes = 3) {
  if (points.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let p = 0; p < passes; p++) {
    const ox = (random() - 0.5) * width * 0.5;
    const oy = (random() - 0.5) * width * 0.5;
    ctx.strokeStyle = css(jitter(color, 0.06, random), alpha * (0.45 + random() * 0.4));
    ctx.lineWidth = width * (0.45 + random() * 0.6);
    ctx.beginPath();
    ctx.moveTo(points[0][0] + ox, points[0][1] + oy);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0] + ox, points[i][1] + oy);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Short strokes scattered over an area, mostly following `angle`: the
 * broken colour of grass, mud or plaster seen from a distance.
 */
export function scumble(
  ctx: Ctx,
  area: { x: number; y: number; w: number; h: number },
  colors: Rgb[],
  random: () => number,
  options: { count: number; length: number; width: number; alpha: number; angle?: number; spread?: number; inside?: (x: number, y: number) => boolean },
) {
  const { count, length, width, alpha, angle = 0, spread = 0.35, inside } = options;
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const x = area.x + random() * area.w;
    const y = area.y + random() * area.h;
    if (inside && !inside(x, y)) continue;
    const a = angle + (random() - 0.5) * spread * Math.PI;
    const l = length * (0.5 + random());
    const color = colors[Math.floor(random() * colors.length)];
    ctx.strokeStyle = css(jitter(color, 0.08, random), alpha * (0.4 + random() * 0.6));
    ctx.lineWidth = width * (0.5 + random() * 0.8);
    ctx.beginPath();
    ctx.moveTo(x - (Math.cos(a) * l) / 2, y - (Math.sin(a) * l) / 2);
    ctx.lineTo(x + (Math.cos(a) * l) / 2, y + (Math.sin(a) * l) / 2);
    ctx.stroke();
  }
  ctx.restore();
}
