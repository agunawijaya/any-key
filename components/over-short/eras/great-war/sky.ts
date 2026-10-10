import { createRng } from "@/lib/kit/rng";
import { css, mix, type Rgb } from "../../scene/color";
import { fbm1, hash1, smoothstep } from "../../scene/noise";
import { applyGrain, dab, type Ctx } from "../../scene/paint";
import { puff, PUFF_VARIANTS } from "../../scene/particles";
import type { Appearance, SideFrameInfo } from "../../scene/side";
import { biplane } from "./biplane";
import { paletteFor } from "./palette";

/*
 * The sky over the Western Front. By day a pale, heavy overcast with a
 * brighter break where the sun is trying to come through, light falling in
 * shafts, and smoke from distant fires leaning with the wind. By night a
 * blue-black sky, clouds barely there, a few stars in the gaps and the glow
 * of fires and guns along the horizon.
 */

const HORIZON = 0.6;

export function paintSky(ctx: Ctx, width: number, height: number, appearance: Appearance, horizonShare = HORIZON) {
  const pal = paletteFor(appearance);
  const night = appearance === "night";
  const r = createRng(`great-war/sky/${appearance}`).float;
  const horizon = height * horizonShare;
  // Cloud banks keep their places relative to the horizon, wherever it is.
  const k = horizonShare / HORIZON;

  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, css(pal.skyTop));
  g.addColorStop(0.55, css(pal.skyMid));
  g.addColorStop(1, css(pal.skyLow));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // The break in the cloud: where the light comes from.
  const breakX = width * 0.3;
  const breakY = horizon * 0.33;
  if (!night) {
    dab(ctx, breakX, breakY, width * 0.5, mix(pal.cloudLight, [255, 250, 236], 0.4), 0.5, 0.45);
    dab(ctx, breakX, breakY + height * 0.02, width * 0.2, [255, 252, 242], 0.35, 0.5);
  } else {
    starField(ctx, width, horizon * 0.8, r);
  }

  // Three banks of cloud, the farthest lowest, smallest and haziest.
  const banks = [
    { y: 0.1, thickness: 0.16, size: 0.075, density: 0.62 },
    { y: 0.28, thickness: 0.11, size: 0.055, density: 0.55 },
    { y: 0.45, thickness: 0.07, size: 0.038, density: 0.5 },
  ];
  banks.forEach((bank, i) => cloudBank(ctx, width, height, { ...bank, y: bank.y * k, thickness: bank.thickness * k }, pal, night, r, i, breakX));

  if (!night) lightShafts(ctx, width, height, breakX, breakY, r);
  horizonSmoke(ctx, width, height, horizon, pal, night, r);

  if (night) {
    // Fires and guns along the horizon: a low warm glow.
    const glow = ctx.createLinearGradient(0, horizon - height * 0.12, 0, horizon + height * 0.02);
    glow.addColorStop(0, "rgb(255 120 60 / 0)");
    glow.addColorStop(0.8, "rgb(255 120 60 / 0.10)");
    glow.addColorStop(1, "rgb(255 140 70 / 0.16)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - height * 0.12, width, height * 0.14);
  } else {
    // Haze thickening towards the horizon.
    const haze = ctx.createLinearGradient(0, horizon - height * 0.2, 0, horizon);
    haze.addColorStop(0, css(pal.haze, 0));
    haze.addColorStop(1, css(pal.haze, 0.55));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - height * 0.2, width, height * 0.25);
  }
  applyGrain(ctx, 0, 0, width, height, night ? 0.22 : 0.3, 3);
}

type Bank = { y: number; thickness: number; size: number; density: number };

/** One billow of cloud: the puff sprite stretched and laid at a given strength. */
function billow(ctx: Ctx, x: number, y: number, w: number, h: number, color: Rgb, alpha: number, variant: number) {
  if (alpha <= 0.005) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(puff(variant % PUFF_VARIANTS, color), x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = 1;
}

/**
 * A bank of stratocumulus: each mass is a shadowed belly, a body and lit
 * tops, the tops brighter on the side nearer the break in the overcast.
 */
function cloudBank(ctx: Ctx, width: number, height: number, bank: Bank, pal: ReturnType<typeof paletteFor>, night: boolean, r: () => number, index: number, breakX: number) {
  const step = width * bank.size * 0.55;
  let v = index * 3;
  for (let x = -width * 0.15; x < width * 1.15; x += step * (0.5 + r() * 0.7)) {
    const n = fbm1(x / (width * 0.3) + index * 13.1, 40 + index, 4);
    const mass = smoothstep(-0.25, 0.45, n) * bank.density;
    if (mass < 0.06) continue;
    const y = height * (bank.y + bank.thickness * (0.5 - n * 0.4));
    const size = width * bank.size * (0.7 + mass * 1.4);
    const lit = Math.pow(1 - Math.min(1, Math.abs(x - breakX) / (width * 0.9)), 1.5);
    const belly: Rgb = night ? pal.cloudShadow : mix(pal.cloudShadow, pal.cloudMid, 0.25);
    const body: Rgb = mix(pal.cloudMid, pal.cloudShadow, night ? 0.2 : 0.1);
    const top: Rgb = mix(pal.cloudMid, pal.cloudLight, 0.45 + lit * 0.55);
    billow(ctx, x + size * 0.05, y + size * 0.16, size * 2.1, size * 0.75, belly, (night ? 0.5 : 0.55) * mass, v++);
    billow(ctx, x, y, size * 1.7, size * 0.8, body, (night ? 0.45 : 0.6) * mass, v++);
    for (let k = 0; k < 2; k++) {
      billow(ctx, x - size * (0.25 - k * 0.45) + (r() - 0.5) * size * 0.3, y - size * (0.14 + r() * 0.1), size * (0.9 + r() * 0.4), size * 0.5, top, (night ? 0.28 : 0.55) * mass * (0.6 + lit * 0.6), v++);
    }
    brushwork(ctx, x, y, size, top, belly, mass * (night ? 0.5 : 1), r);
  }
}

/** Visible strokes on a cloud: pale ones dragged along its lit top, darker ones under its belly. */
function brushwork(ctx: Ctx, x: number, y: number, size: number, top: Rgb, belly: Rgb, strength: number, r: () => number) {
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const lit = i < 6;
    const sx = x + (r() - 0.5) * size * 1.4;
    const sy = y + (lit ? -size * (0.08 + r() * 0.16) : size * (0.12 + r() * 0.12));
    const len = size * (0.25 + r() * 0.45);
    ctx.strokeStyle = css(lit ? mix(top, [255, 252, 244], 0.3) : belly, (lit ? 0.16 : 0.12) * strength);
    ctx.lineWidth = size * (0.03 + r() * 0.05);
    ctx.beginPath();
    ctx.moveTo(sx - len / 2, sy);
    ctx.quadraticCurveTo(sx, sy - size * 0.03 * (lit ? 1 : -1), sx + len / 2, sy + (r() - 0.5) * size * 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

/** A few long, faint shafts of light falling from behind the break in the cloud. */
function lightShafts(ctx: Ctx, width: number, height: number, x: number, y: number, r: () => number) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 2 + 0.18 + (r() - 0.3) * 0.7;
    const spread = 0.04 + r() * 0.05;
    const len = height * (0.75 + r() * 0.3);
    const ox = x + (r() - 0.5) * width * 0.08;
    const oy = y + height * 0.06;
    const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(angle) * len, oy + Math.sin(angle) * len);
    g.addColorStop(0, "rgb(255 248 228 / 0)");
    g.addColorStop(0.25, "rgb(255 248 228 / 0.07)");
    g.addColorStop(1, "rgb(255 248 228 / 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(angle - spread) * len, oy + Math.sin(angle - spread) * len);
    ctx.lineTo(ox + Math.cos(angle + spread) * len, oy + Math.sin(angle + spread) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Smoke from fires beyond the horizon: a few billowing columns leaning away with the wind. */
function horizonSmoke(ctx: Ctx, width: number, height: number, horizon: number, pal: ReturnType<typeof paletteFor>, night: boolean, r: () => number) {
  const columns = [0.16, 0.63, 0.88];
  columns.forEach((at, c) => {
    let x = width * (at + (r() - 0.5) * 0.04);
    let y = horizon;
    let size = height * 0.018;
    const color: Rgb = night ? [24, 25, 31] : mix(pal.cloudShadow, [104, 98, 90], 0.5);
    const tall = 9 + Math.floor(r() * 6);
    for (let k = 0; k < tall; k++) {
      billow(ctx, x, y, size * 2.2, size * 1.6, color, (night ? 0.5 : 0.32) * (1 - k / (tall + 4)), c * 7 + k);
      y -= size * 0.7;
      x += size * 0.35 + k * 1.2;
      size *= 1.12;
    }
  });
}

function starField(ctx: Ctx, width: number, height: number, r: () => number) {
  for (let i = 0; i < 150; i++) {
    const x = r() * width;
    // Thinning towards the horizon, where the smoke and haze hide them.
    const y = r() * r() * height;
    const a = 0.25 + r() * 0.6;
    ctx.fillStyle = `rgb(220 228 255 / ${a})`;
    ctx.fillRect(x, y, r() < 0.1 ? 2 : 1, 1);
  }
}

/* ---------- What moves in the sky ---------- */

/**
 * Per frame: guns flickering beyond the horizon at night, an observation
 * balloon swaying on its cable and a biplane crossing far off.
 */
export function skyOverlay(ctx: Ctx, view: SideFrameInfo) {
  const { width, height, time } = view;
  const night = view.appearance === "night";
  const horizon = height * HORIZON;
  if (night) gunFlashes(ctx, width, horizon, height, time);
  balloon(ctx, width * 0.86 - ((view.cameraX * 0.05 * view.scale) % (width * 2)), height * 0.4 + Math.sin(time * 0.4) * 3, height * 0.02, night, time, horizon);
  biplane(ctx, width + 120 - ((time * 26) % (width + 240)), height * 0.2 + Math.sin(time * 0.9) * 4, height * 0.0085, night, paletteFor(view.appearance).skyMid, time);
}

function gunFlashes(ctx: Ctx, width: number, horizon: number, height: number, time: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 9; k++) {
    // Each battery fires on its own rhythm; a flash lasts a fraction of a second.
    const period = 2.2 + hash1(k, 5) * 3.5;
    const phase = (time + hash1(k, 9) * period) % period;
    const strength = phase < 0.25 ? 1 - phase / 0.25 : 0;
    if (strength <= 0) continue;
    const x = width * (0.05 + hash1(k, 2) * 0.9);
    const r = height * (0.05 + hash1(k, 3) * 0.06);
    const g = ctx.createRadialGradient(x, horizon, 0, x, horizon, r);
    g.addColorStop(0, `rgb(255 200 140 / ${0.45 * strength})`);
    g.addColorStop(1, "rgb(255 120 60 / 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, horizon - r, r * 2, r * 2);
  }
  ctx.restore();
}

/**
 * An observation balloon far off: a fat teardrop with three lobed fins at
 * the tail, a basket below and its cable running down to the horizon.
 */
function balloon(ctx: Ctx, x: number, y: number, size: number, night: boolean, time: number, horizon: number) {
  const body = night ? "#1b202a" : "#8f8d82";
  const shadow = night ? "#12151c" : "#6e6c63";
  const tilt = 0.1 + Math.sin(time * 0.4) * 0.03;
  ctx.save();
  ctx.strokeStyle = night ? "rgb(40 46 60 / 0.5)" : "rgb(80 80 74 / 0.4)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.1, y + size * 0.7);
  ctx.quadraticCurveTo(x - size * 0.5, (y + horizon) / 2, x - size * 0.9, horizon);
  ctx.stroke();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // The body: rounder at the nose (left), tapering to the tail.
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(-size * 1.1, 0);
    ctx.bezierCurveTo(-size * 1.1, -size * 0.55, -size * 0.2, -size * 0.52, size * 0.6, -size * 0.3);
    ctx.quadraticCurveTo(size * 1.0, -size * 0.18, size * 1.0, 0);
    ctx.quadraticCurveTo(size * 1.0, size * 0.18, size * 0.6, size * 0.3);
    ctx.bezierCurveTo(-size * 0.2, size * 0.52, -size * 1.1, size * 0.55, -size * 1.1, 0);
    ctx.closePath();
  };
  ctx.fillStyle = body;
  outline();
  ctx.fill();
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(-size * 0.1, size * 0.2, size * 0.95, size * 0.22, 0, 0, Math.PI);
  ctx.fill();
  // Three fins: one up, one down, one towards us.
  for (const [fx, fy, rot] of [
    [0.85, -0.32, -0.5],
    [0.85, 0.32, 0.5],
    [0.95, 0.02, 0],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(size * fx, size * fy, size * 0.26, size * 0.12, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(-size * 0.2, size * 0.62, size * 0.14, size * 0.12);
  ctx.restore();
}
