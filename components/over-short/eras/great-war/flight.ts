import { css, mix } from "../../scene/color";
import { clamp } from "../../scene/noise";
import { dab, type Ctx } from "../../scene/paint";
import type { Appearance } from "../../scene/side";

/*
 * What flies: the shell itself, the smoke it trails, and the star shells
 * hanging under their parachutes at night. Drawn in screen pixels by the
 * views, which work out where things are.
 */

export type TrailPoint = { x: number; y: number };

/**
 * A shell's trail: a thin hard line just behind it, loosening into a wide,
 * fading ribbon of smoke farther back. At night the newest part glows like a
 * tracer.
 */
export function drawTrail(ctx: Ctx, points: TrailPoint[], appearance: Appearance, width: number) {
  if (points.length < 2) return;
  const night = appearance === "night";
  const n = points.length;
  // The old smoke: soft dabs, wider and fainter the older they are, but never quite gone, so the arc reads.
  for (let i = 0; i < n; i += 2) {
    const age = 1 - i / (n - 1);
    const [x, y] = [points[i].x, points[i].y];
    const r = width * (1.5 + age * 5);
    const color = night ? mix([150, 150, 162], [70, 72, 86], age) : mix([250, 247, 240], [196, 192, 184], age);
    dab(ctx, x, y, r, color, (night ? 0.3 : 0.42) * (1 - age * 0.55), 1);
  }
  // A faint thread along the whole path.
  ctx.save();
  ctx.strokeStyle = night ? "rgb(200 190 180 / 0.22)" : "rgb(255 252 244 / 0.4)";
  ctx.lineWidth = Math.max(1, width * 0.45);
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();
  // The fresh line.
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const recent = Math.max(2, Math.floor(n * 0.35));
  for (let i = n - recent; i < n - 1; i++) {
    const t = (i - (n - recent)) / recent;
    ctx.strokeStyle = night ? css(mix([255, 120, 50], [255, 230, 170], t), 0.15 + t * 0.75) : css(mix([200, 194, 182], [250, 248, 240], t), 0.2 + t * 0.7);
    ctx.lineWidth = width * (0.5 + t * 0.6);
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }
  ctx.restore();
}

/** The shell: a dark ogive nosing along its path, with a glint along its back and a blur behind. */
export function drawShell(ctx: Ctx, x: number, y: number, angle: number, length: number, appearance: Appearance) {
  const night = appearance === "night";
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Speed blur.
  const blur = ctx.createLinearGradient(-length * 3, 0, 0, 0);
  blur.addColorStop(0, night ? "rgb(255 150 70 / 0)" : "rgb(60 56 50 / 0)");
  blur.addColorStop(1, night ? "rgb(255 190 110 / 0.55)" : "rgb(60 56 50 / 0.35)");
  ctx.fillStyle = blur;
  ctx.fillRect(-length * 3, -length * 0.14, length * 3, length * 0.28);
  // Body and nose.
  ctx.fillStyle = night ? "#2b2a2c" : "#3a3631";
  ctx.beginPath();
  ctx.moveTo(-length * 0.5, -length * 0.17);
  ctx.lineTo(length * 0.15, -length * 0.17);
  ctx.quadraticCurveTo(length * 0.5, -length * 0.15, length * 0.55, 0);
  ctx.quadraticCurveTo(length * 0.5, length * 0.15, length * 0.15, length * 0.17);
  ctx.lineTo(-length * 0.5, length * 0.17);
  ctx.closePath();
  ctx.fill();
  // The copper driving band and a glint along the top.
  ctx.fillStyle = night ? "#a0603a" : "#9c6a40";
  ctx.fillRect(-length * 0.38, -length * 0.17, length * 0.07, length * 0.34);
  ctx.strokeStyle = night ? "rgb(255 210 160 / 0.6)" : "rgb(255 250 240 / 0.7)";
  ctx.lineWidth = Math.max(0.8, length * 0.05);
  ctx.beginPath();
  ctx.moveTo(-length * 0.45, -length * 0.11);
  ctx.lineTo(length * 0.2, -length * 0.11);
  ctx.stroke();
  if (night) dab(ctx, -length * 0.55, 0, length * 0.5, [255, 170, 90], 0.6);
  ctx.restore();
}

/**
 * A star shell: a white-hot point under a small parachute, the smoke it
 * gives off rising above it, lit from below.
 */
export function drawFlare(ctx: Ctx, x: number, y: number, size: number, intensity: number, smokeRise: number) {
  if (intensity <= 0.01) return;
  // Its smoke streams upwards and drifts back with the wind.
  for (let k = 1; k < 14; k++) {
    const t = k / 14;
    dab(ctx, x - t * size * 2.2, y - size * 1.4 - t * smokeRise, size * (0.5 + t * 1.6), mix([220, 222, 230], [70, 74, 86], t), 0.22 * (1 - t) * intensity, 1);
  }
  // The parachute: a small dark dome with its shrouds.
  ctx.save();
  ctx.fillStyle = "rgb(36 38 46 / 0.85)";
  ctx.beginPath();
  ctx.ellipse(x, y - size * 2.4, size * 1.1, size * 0.55, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = "rgb(120 124 140 / 0.5)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - size * 1.1, y - size * 2.4);
  ctx.lineTo(x, y - size * 0.3);
  ctx.lineTo(x + size * 1.1, y - size * 2.4);
  ctx.stroke();
  ctx.restore();
  // The burning heart.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 5);
  glow.addColorStop(0, `rgb(255 255 250 / ${clamp(intensity)})`);
  glow.addColorStop(0.18, `rgb(240 244 255 / ${0.65 * intensity})`);
  glow.addColorStop(1, "rgb(200 210 255 / 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);
  ctx.restore();
}
