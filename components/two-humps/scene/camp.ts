import { hash1, noise1 } from "@/lib/two-humps/noise";
import { css, lerp3, type RGB } from "./light";
import { bandPath, smoothPath } from "./shapes";
import type { CamelPaint } from "./camel";

/*
 * A night's camp: the fire, the light it throws, and the traveller beside it.
 * Firelight is warm and falls off fast; it lights the near side of everything
 * and leaves the dark beyond it to whatever is watching.
 */

export const FIRE: RGB = [255, 168, 80];

/** How much firelight reaches a point, 0–1, from a fire at (fx, fy) with reach `radius`. */
export function firelightAt(x: number, y: number, fx: number, fy: number, radius: number, flicker: number) {
  const d = Math.hypot(x - fx, (y - fy) * 1.6) / radius;
  return Math.max(0, 1 - d) ** 1.6 * flicker;
}

/** The fire's brightness at a moment: a steady glow with quick, uneven flickers. */
export function flickerAt(time: number) {
  return 0.86 + 0.08 * noise1(time * 7, 701) + 0.06 * noise1(time * 19, 702);
}

/** Warm light pooled on the sand round the fire. */
export function drawFirelight(ctx: CanvasRenderingContext2D, fx: number, fy: number, radius: number, flicker: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(fx, fy);
  ctx.scale(1, 0.62);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, css(FIRE, 0.42 * flicker));
  g.addColorStop(0.35, css(FIRE, 0.18 * flicker));
  g.addColorStop(1, css(FIRE, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
  // A softer glow lifts into the air above the flames.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const air = ctx.createRadialGradient(fx, fy - radius * 0.2, 0, fx, fy - radius * 0.2, radius * 0.9);
  air.addColorStop(0, css(FIRE, 0.16 * flicker));
  air.addColorStop(1, css(FIRE, 0));
  ctx.fillStyle = air;
  ctx.fillRect(fx - radius, fy - radius * 1.2, radius * 2, radius * 2);
  ctx.restore();
}

/** Saxaul logs, flames that lick and lean, and sparks climbing into the dark. */
export function drawCampfire(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, time: number) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size, -size);
  ctx.lineCap = "round";

  // A ring of stones and two crossed logs.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI;
    ctx.fillStyle = css(lerp3([70, 56, 60], [200, 120, 70], 0.4 + 0.3 * Math.sin(a)));
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 0.62, 0.05 + Math.sin(a) * 0.04, 0.13, 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgb(74 44 30)";
  ctx.lineWidth = 0.14;
  ctx.beginPath();
  ctx.moveTo(-0.45, 0.06);
  ctx.lineTo(0.4, 0.22);
  ctx.moveTo(0.45, 0.06);
  ctx.lineTo(-0.35, 0.24);
  ctx.stroke();
  ctx.strokeStyle = "rgb(255 120 40 / 0.8)";
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.11);
  ctx.lineTo(0.15, 0.17);
  ctx.stroke();

  // Flames: tongues of light, each swaying on its own noise.
  ctx.globalCompositeOperation = "lighter";
  const tongues = 6;
  for (let i = 0; i < tongues; i++) {
    const base = (i / (tongues - 1) - 0.5) * 0.6;
    const height = 0.9 + 0.7 * noise1(time * 2.6 + i * 3.1, 711) - Math.abs(base) * 0.6;
    const lean = (noise1(time * 1.8 + i * 1.7, 712) - 0.5) * 0.5;
    const width = 0.24 - Math.abs(base) * 0.15;
    const tongue = new Path2D();
    smoothPath(
      tongue,
      [
        [base - width, 0.12],
        [base - width * 0.7 + lean * 0.3, 0.12 + height * 0.45],
        [base + lean, 0.12 + height],
        [base + width * 0.6 + lean * 0.4, 0.12 + height * 0.4],
        [base + width, 0.12],
      ],
      true,
      0.55,
    );
    const g = ctx.createLinearGradient(0, 0.12, 0, 0.12 + height);
    g.addColorStop(0, "rgb(255 236 170 / 0.95)");
    g.addColorStop(0.35, "rgb(255 170 60 / 0.8)");
    g.addColorStop(0.75, "rgb(240 80 30 / 0.5)");
    g.addColorStop(1, "rgb(200 40 20 / 0)");
    ctx.fillStyle = g;
    ctx.fill(tongue);
  }

  // Sparks: each rises, drifts and fades on its own clock.
  for (let i = 0; i < 18; i++) {
    const life = (time * (0.35 + 0.3 * hash1(i, 721)) + hash1(i, 722)) % 1;
    const sx = (hash1(i, 723) - 0.5) * 0.5 + Math.sin(life * 6 + i) * 0.15 + life * 0.3;
    const sy = 0.4 + life * 3.2;
    ctx.fillStyle = `rgb(255 ${180 - life * 80} 90 / ${(1 - life) * 0.9})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.03 * (1 - life * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export type TravellerPose = "warm-hands" | "cheer";

/** The traveller off the camel: seated by the fire, or on their feet cheering. */
export function drawTraveller(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, pose: TravellerPose, paint: CamelPaint, facing: number, time: number) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(size * facing, -size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const sitting = pose === "warm-hands";
  const hipY = sitting ? 0.12 : 0.48;

  // Legs: crossed on the sand, or standing in boots.
  ctx.fillStyle = paint.deelShade;
  if (sitting) {
    ctx.fill(bandPath([[-0.14, 0.1], [0.12, 0.06], [0.26, 0.05]], [0.14, 0.12, 0.1]));
  } else {
    ctx.fill(bandPath([[-0.05, hipY], [-0.07, 0.24], [-0.08, 0.04]], [0.12, 0.1, 0.09]));
    ctx.fill(bandPath([[0.05, hipY], [0.08, 0.24], [0.1, 0.04]], [0.12, 0.1, 0.09]));
  }
  ctx.fillStyle = paint.dark;
  for (const bx of sitting ? [0.3] : [-0.08, 0.12]) {
    ctx.beginPath();
    ctx.ellipse(bx, 0.04, 0.08, 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The deel.
  const deel = new Path2D();
  smoothPath(
    deel,
    sitting
      ? [
          [-0.2, 0.06],
          [-0.15, 0.32],
          [-0.08, 0.5],
          [0.06, 0.5],
          [0.12, 0.3],
          [0.16, 0.08],
        ]
      : [
          [-0.13, 0.3],
          [-0.12, 0.62],
          [-0.07, 0.86],
          [0.07, 0.86],
          [0.12, 0.62],
          [0.15, 0.3],
        ],
    true,
    0.4,
  );
  ctx.fillStyle = paint.deel;
  ctx.fill(deel);
  ctx.fillStyle = paint.sash;
  ctx.fillRect(sitting ? -0.15 : -0.12, sitting ? 0.22 : 0.56, sitting ? 0.29 : 0.26, 0.055);

  // Arms: held out to the fire, or flung up.
  ctx.fillStyle = paint.deelShade;
  const shoulderY = sitting ? 0.44 : 0.8;
  if (sitting) {
    const warm = Math.sin(time * 1.3) * 0.02;
    ctx.fill(bandPath([[0.0, shoulderY], [0.16, shoulderY - 0.1], [0.32, shoulderY - 0.06 + warm]], [0.08, 0.07, 0.06]));
    ctx.fillStyle = paint.skin;
    ctx.beginPath();
    ctx.arc(0.34, shoulderY - 0.06 + warm, 0.035, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const wave = Math.sin(time * 6) * 0.06;
    for (const side of [-1, 1]) {
      ctx.fillStyle = paint.deelShade;
      ctx.fill(bandPath([[side * 0.06, shoulderY], [side * 0.18, shoulderY + 0.16], [side * 0.22 + wave, shoulderY + 0.34]], [0.08, 0.07, 0.06]));
      ctx.fillStyle = paint.skin;
      ctx.beginPath();
      ctx.arc(side * 0.22 + wave, shoulderY + 0.37, 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Head and hat.
  const headY = shoulderY + 0.13;
  ctx.fillStyle = paint.skin;
  ctx.beginPath();
  ctx.arc(0.01, headY, 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = paint.hat;
  ctx.beginPath();
  ctx.moveTo(-0.09, headY + 0.03);
  ctx.quadraticCurveTo(0.0, headY + 0.24, 0.08, headY + 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = paint.blanketTrim;
  ctx.beginPath();
  ctx.ellipse(-0.005, headY + 0.035, 0.11, 0.028, 0, 0, Math.PI * 2);
  ctx.fill();

  // Light from the fire along the near edge.
  ctx.save();
  ctx.clip(deel);
  ctx.translate(-0.03 * facing * paint.rimSide, -0.01);
  ctx.strokeStyle = paint.rim;
  ctx.globalAlpha = 0.7 * paint.rimStrength;
  ctx.lineWidth = 0.05;
  ctx.stroke(deel);
  ctx.restore();
  ctx.restore();
}
