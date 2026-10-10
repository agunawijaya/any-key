/*
 * The Storybook's little effects: cast shadows, cartoon dust, circling stars,
 * motion lines, and the butterflies or fireflies that keep the meadow alive.
 * All of them take screen pixels.
 */

import type { Look } from "./look";
import { alpha, noise2, type Pt } from "./paint";

/**
 * A soft-edged ellipse of colour, without a blur filter: a radial gradient
 * squeezed into the ellipse. `softness` is the share of the radius that fades.
 */
export function softEllipse(ctx: CanvasRenderingContext2D, centre: Pt, rx: number, ry: number, rotation: number, color: string, opacity: number, softness = 0.5) {
  if (rx <= 0 || ry <= 0 || opacity <= 0) return;
  ctx.save();
  ctx.translate(centre.x, centre.y);
  ctx.rotate(rotation);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, alpha(color, opacity));
  g.addColorStop(Math.max(0, 1 - softness), alpha(color, opacity));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * A figure's shadow on the ground: a contact pool under its feet, and the
 * long shadow the sun or moon throws from `foot` towards `tip`, both in
 * pixels. `lift` (0 on the ground, 1 high in the air) softens and fades them.
 */
export function castShadow(ctx: CanvasRenderingContext2D, look: Look, foot: Pt, tip: Pt, width: number, lift = 0) {
  const fade = 1 - Math.min(0.75, lift * 0.75);
  const dx = tip.x - foot.x;
  const dy = tip.y - foot.y;
  const length = Math.hypot(dx, dy);
  const centre = { x: foot.x + dx * 0.5, y: foot.y + dy * 0.5 };
  softEllipse(ctx, centre, Math.max(width * 0.5, length * 0.6), width * 0.32, Math.atan2(dy, dx), look.shadow, (look.night ? 0.5 : 0.32) * fade, 0.55 + lift * 0.3);
  if (lift > 0.6) return;
  softEllipse(ctx, foot, width * 0.52, width * 0.18, 0, look.shadow, (look.night ? 0.6 : 0.42) * (1 - lift / 0.6), 0.45);
}

/**
 * The shadow of something falling: it grows and darkens on the ground where
 * it will land. `closeness` runs from 0 (far above) to 1 (touching down).
 */
export function landingShadow(ctx: CanvasRenderingContext2D, look: Look, at: Pt, width: number, closeness: number) {
  const k = Math.max(0, Math.min(1, closeness));
  const rx = width * (0.3 + k * 0.42);
  softEllipse(ctx, at, rx, rx * 0.45, 0, look.shadow, (look.night ? 0.45 : 0.3) + k * (look.night ? 0.42 : 0.42), 0.6 - k * 0.35);
}

/**
 * A cartoon dust cloud: soft puffs in a ring round `at` that billow out,
 * rise and thin away. `t` runs 0 to 1; `size` is the ring's width in pixels.
 */
export function dustPuff(ctx: CanvasRenderingContext2D, look: Look, at: Pt, size: number, t: number, seed: number) {
  if (t <= 0 || t >= 1) return;
  const grow = 1 - (1 - t) ** 3;
  const fade = (1 - t) ** 1.4;
  const count = 14;
  const puffs = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + noise2(i, seed, 5) * 0.6;
    const out = 0.18 + grow * (0.28 + noise2(i, seed, 7) * 0.12);
    const rise = grow * (0.04 + noise2(i, seed, 9) * 0.16);
    return {
      x: Math.cos(a) * out,
      y: Math.sin(a) * out * 0.4 - rise,
      r: (0.07 + noise2(i, seed, 3) * 0.06) * (0.8 + grow * 0.9),
    };
  }).sort((p, q) => p.y - q.y);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.scale(size, size);
  for (const p of puffs) {
    const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
    g.addColorStop(0, alpha(look.dust.fill, 0.95 * fade));
    g.addColorStop(0.65, alpha(look.dust.fill, 0.8 * fade));
    g.addColorStop(1, alpha(look.dust.shade, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few inked curls, the way a picture book draws a cloud of dust.
  ctx.strokeStyle = alpha(look.ink, 0.5 * fade);
  ctx.lineWidth = 0.012;
  ctx.lineCap = "round";
  for (const p of puffs.filter((_, i) => i % 3 === 0)) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.75, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.restore();
}

/** A five-pointed cartoon star, inked. */
export function star(ctx: CanvasRenderingContext2D, look: Look, at: Pt, size: number, rotation: number) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? size * 0.45 : size;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.fillStyle = look.star;
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = Math.max(1, size * 0.16);
  ctx.stroke();
  ctx.fill();
  ctx.fillStyle = alpha("#ffffff", 0.7);
  ctx.beginPath();
  ctx.ellipse(-size * 0.15, -size * 0.25, size * 0.14, size * 0.08, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Stars circling a dizzy head, on a tilted ring. */
export function circlingStars(ctx: CanvasRenderingContext2D, look: Look, centre: Pt, radius: number, time: number, count = 4) {
  const items = Array.from({ length: count }, (_, i) => {
    const a = time * 2.6 + (i / count) * Math.PI * 2;
    return { a, x: centre.x + Math.cos(a) * radius, y: centre.y + Math.sin(a) * radius * 0.32, depth: Math.sin(a) };
  }).sort((p, q) => p.depth - q.depth);
  for (const s of items) star(ctx, look, s, radius * (0.2 + 0.06 * s.depth), s.a * 0.5);
}

/** Speed lines trailing a leap. */
export function motionLines(ctx: CanvasRenderingContext2D, look: Look, from: Pt, to: Pt, width: number, strength: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const n = { x: -dy / len, y: dx / len };
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = alpha(look.night ? "#d8e2ff" : look.ink, 0.45 * strength);
  for (const [k, offset] of [-0.45, -0.15, 0.2, 0.5].entries()) {
    const shorten = 0.25 + (k % 2) * 0.2;
    ctx.lineWidth = Math.max(1, width * 0.035);
    ctx.beginPath();
    ctx.moveTo(from.x + n.x * offset * width + dx * shorten, from.y + n.y * offset * width + dy * shorten);
    ctx.lineTo(to.x + n.x * offset * width * 0.7 - dx * 0.08, to.y + n.y * offset * width * 0.7 - dy * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

/** Butterflies by day, fireflies by night, wandering over the meadow. */
export function critters(ctx: CanvasRenderingContext2D, look: Look, width: number, height: number, time: number, count: number) {
  for (let i = 0; i < count; i++) {
    const seed = i * 7.31;
    const x = width * (0.04 + 0.92 * noise2(seed, time * 0.05 + i, 61));
    const y = height * (0.06 + 0.88 * noise2(seed + 3, time * 0.045 + i * 2, 67));
    if (look.night) firefly(ctx, look, { x, y }, time + i * 1.7, i);
    else butterfly(ctx, look, { x, y }, time + i, i);
  }
}

function firefly(ctx: CanvasRenderingContext2D, look: Look, at: Pt, time: number, i: number) {
  const pulse = Math.max(0, Math.sin(time * 1.8 + i)) ** 2;
  const color = look.critters[i % look.critters.length];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const r = 16 + pulse * 10;
  const glow = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, r);
  glow.addColorStop(0, alpha(color, 0.55 * pulse + 0.08));
  glow.addColorStop(0.3, alpha(color, 0.18 * pulse + 0.03));
  glow.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(at.x - r, at.y - r, r * 2, r * 2);
  ctx.fillStyle = alpha(color, 0.5 + pulse * 0.5);
  ctx.beginPath();
  ctx.arc(at.x, at.y, 1.6 + pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function butterfly(ctx: CanvasRenderingContext2D, look: Look, at: Pt, time: number, i: number) {
  const flap = Math.abs(Math.sin(time * 11 + i));
  const color = look.critters[i % look.critters.length];
  const size = 9;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(Math.sin(time * 0.7 + i) * 0.5);
  ctx.strokeStyle = alpha(look.ink, 0.85);
  ctx.lineWidth = 1;
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * (0.25 + flap * 0.75), 1);
    ctx.beginPath();
    ctx.ellipse(size * 0.55, -size * 0.35, size * 0.6, size * 0.45, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(size * 0.42, size * 0.3, size * 0.4, size * 0.3, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = look.ink;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.12, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The paper the picture is printed on, and a soft darkening at the page's edges. */
export function paperFinish(ctx: CanvasRenderingContext2D, look: Look, paper: CanvasPattern, width: number, height: number) {
  ctx.save();
  ctx.globalCompositeOperation = look.night ? "soft-light" : "multiply";
  ctx.globalAlpha = look.paper.grain;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  const vignette = ctx.createRadialGradient(width / 2, height * 0.52, Math.min(width, height) * 0.42, width / 2, height * 0.52, Math.hypot(width, height) * 0.62);
  vignette.addColorStop(0, alpha(look.paper.vignette, 0));
  vignette.addColorStop(1, alpha(look.paper.vignette, look.night ? 0.55 : 0.28));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}
