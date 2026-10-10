import { createRng } from "@/lib/kit/rng";
import { css, mix, shade, type Rgb } from "../../scene/color";
import type { FrontCamera, FrontProp } from "../../scene/front";
import { clamp, fbm2, hash2, smoothstep } from "../../scene/noise";
import type { Ctx } from "../../scene/paint";
import type { Appearance, Lighting } from "../../scene/side";
import { church, poplar, shatteredTree } from "./features";
import { paletteFor, type Palette } from "./palette";
import { paintSky } from "./sky";

/*
 * The Western Front from the observation post: cratered mud running out to
 * the horizon, water lying in the holes, a trench line across the middle
 * distance with its belt of wire, shattered trees, and on the skyline a
 * ruined village. Everything is placed in metres (across, away) so a burst
 * lands exactly where the shell came down.
 */

/** The trench running across the view, and the wire in front of it, in metres out. */
export const TRENCH_AWAY = 700;
const WIRE_AWAY = 655;

/* ---------- The ground, point by point ---------- */

const CRATER_CELL = 11;

/** How heavily an area has been shelled: zones of churned ground with quieter ground between. */
const shelling = (across: number, away: number) => 0.18 + 0.55 * smoothstep(-0.3, 0.5, fbm2(across / 220, away / 180, 41, 3));

type Hole = { d: number; dz: number; water: boolean };

/** The nearest shell hole to a point, as a distance in hole radii, and which side of it the point is on. */
function nearestHole(across: number, away: number): Hole | null {
  const ci = Math.floor(across / CRATER_CELL);
  const cj = Math.floor(away / CRATER_CELL);
  let best: Hole | null = null;
  for (let i = ci - 1; i <= ci + 1; i++) {
    for (let j = cj - 1; j <= cj + 1; j++) {
      const h = hash2(i, j, 71);
      if (h > shelling(i * CRATER_CELL, j * CRATER_CELL)) continue;
      const cx = (i + hash2(i, j, 72)) * CRATER_CELL;
      const cz = (j + hash2(i, j, 73)) * CRATER_CELL;
      const radius = 1.4 + 4.6 * hash2(i, j, 74) ** 2;
      const dx = across - cx;
      const dz = away - cz;
      const d = Math.hypot(dx, dz) / radius;
      if (d < 1.5 && (!best || d < best.d)) best = { d, dz: dz / radius, water: hash2(i, j, 75) < 0.45 };
    }
  }
  return best;
}

/** Where the trench line runs, stepping back and forth in traverses. */
const trenchAway = (across: number) => TRENCH_AWAY + (Math.floor(across / 9) % 2 === 0 ? 0 : 2.6) + fbm2(across / 60, 3, 5, 2) * 4;

/** The water's colour: the sky above, a little darker, with a few ripples. */
function waterColor(pal: Palette, across: number, away: number, day: boolean): Rgb {
  const ripple = fbm2(across / 2.5, away / 0.9, 13, 2);
  const base = mix(pal.water, day ? pal.skyMid : pal.skyLow, 0.35);
  return shade(base, 0.92 + ripple * 0.12);
}

export function frontGround(across: number, away: number, appearance: Appearance, lighting: Lighting): Rgb {
  const pal = paletteFor(appearance, lighting);
  const day = appearance === "day";
  // Broad changes of earth and the odd patch of surviving grass.
  const broad = fbm2(across / 90, away / 70, 3, 3);
  let c: Rgb = mix(pal.mud, pal.mudLight, smoothstep(-0.3, 0.8, broad) * 0.5);
  c = mix(c, pal.grass, smoothstep(0.15, 0.6, fbm2(across / 140 + 3, away / 90, 11, 2)) * 0.4);
  // Gentle unevenness, no finer than a few metres.
  c = shade(c, 0.94 + fbm2(across / 18, away / 14, 7, 2) * 0.1);
  // Shadows of clouds lying across the land, and the brighter ground between them.
  if (lighting === "ambient") c = shade(c, (day ? 0.74 : 0.9) + smoothstep(-0.45, 0.45, fbm2(across / 420, away / 260, 51, 2)) * (day ? 0.42 : 0.08));

  // Rain pooled in the low ground, with soft edges.
  const wet = fbm2(across / 80, away / 55, 19, 3);
  c = mix(c, waterColor(pal, across, away, day), smoothstep(0.45, 0.56, wet) * 0.85);

  const hole = nearestHole(across, away);
  // Far off, a shell hole is only a smudge; near, a bowl with a lip.
  const detail = smoothstep(1700, 500, away);
  if (hole && detail > 0) {
    if (hole.d < 1.05) {
      // Inside the bowl: the far wall faces us and catches the light, the near wall is in shadow.
      const facing = clamp(0.5 + hole.dz * 0.5);
      const bowl = mix(shade(pal.mudDark, 0.9), mix(pal.mud, pal.mudLight, 0.25), facing * 0.7);
      c = mix(c, bowl, smoothstep(1.05, 0.8, hole.d) * (0.45 + detail * 0.55));
      if (hole.water) c = mix(c, waterColor(pal, across, away, day), smoothstep(0.62, 0.4, hole.d) * 0.9 * detail);
    } else if (hole.d < 1.5) {
      // The lip of thrown-up earth.
      c = mix(c, mix(pal.mudLight, pal.rim, 0.1), Math.sin(((hole.d - 1.05) / 0.45) * Math.PI) * 0.22 * detail);
    }
  }

  // The trench: a dark cut, a pale parapet of spoil in front of it, a lower parados behind.
  const t = away - trenchAway(across);
  if (t > -1.1 && t < 1.1) c = mix(c, shade(pal.mudDark, 0.6), smoothstep(1.1, 0.7, Math.abs(t)));
  else if (t > -3.4 && t <= -1.1) c = mix(c, mix(pal.sandbag, pal.mudLight, 0.5), 0.55 * Math.sin(((t + 3.4) / 2.3) * Math.PI));
  else if (t >= 1.1 && t < 2.8) c = mix(c, pal.mudLight, 0.22);

  // Haze swallows the distance.
  return hazed(c, away, appearance, pal);
}

/* ---------- The sky and the skyline ---------- */

export function frontSky(ctx: Ctx, width: number, height: number, horizonY: number, appearance: Appearance) {
  paintSky(ctx, width, height, appearance, horizonY / height);
  const pal = paletteFor(appearance);
  const r = createRng(`great-war/front-skyline/${appearance}`).float;
  const haze = appearance === "day" ? pal.haze : pal.skyLow;
  // A far tree line and a ruined village along the horizon, softened by haze.
  const color = mix(pal.far, haze, 0.45);
  const unit = height * 0.012;
  ctx.fillStyle = css(mix(pal.far, haze, 0.55));
  ctx.fillRect(0, horizonY - unit * 0.6, width, unit * 0.6 + 2);
  for (let x = -20; x < width + 20; x += unit * (1 + r() * 3)) {
    if (r() < 0.55) poplar(ctx, x, horizonY, unit * (2 + r() * 2.5), pal, r, color);
    else shatteredTree(ctx, x, horizonY, unit * (1.5 + r() * 2.2), pal, r, color, 0.1);
  }
  church(ctx, width * 0.72, horizonY, unit * 6, pal, r, mix(pal.farDetail, haze, 0.35));
}

/* ---------- Things on the ground ---------- */

/** Trees left standing after the shelling, and the belt of wire in front of the trench, for this camera's view. */
export function frontProps(camera: FrontCamera, aspect: number): FrontProp[] {
  const props: FrontProp[] = [];
  const halfWidth = aspect / 2 / camera.focal;
  const nearest = (camera.height / (1 - camera.horizon)) * camera.focal * 0.95;
  for (let j = Math.floor(nearest / 50); j < 3200 / 50; j++) {
    for (let i = -60; i <= 60; i++) {
      const away = (j + hash2(i, j, 81)) * 50;
      const across = (i + hash2(i, j, 82)) * 36;
      if (Math.abs(across) > away * halfWidth + 30) continue;
      // Stumps cluster where woods once stood.
      const wood = smoothstep(0.1, 0.5, fbm2(across / 300, away / 260, 91, 2));
      if (hash2(i, j, 83) > 0.05 + wood * 0.35) continue;
      const seed = i * 1000 + j;
      const height = 5 + hash2(i, j, 84) * 13;
      props.push({ across, away, draw: (ctx, x, y, scale, appearance, lighting) => treeProp(ctx, x, y, scale, height, seed, away, appearance, lighting) });
    }
  }
  for (let across = -800; across <= 800; across += 3.6) {
    const away = WIRE_AWAY + fbm2(across / 40, 1, 17, 2) * 6;
    if (Math.abs(across) > away * halfWidth + 10) continue;
    props.push({ across, away, draw: (ctx, x, y, scale, appearance, lighting) => picket(ctx, x, y, scale, across, appearance, lighting) });
  }
  return props;
}

/** A colour seen through `away` metres of air: the haze takes over with distance. */
export function hazed(color: Rgb, away: number, appearance: Appearance, pal: Palette): Rgb {
  const fog = 1 - Math.exp(-away / 2400);
  return mix(color, appearance === "day" ? pal.haze : pal.skyLow, fog * (appearance === "day" ? 0.6 : 0.75));
}

function treeProp(ctx: Ctx, x: number, y: number, scale: number, height: number, seed: number, away: number, appearance: Appearance, lighting: Lighting) {
  const pal = paletteFor(appearance, lighting);
  const r = createRng(`great-war/front-tree/${seed}`).float;
  shatteredTree(ctx, x, y, height * scale, pal, r, hazed(mix(pal.woods, pal.mudDark, 0.3), away, appearance, pal), lighting === "flare" ? 0.7 : 0.25);
}

/** One wooden picket of the wire belt, with strands running on to the next. */
function picket(ctx: Ctx, x: number, y: number, scale: number, across: number, appearance: Appearance, lighting: Lighting) {
  const pal = paletteFor(appearance, lighting);
  const h = 1.6 * scale;
  const lean = (hash2(Math.round(across * 10), 3, 5) - 0.5) * 0.3;
  ctx.strokeStyle = css(pal.wire, 0.9);
  ctx.lineWidth = Math.max(0.8, 0.09 * scale);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + lean * h, y - h);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.5, 0.025 * scale);
  ctx.strokeStyle = css(pal.wire, 0.65);
  const next = 3.6 * scale;
  for (const level of [0.35, 0.65, 0.92]) {
    ctx.beginPath();
    ctx.moveTo(x + lean * h * level, y - h * level);
    ctx.quadraticCurveTo(x + next / 2, y - h * level + 0.15 * scale, x + next, y - h * level);
    ctx.stroke();
  }
}
