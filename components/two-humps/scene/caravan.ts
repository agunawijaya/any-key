import { hash1 } from "@/lib/two-humps/noise";
import { camelPaint, drawCamel, type CamelPaint } from "./camel";
import { drawCampfire, drawFirelight, flickerAt } from "./camp";
import { css, lerp3, litColour, type Light, type RGB } from "./light";

/*
 * The rival: Captain Bluster's caravan, three camels in a line under a
 * pennant with a brass bell on it. By day it plods along kicking up a plume
 * of dust (a tall one when the Captain threatens a gallop, which is often
 * bluster); by night it camps round a fire and snores.
 */

export type CaravanPose = {
  /** Where the lead camel stands, and how big a camel is here. */
  x: number;
  groundY: number;
  size: number;
  moving: boolean;
  /** A tall plume: the Captain is threatening to gallop. */
  plume: boolean;
  camped: boolean;
  /** −1 faces left, 1 right. */
  facing: number;
  time: number;
};

const RIVAL_COAT: RGB = [120, 82, 58];

function rivalPaint(light: Light): CamelPaint {
  const base = camelPaint(light, light.sunX >= 0.5 ? 1 : -1);
  const lit = (albedo: RGB, facing: number) => css(litColour(light, albedo, facing));
  return {
    ...base,
    coat: lit(RIVAL_COAT, 0.35),
    coatShade: lit(RIVAL_COAT, -0.3),
    legs: lit(lerp3(RIVAL_COAT, [160, 120, 90], 0.3), 0.25),
    deel: lit([150, 40, 120], 0.45),
    deelShade: lit([100, 26, 84], -0.1),
    sash: lit([255, 206, 70], 0.6),
    blanket: lit([40, 120, 120], 0.4),
    hat: lit([30, 30, 40], 0.4),
  };
}

export function drawCaravan(ctx: CanvasRenderingContext2D, light: Light, pose: CaravanPose) {
  const paint = rivalPaint(light);
  const { x, groundY, size, facing, time } = pose;

  if (pose.camped) {
    // A tent, a fire and three camels couched for the night.
    const flicker = flickerAt(time + 11);
    drawFirelight(ctx, x + size * 0.9 * facing, groundY, size * 3.2, flicker);
    drawTent(ctx, x - size * 0.6 * facing, groundY, size, light);
    for (let i = 0; i < 2; i++) {
      drawCamel(ctx, x - size * (2 + i * 1.7) * facing, groundY, size * 0.9, { gait: "rest", phase: 0, headLow: 0, hump: 1, wind: 0, time: time + i, rider: false }, paint, facing);
    }
    drawCampfire(ctx, x + size * 0.9 * facing, groundY, size * 0.35, time + 11);
    return;
  }

  if (pose.moving) drawPlume(ctx, x - size * 2.2 * facing, groundY, size, light, pose.plume, time);
  const stride = time * 0.9;
  for (let i = 2; i >= 0; i--) {
    const cx = x - size * i * 1.85 * facing;
    drawCamel(ctx, cx, groundY, size * (1 - i * 0.04), { gait: "walk", phase: (stride + i * 0.31) % 1, headLow: 0.1, hump: 1, wind: 0.1, time: time + i, rider: i === 0 }, paint, facing);
    if (i > 0) drawPacks(ctx, cx, groundY, size, facing, paint);
  }
  drawPennant(ctx, x - size * 0.05 * facing, groundY - size * 2.15, size, facing, time);
}

function drawPlume(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, light: Light, tall: boolean, time: number) {
  const dust = lerp3([214, 170, 120], light.haze, 0.3);
  const strength = tall ? 0.46 : 0.28;
  // Soft puffs kicked up at the feet, drifting back and rising as they thin out.
  for (let i = 0; i < 16; i++) {
    const age = (time * 0.45 + i / 16) % 1;
    const r = size * (0.35 + age * (tall ? 2.2 : 1.2)) * (0.8 + 0.4 * hash1(i, 611));
    const px = x - age * size * (2.6 + hash1(i, 610) - 0.5);
    const py = groundY - size * 0.25 - age * size * (tall ? 2.6 : 0.9) - r * 0.3;
    const alpha = strength * (1 - age) * Math.min(1, age / 0.12);
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, css(dust, alpha));
    g.addColorStop(0.6, css(dust, alpha * 0.5));
    g.addColorStop(1, css(dust, 0));
    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

function drawPacks(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, facing: number, paint: CamelPaint) {
  // A bundle roped on between the humps, and a saddlebag hanging down the near side.
  const top = groundY - size * 1.78;
  ctx.fillStyle = paint.blanket;
  ctx.beginPath();
  ctx.roundRect(x - size * 0.26, top, size * 0.52, size * 0.2, size * 0.07);
  ctx.fill();
  ctx.fillStyle = paint.sash;
  for (const band of [-0.12, 0.1]) ctx.fillRect(x + size * band * facing - size * 0.018, top, size * 0.036, size * 0.2);
  ctx.fillStyle = paint.deelShade;
  ctx.beginPath();
  ctx.roundRect(x - size * 0.06 * facing - size * 0.11, top + size * 0.16, size * 0.22, size * 0.26, size * 0.06);
  ctx.fill();
}

/** The Captain's pennant, with a brass bell on it, snapping in the wind. */
function drawPennant(ctx: CanvasRenderingContext2D, x: number, topY: number, size: number, facing: number, time: number) {
  ctx.strokeStyle = "rgb(60 40 30)";
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.beginPath();
  ctx.moveTo(x, topY + size * 0.9);
  ctx.lineTo(x, topY);
  ctx.stroke();
  const wave = Math.sin(time * 5) * size * 0.06;
  ctx.fillStyle = "rgb(214 52 60)";
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.quadraticCurveTo(x - facing * size * 0.4, topY + size * 0.12 + wave, x - facing * size * 0.85, topY + size * 0.2 + wave);
  ctx.lineTo(x, topY + size * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgb(250 204 80)";
  ctx.beginPath();
  ctx.arc(x - facing * size * 0.28, topY + size * 0.2 + wave * 0.5, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawTent(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number, light: Light) {
  const canvas = css(litColour(light, [210, 196, 170], 0.3, [0.3, 0.18, 0.08]));
  const shade = css(litColour(light, [150, 130, 110], -0.2, [0.15, 0.08, 0.04]));
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.8, groundY);
  ctx.lineTo(x, groundY - size * 0.9);
  ctx.lineTo(x + size * 0.8, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = canvas;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.8, groundY);
  ctx.lineTo(x, groundY - size * 0.9);
  ctx.lineTo(x + size * 0.15, groundY);
  ctx.closePath();
  ctx.fill();
}
