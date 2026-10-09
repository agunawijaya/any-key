import { hash1 } from "@/lib/two-humps/noise";
import type { PursuerKind } from "@/lib/two-humps/rules";
import { camelPaint, drawCamel, type Gait } from "./camel";
import { drawCampfire, drawFirelight, drawTraveller, flickerAt } from "./camp";
import { drawCaravan } from "./caravan";
import type { SceneHooks, SceneInfo } from "./Diorama";
import { GOBI_LAYERS, surfaceY } from "./dunes";
import { drawSaxaul, drawTuft, floraPaint } from "./flora";
import { drawGer, drawLanternString, gerPaint } from "./ger";
import { drawBlowingSand, drawDustVeil, drawHaboob, drawStormShade } from "./haboob";
import { drawEyes, drawJerboa } from "./jerboa";
import { css, lerp3, litColour, type Light, type RGB } from "./light";

/*
 * The trek as it plays: the camel holds the middle of the screen and the
 * Gobi slides past under it. Everything else is placed by its mile on the
 * route, so the gap to the pursuer is the gap you see: the Haboob's wall
 * looms closer, the rival's caravan pulls ahead or drops back, the gang
 * hops into view. Oases and the ger camp at the finish sit at their miles.
 */

export type OasisView = { at: number; dry: boolean; used: boolean };

export type TrekView = {
  pursuer: PursuerKind;
  /** Where the camel is, as animated between turns. */
  miles: number;
  pursuerAt: number;
  goal: number;
  oases: OasisView[];
  gait: Gait | "stand";
  phase: number;
  fatigue: number;
  /** Making camp: by night round a fire, by day in the shade of the camel. */
  camping: "night" | "day" | null;
  /** The gang stopped to eat seeds. */
  fed: boolean;
  /** The rival threatens a gallop. */
  plume: boolean;
  time: number;
  /** Moments things started, in animation seconds, or null. */
  singingSince: number | null;
  gustSince: number | null;
  fossilSince: number | null;
  /** Where the camel stands across the screen, as a share of its width (0.56 unless a screen needs room). */
  anchor?: number;
};

/** Screen positions for things on the route. */
export function placement(width: number, miles: number, anchor = 0.56) {
  const camelX = width * anchor;
  const mile = width * 0.032;
  return { camelX, mile, at: (m: number) => camelX + (m - miles) * mile };
}

export function trekScene(read: () => TrekView): SceneHooks {
  return {
    beforeLayer(index, info) {
      const view = read();
      const place = placement(info.width, view.miles, view.anchor);
      if (index === 3 && view.pursuer === "haboob") drawStorm(info, view, place.at(view.pursuerAt));
      if (index === 4 && view.pursuer === "rival") drawRival(info, view, place);
      if (index === 5) {
        drawFinish(info, view, place.at(view.goal), "far");
      }
    },
    overlay(info) {
      const view = read();
      const { ctx, width, height, horizon, light, time, groundAt } = info;
      const place = placement(width, view.miles, view.anchor);
      const gap = view.miles - view.pursuerAt;

      if (view.pursuer === "haboob") {
        const near = Math.max(0, Math.min(1, 1 - gap / 18));
        drawStormShade(ctx, { width, height, horizon }, light, place.at(view.pursuerAt) / width, 0.25 + 0.6 * near, nearGround(info));
      }

      // Plants and stones scattered along the route, fixed to their miles.
      const flora = floraPaint(light);
      const first = Math.floor(view.miles - 20);
      for (let m = first; m < view.miles + 16; m++) {
        const r = hash1(m, 3301);
        if (r > 0.42) continue;
        const x = place.at(m + hash1(m, 3302));
        if (x < -80 || x > width + 80) continue;
        if (r < 0.1) drawSaxaul(ctx, x, groundAt(x), height * (0.07 + 0.04 * hash1(m, 3303)), m, flora, view.pursuer === "haboob" ? 0.8 : 0.2, time);
        else drawTuft(ctx, x, groundAt(x) + height * 0.004, height * 0.026, m, flora, 0.4, time);
      }

      for (const oasis of view.oases) {
        const x = place.at(oasis.at);
        if (x > -200 && x < width + 200) drawOasis(ctx, x, groundAt(x), height, light, oasis, time);
      }
      drawFinish(info, view, place.at(view.goal), "near");
      if (view.pursuer === "gang") drawGang(info, view, place);

      const camelSize = height * 0.19;
      const side = light.sunX >= 0.5 ? 1 : -1;
      if (view.camping === "night") {
        const fx = place.camelX + camelSize * 1.7;
        const flicker = flickerAt(time);
        drawFirelight(ctx, fx, groundAt(fx), height * 0.5, flicker);
        const warm: RGB = [0.46 * flicker, 0.26 * flicker, 0.11 * flicker];
        drawCamel(ctx, place.camelX, groundAt(place.camelX), camelSize, { gait: "rest", phase: 0, headLow: 0, hump: hump(view), wind: 0.1, time, rider: false }, camelPaint(light, 1, warm, 1));
        drawTraveller(ctx, fx + camelSize * 0.9, groundAt(fx), camelSize * 0.85, "warm-hands", camelPaint(light, -1, warm, 1), -1, time);
        drawCampfire(ctx, fx, groundAt(fx), height * 0.04, time);
      } else if (view.camping === "day") {
        drawCamel(ctx, place.camelX, groundAt(place.camelX), camelSize, { gait: "rest", phase: 0, headLow: 0, hump: hump(view), wind: 0.2, time, rider: false }, camelPaint(light, side));
        drawTraveller(ctx, place.camelX + camelSize * 1.2, groundAt(place.camelX), camelSize * 0.85, "warm-hands", camelPaint(light, side), -1, time);
      } else {
        const moving = view.gait !== "stand";
        const storm = view.pursuer === "haboob" ? Math.max(0, 1 - gap / 14) : 0;
        drawCamel(
          ctx,
          place.camelX,
          groundAt(place.camelX) + camelSize * 0.02,
          camelSize,
          {
            gait: view.gait === "stand" ? "walk" : view.gait,
            phase: moving ? view.phase : 0.15 + Math.sin(time * 0.6) * 0.01,
            headLow: Math.min(1, (view.fatigue / 7) * 0.7 + storm * 0.6),
            hump: hump(view),
            wind: view.pursuer === "haboob" ? 0.3 + storm * 0.7 : 0.15,
            time,
            rider: true,
          },
          camelPaint(light, side),
        );
      }

      drawEffects(info, view, place.camelX, camelSize);
      const wind = view.pursuer === "haboob" ? Math.max(0, 1 - gap / 16) : 0;
      const gust = view.gustSince === null ? 0 : Math.max(0, 1 - (time - view.gustSince) / 2.5);
      // The last seven miles: the air itself fills with dust.
      const close = view.pursuer === "haboob" ? Math.max(0, Math.min(1, (7 - gap) / 5)) : 0;
      drawDustVeil(ctx, { width, height, horizon }, light, close);
      drawBlowingSand(ctx, { width, height, horizon }, light, Math.max(wind, gust), time, close);
    },
  };
}

/** Fatigue shows in the humps: they stand up on a fresh camel and sag as it tires. */
const hump = (view: TrekView) => 1 - (view.fatigue / 7) * 0.65;

function nearGround(info: SceneInfo) {
  const path = new Path2D();
  path.moveTo(0, info.height);
  for (let x = 0; x <= info.width; x += 8) path.lineTo(x, surfaceY(GOBI_LAYERS[3], info.ground, x));
  path.lineTo(info.width, info.height);
  path.closePath();
  return path;
}

function drawStorm(info: SceneInfo, view: TrekView, frontX: number) {
  const front = Math.max(-0.45, Math.min(0.5, frontX / info.width));
  if (front <= -0.44) return;
  const gap = view.miles - view.pursuerAt;
  // Far off, the wall is a low brown band on the horizon; it rears up as it closes in.
  const reach = 0.42 + 0.58 * Math.max(0, Math.min(1, 1 - (gap - 3) / 15));
  drawHaboob(info.ctx, { width: info.width, height: info.height, horizon: info.horizon }, info.light, { front, time: info.time, fury: Math.max(0.2, 1 - gap / 20), reach });
}

function drawRival(info: SceneInfo, view: TrekView, place: ReturnType<typeof placement>) {
  const layer = GOBI_LAYERS[3];
  // The rival keeps to a dune line further back, and the gap is drawn wider than true so a
  // close race still shows two caravans; the route strip gives the exact miles.
  const x = Math.max(info.width * 0.06, Math.min(info.width * 0.94, place.camelX + (view.pursuerAt - view.miles) * place.mile * 2.2));
  const groundY = surfaceY(layer, info.ground, x);
  const night = info.light.starlight > 0.5;
  drawCaravan(info.ctx, info.light, { x, groundY, size: info.height * 0.052, moving: !night, plume: view.plume, camped: night, facing: 1, time: info.time });
}

function drawGang(info: SceneInfo, view: TrekView, place: ReturnType<typeof placement>) {
  const { ctx, width, height, light, time, groundAt } = info;
  const x = place.at(view.pursuerAt);
  const night = light.starlight > 0.5;
  if (x < -40) {
    // Off the edge of the screen: at night their eyes give them away.
    if (night && view.miles - view.pursuerAt < 25) {
      for (let i = 0; i < 6; i++) drawEyes(ctx, width * (0.02 + 0.05 * hash1(i, 41)), groundAt(width * 0.05) - height * (0.02 + 0.08 * hash1(i, 42)), height * 0.003, time, i, [255, 196, 110]);
    }
    return;
  }
  const paint = gangPaint(light);
  for (let i = 0; i < 5; i++) {
    const jx = x - i * height * 0.05;
    const gy = groundAt(jx);
    if (!night || view.fed) {
      // Asleep in their burrows by day, or eating seeds: a mound with ears poking out.
      ctx.fillStyle = css(litColour(light, [196, 150, 100], 0.2));
      ctx.beginPath();
      ctx.ellipse(jx, gy, height * 0.025, height * 0.012, 0, Math.PI, 0);
      ctx.fill();
      if (view.fed) drawJerboa(ctx, jx, gy, height * 0.035, { hop: null, facing: 1, time, seed: i, reach: 0.6, ladle: i === 0 }, paint);
      continue;
    }
    drawJerboa(ctx, jx, gy, height * 0.04, { hop: (time * 1.4 + i * 0.27) % 1, facing: 1, time, ladle: i === 0, seed: i * 5 }, paint);
  }
}

function gangPaint(light: Light) {
  const lit = (albedo: RGB) => css(litColour(light, albedo, 0.3));
  return { fur: lit([214, 170, 118]), belly: lit([246, 230, 206]), ear: lit([232, 160, 150]), dark: "rgb(30 22 20)", eyeShine: "rgb(255 236 200)", ladle: lit([190, 196, 206]), bib: lit([250, 250, 246]), bibTrim: lit([230, 70, 80]) };
}

/** A Gobi oasis: a pool among reeds under a desert poplar. Dry once the rival has drunk it. */
function drawOasis(ctx: CanvasRenderingContext2D, x: number, groundY: number, height: number, light: Light, oasis: OasisView, time: number) {
  const unit = height / 1000;
  const water = lerp3([90, 170, 200], light.zenith, 0.35);
  if (oasis.dry) {
    ctx.fillStyle = css(litColour(light, [170, 130, 90], 0.1));
    ctx.beginPath();
    ctx.ellipse(x, groundY + 6 * unit, 70 * unit, 9 * unit, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(litColour(light, [120, 90, 60], 0.1));
    ctx.lineWidth = 1.2 * unit;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      ctx.moveTo(x - 50 * unit + i * 15 * unit, groundY + 3 * unit);
      ctx.lineTo(x - 44 * unit + i * 15 * unit, groundY + 10 * unit);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = css(water);
    ctx.beginPath();
    ctx.ellipse(x, groundY + 6 * unit, 76 * unit, 10 * unit, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(lerp3(water, [255, 255, 255], 0.4), 0.6);
    ctx.fillRect(x - 40 * unit + Math.sin(time) * 6 * unit, groundY + 4 * unit, 30 * unit, 1.5 * unit);
  }
  // A desert poplar: a rounded crown on a leaning trunk; bare when the oasis is dry.
  const trunk = css(litColour(light, [110, 86, 70], 0.2));
  ctx.strokeStyle = trunk;
  ctx.lineWidth = 7 * unit;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 40 * unit, groundY);
  ctx.quadraticCurveTo(x + 50 * unit, groundY - 50 * unit, x + 44 * unit, groundY - 95 * unit);
  ctx.stroke();
  if (!oasis.dry) {
    const leaf = litColour(light, [120, 150, 80], 0.5);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      ctx.fillStyle = css(lerp3(leaf, [220, 210, 120], 0.25 * hash1(i, 71)));
      ctx.beginPath();
      ctx.arc(x + 44 * unit + Math.cos(a) * 26 * unit, groundY - 108 * unit + Math.sin(a) * 18 * unit, 20 * unit, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Reeds round the water.
  ctx.strokeStyle = css(litColour(light, oasis.dry ? [170, 150, 100] : [110, 140, 70], 0.4));
  ctx.lineWidth = 2 * unit;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const rx = x - 70 * unit + i * 10 * unit;
    ctx.moveTo(rx, groundY + 2 * unit);
    ctx.quadraticCurveTo(rx + 3 * unit, groundY - 18 * unit, rx + 6 * unit + Math.sin(time * 1.5 + i) * 2 * unit, groundY - (26 + 10 * hash1(i, 72)) * unit);
  }
  ctx.stroke();
}

/** The ger camp at the far side: two gers and a string of lanterns. */
function drawFinish(info: SceneInfo, view: TrekView, x: number, depth: "far" | "near") {
  const { ctx, width, height, time, groundAt, light } = info;
  if (x < -width * 0.3 || x > width * 1.3) return;
  const night = light.starlight;
  if (depth === "far") {
    const y = surfaceY(GOBI_LAYERS[4], info.ground, x + height * 0.2);
    drawGer(ctx, x + height * 0.22, y, height * 0.06, gerPaint(night, night), night, time);
    return;
  }
  const size = height * 0.12;
  drawGer(ctx, x, groundAt(x), size, gerPaint(night, night), night, time);
  if (night > 0.3) drawLanternString(ctx, [x + size * 0.2, groundAt(x) - size * 1.08], [x + size * 2.4, groundAt(x) - size * 1.4], size * 0.3, 6, height * 0.01, time, 5);
}

function drawEffects(info: SceneInfo, view: TrekView, camelX: number, camelSize: number) {
  const { ctx, time, height, groundAt } = info;
  if (view.singingSince !== null) {
    // The dunes sing: slow rings of sound rolling out from the slope behind.
    const age = time - view.singingSince;
    if (age < 4) {
      const cx = camelX - camelSize * 2.5;
      const cy = groundAt(cx) - height * 0.05;
      ctx.lineWidth = Math.max(1, height / 500);
      for (let i = 0; i < 4; i++) {
        const t = (age * 0.6 + i * 0.25) % 1;
        ctx.strokeStyle = `rgb(255 240 200 / ${(1 - t) * 0.5 * (1 - age / 4)})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, height * (0.05 + t * 0.4), height * (0.02 + t * 0.12), 0, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  if (view.fossilSince !== null && time - view.fossilSince < 3) {
    // A glint in the sand by the camel's feet.
    const t = time - view.fossilSince;
    const x = camelX + camelSize * 0.8;
    const y = groundAt(x) - height * 0.01;
    ctx.fillStyle = `rgb(255 250 220 / ${Math.max(0, 1 - t / 3)})`;
    const r = height * 0.012 * (1 + Math.sin(t * 8) * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2);
    ctx.lineTo(x + r * 0.4, y - r * 0.4);
    ctx.lineTo(x + r * 2, y);
    ctx.lineTo(x + r * 0.4, y + r * 0.4);
    ctx.lineTo(x, y + r * 2);
    ctx.lineTo(x - r * 0.4, y + r * 0.4);
    ctx.lineTo(x - r * 2, y);
    ctx.lineTo(x - r * 0.4, y - r * 0.4);
    ctx.closePath();
    ctx.fill();
  }
}
