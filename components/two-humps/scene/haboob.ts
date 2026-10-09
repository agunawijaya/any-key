import { fbm1, hash1, noise1 } from "@/lib/two-humps/noise";
import { css, lerp3, smoothstep, type Light, type RGB } from "./light";

/*
 * The Haboob: a wall of dust a kilometre high, rolling in from the left.
 *
 * A real haboob's front is a rolling, cauliflower-headed wall: its top runs
 * ahead of its foot and curls over, and the leading edge is lumpy with
 * billows. We paint it from soft balls of dust at half resolution (dust is
 * soft; the smaller canvas is cheaper and blurs for free): a deep mass at the
 * back, billows along the front lit on the side that faces the sun, and a dark
 * skirt of sand racing along the ground ahead of it. When the sun is behind
 * the storm the wall goes dark and its edges glow instead.
 */

export type HaboobView = { width: number; height: number; horizon: number };

export type HaboobState = {
  /** Where the foot of the front is, as a share of the screen width. */
  front: number;
  /** Seconds of animation time. */
  time: number;
  /** 0 calm, 1 full fury: lightning and blowing sand. */
  fury: number;
  /** How tall the wall stands, 0–1: low on the horizon while it is far, towering once it is close. */
  reach?: number;
};

const DUST: RGB = [198, 118, 66];
const DUST_DEEP: RGB = [82, 42, 32];
/** The buffer is half the screen's size, but never wider than this: on big screens the dust stays soft and cheap. */
const MAX_BUFFER_WIDTH = 960;

/**
 * The wall is painted at half size into a buffer of its own and scaled up,
 * since dust can be soft. The buffer is repainted at most 24 times a second:
 * the billows roll slowly, and the frames in between reuse it.
 */
const REPAINTS_PER_SECOND = 24;
const buffers = new Map<string, { canvas: HTMLCanvasElement; key: string }>();

type Puff = { x: number; y: number; r: number; depth: number };

/** The front edge's x at a height `v` up the wall (0 foot, 1 top), as a share of the width. */
function frontAt(v: number, state: HaboobState) {
  const roll = 0.075 * smoothstep(0.15, 0.85, v) - 0.11 * smoothstep(0.86, 1, v);
  const wobble = (fbm1(v * 4 + state.time * 0.04, 404, 3) - 0.5) * 0.05;
  return state.front + roll + wobble;
}

export function drawHaboob(ctx: CanvasRenderingContext2D, view: HaboobView, light: Light, state: HaboobState) {
  const scale = Math.min(0.5, MAX_BUFFER_WIDTH / view.width);
  const width = Math.ceil(view.width * scale);
  const height = Math.ceil(view.height * scale);
  const size = `${width}x${height}`;
  let entry = buffers.get(size);
  if (!entry) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    entry = { canvas, key: "" };
    buffers.set(size, entry);
  }
  const key = [Math.floor(state.time * REPAINTS_PER_SECOND), state.front.toFixed(4), state.fury.toFixed(3), (state.reach ?? 1).toFixed(3), light.sunElevation.toFixed(2), light.sunX.toFixed(3)].join("|");
  if (entry.key !== key) {
    entry.key = key;
    paintWall(entry.canvas, view, light, state);
  }
  ctx.drawImage(entry.canvas, 0, 0, view.width, view.height);
}

function paintWall(buffer: HTMLCanvasElement, view: HaboobView, light: Light, state: HaboobState) {
  const { width, height } = buffer;
  const g = buffer.getContext("2d")!;
  g.clearRect(0, 0, width, height);

  const foot = (view.horizon / view.height + 0.12) * height;
  const top = foot - (foot - height * 0.05) * (state.reach ?? 1);
  // A distant, lower wall has smaller billows.
  const unit = (height / 1000) * (0.45 + 0.55 * (state.reach ?? 1));
  const sunFront = light.sunX >= 0.5;
  const sunUp = light.sun[0] > 0.05;
  const sunColour: RGB = sunUp ? [255, 178 + 50 * light.sun[1], 96 + 60 * light.sun[2]] : [150, 150, 190];
  const lit = lerp3(DUST, sunColour, sunUp ? (sunFront ? 0.66 : 0.15) : 0.05);
  const deep = lerp3(DUST_DEEP, light.haze, 0.15);
  const heightAt = (v: number) => foot - v * (foot - top);

  // The mass of the wall: many soft, darker puffs behind the front.
  const mass: Puff[] = [];
  for (let i = 0; i < 150; i++) {
    const v = hash1(i, 71) ** 0.75;
    const behind = 0.04 + hash1(i, 73) * 0.62;
    mass.push({ x: (frontAt(v, state) - behind) * width, y: heightAt(v) - ((state.time * 4 + hash1(i, 72) * 200) % 60) * unit, r: (45 + hash1(i, 74) ** 1.5 * 110) * unit, depth: 0.5 + behind });
  }
  // A solid core so no sky shows through the middle of the wall.
  const core = g.createLinearGradient(0, top, 0, foot);
  core.addColorStop(0, css(lerp3(lit, deep, 0.45), 0));
  core.addColorStop(0.18, css(lerp3(lit, deep, 0.5)));
  core.addColorStop(1, css(deep));
  g.fillStyle = core;
  g.beginPath();
  g.moveTo(-10, foot);
  for (let i = 0; i <= 30; i++) {
    const v = (i / 30) * 0.92;
    g.lineTo((frontAt(v, state) - 0.07) * width, heightAt(v));
  }
  g.lineTo(-10, heightAt(0.95));
  g.closePath();
  g.fill();
  for (const puff of mass) drawPuff(g, puff, lit, deep, sunFront, sunUp);

  // Billows along the leading edge, rolling up the face and over the top, each
  // carrying smaller billows on its sunward shoulder, like a cauliflower.
  const billows: Puff[] = [];
  const rows = 36;
  for (let i = 0; i < rows; i++) {
    const v = ((i + hash1(i, 84) * 0.8) / rows + state.time * 0.01) % 1;
    // Near the foot the front is a dense, dark skirt rather than billows.
    if (v < 0.16) continue;
    const r = (22 + 58 * hash1(i, 85) ** 2 + 34 * Math.sin(Math.PI * v)) * unit;
    const x = frontAt(v, state) * width - r * (0.15 + 0.5 * hash1(i, 86));
    const y = heightAt(v);
    const depth = 0.05 + 0.3 * hash1(i, 82);
    billows.push({ x, y, r, depth });
    for (let k = 0; k < 3; k++) {
      const angle = -Math.PI / 2 + (sunFront ? 0.5 : -0.5) + (hash1(i * 3 + k, 87) - 0.5) * 1.8;
      const rr = r * (0.3 + 0.25 * hash1(i * 3 + k, 88));
      billows.push({ x: x + Math.cos(angle) * r * 0.72, y: y + Math.sin(angle) * r * 0.72, r: rr, depth: Math.max(0, depth - 0.08) });
    }
  }
  billows.sort((a, b) => b.depth - a.depth || a.r - b.r);
  for (const puff of billows) drawPuff(g, puff, lit, deep, sunFront, sunUp);

  // The skirt: low, dense sand racing out ahead of the wall.
  const skirtEnd = (frontAt(0, state) + 0.3) * width;
  const skirt = g.createLinearGradient(frontAt(0, state) * width - width * 0.1, 0, skirtEnd, 0);
  skirt.addColorStop(0, css(lerp3(lit, deep, 0.5), 0.95));
  skirt.addColorStop(1, css(lerp3(lit, deep, 0.5), 0));
  g.fillStyle = skirt;
  g.beginPath();
  g.moveTo(-10, foot + height * 0.05);
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = -10 + t * (skirtEnd + 10);
    g.lineTo(x, foot - height * (0.1 - 0.085 * t) - noise1(t * 7 + state.time * 0.9, 91) * height * 0.035);
  }
  g.lineTo(skirtEnd, foot + height * 0.05);
  g.closePath();
  g.fill();

  // One light over the whole wall ties the billows together: bright up at the sunward
  // top, sinking into deep dust towards the foot and the back.
  g.save();
  g.globalCompositeOperation = "source-atop";
  const sunward = sunFront ? frontAt(0.8, state) * width : 0;
  const tie = g.createLinearGradient(sunward, top, sunFront ? width * 0.05 : width * 0.4, foot);
  tie.addColorStop(0, css(lerp3(lit, [255, 222, 170], sunUp && sunFront ? 0.4 : 0), sunFront ? 0.5 : 0.25));
  tie.addColorStop(0.55, css(lerp3(lit, deep, 0.5), 0.18));
  tie.addColorStop(1, css(deep, 0.7));
  g.fillStyle = tie;
  g.fillRect(0, 0, width, height);
  // Wisps of dust dragged along by the outflow wind.
  g.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    const v = hash1(i, 95);
    const y = heightAt(v);
    const x0 = (frontAt(v, state) - 0.05 - hash1(i, 96) * 0.5) * width;
    const len = (0.06 + 0.16 * hash1(i, 97)) * width;
    const drift = ((state.time * 18 + hash1(i, 98) * 300) % 300) * unit;
    g.strokeStyle = css(lerp3(lit, [255, 235, 200], 0.2), 0.05 + 0.07 * hash1(i, 99));
    g.lineWidth = (4 + 12 * hash1(i, 100)) * unit;
    g.beginPath();
    g.moveTo(x0 + drift, y);
    g.bezierCurveTo(x0 + drift + len * 0.3, y - 14 * unit, x0 + drift + len * 0.7, y + 10 * unit, x0 + drift + len, y - 6 * unit);
    g.stroke();
  }
  g.restore();

  drawLightning(g, width, height, state);
}

/**
 * One soft ball of dust. Lit from the sun's side with a warm highlight, deep
 * underneath; with the sun behind the storm, only a bright fringe shows.
 */
function drawPuff(g: CanvasRenderingContext2D, puff: Puff, lit: RGB, deep: RGB, sunFront: boolean, sunUp: boolean) {
  const { x, y, r, depth } = puff;
  const toSun = sunFront ? 1 : -1;
  const shade = Math.min(1, depth);
  const body = lerp3(lit, deep, 0.12 + shade * 0.62);
  // Only billows near the face catch the light; the mass behind is a soft, even dust.
  const catchLight = Math.max(0, 1 - shade / 0.45);
  const highlight = sunFront && sunUp ? lerp3(body, lerp3(lit, [255, 226, 170], 0.42), catchLight) : lerp3(body, lit, 0.3 * catchLight);
  const grad = g.createRadialGradient(x + toSun * r * 0.3, y - r * 0.34, 0, x, y, r);
  grad.addColorStop(0, css(lerp3(highlight, body, 0.15)));
  grad.addColorStop(0.5, css(lerp3(highlight, body, 0.55)));
  grad.addColorStop(0.8, css(body, 0.9));
  grad.addColorStop(1, css(body, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (!sunFront && sunUp) {
    // Backlit: the far edge of each billow glows.
    const rim = g.createRadialGradient(x, y, r * 0.7, x, y, r);
    rim.addColorStop(0, "rgb(255 200 140 / 0)");
    rim.addColorStop(0.85, `rgb(255 200 140 / ${0.16 * catchLight})`);
    rim.addColorStop(1, "rgb(255 200 140 / 0)");
    g.fillStyle = rim;
    g.fill();
  }
}

/** Now and then a fork of lightning lights the wall from inside. */
function drawLightning(g: CanvasRenderingContext2D, width: number, height: number, state: HaboobState) {
  if (state.fury < 0.3) return;
  const slot = Math.floor(state.time * 1.6);
  if (hash1(slot, 501) > 0.32 * state.fury) return;
  const local = state.time * 1.6 - slot;
  const flash = local < 0.12 ? 1 : local < 0.2 ? 0.4 : local < 0.3 ? 0.85 : 0;
  if (flash <= 0) return;
  const x0 = width * (0.06 + 0.2 * hash1(slot, 502));
  const y0 = height * 0.14;

  g.save();
  g.globalCompositeOperation = "source-atop";
  const glow = g.createRadialGradient(x0, height * 0.3, 0, x0, height * 0.3, height * 0.36);
  glow.addColorStop(0, `rgb(255 226 210 / ${0.5 * flash})`);
  glow.addColorStop(1, "rgb(255 226 210 / 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, width, height);
  g.strokeStyle = `rgb(255 248 240 / ${0.8 * flash})`;
  g.lineWidth = Math.max(1, height / 500);
  g.beginPath();
  let x = x0;
  let y = y0;
  g.moveTo(x, y);
  for (let i = 0; i < 12; i++) {
    x += (hash1(slot * 31 + i, 503) - 0.5) * height * 0.06;
    y += height * (0.022 + 0.02 * hash1(slot * 31 + i, 504));
    g.lineTo(x, y);
    if (hash1(slot * 31 + i, 505) > 0.78) {
      g.moveTo(x, y);
      g.lineTo(x + height * 0.05, y + height * 0.035);
      g.moveTo(x, y);
    }
  }
  g.stroke();
  g.restore();
}

/**
 * Sand streaming past at ground level, racing left to right: the most
 * convincing sign of wind. Drawn over everything near the ground.
 */
/** Streaks of sand racing across the ground; with `high` above 0 they fill the air too, as the storm arrives. */
export function drawBlowingSand(ctx: CanvasRenderingContext2D, view: HaboobView, light: Light, strength: number, time: number, high = 0) {
  if (strength <= 0.02) return;
  const { width, height } = view;
  const colour = lerp3([232, 176, 116], light.haze, 0.25);
  ctx.save();
  ctx.lineCap = "round";
  const count = Math.round(320 * strength);
  for (let i = 0; i < count; i++) {
    const speed = (0.6 + hash1(i, 601)) * width * 0.9;
    const x = ((hash1(i, 602) * width * 1.4 + time * speed) % (width * 1.4)) - width * 0.2;
    const top = 0.7 - 0.55 * high * hash1(i, 607);
    const y = height * (top + (1 - top) * hash1(i, 603) ** 0.6) + Math.sin(time * 3 + i) * height * 0.004;
    const len = (24 + 110 * hash1(i, 604)) * (height / 1000) * (0.5 + strength);
    ctx.strokeStyle = css(colour, (0.14 + 0.36 * hash1(i, 605)) * strength);
    ctx.lineWidth = Math.max(0.8, (height / 1000) * (0.8 + 1.8 * hash1(i, 606)));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - len * 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

/** The storm's shadow and the dust in the air: the left of the scene darkens and the light turns brown. */
/**
 * The storm on top of you: a veil of dust over the whole sky, thickest on the
 * storm's side, with the light going brown. `close` runs 0–1 over the last
 * few miles.
 */
export function drawDustVeil(ctx: CanvasRenderingContext2D, view: HaboobView, light: Light, close: number) {
  if (close <= 0) return;
  const { width, height } = view;
  const tint = lerp3(DUST, light.haze, 0.35);
  const g = ctx.createLinearGradient(0, 0, width, 0);
  g.addColorStop(0, css(tint, 0.5 * close));
  g.addColorStop(0.6, css(tint, 0.3 * close));
  g.addColorStop(1, css(tint, 0.18 * close));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

export function drawStormShade(ctx: CanvasRenderingContext2D, view: HaboobView, light: Light, front: number, strength: number, nearGround?: Path2D) {
  const { width, height } = view;
  const g = ctx.createLinearGradient(0, 0, width * Math.min(1, front + 0.5), 0);
  const tint = lerp3(DUST_DEEP, light.haze, 0.3);
  g.addColorStop(0, css(tint, 0.55 * strength));
  g.addColorStop(0.5, css(tint, 0.25 * strength));
  g.addColorStop(1, css(tint, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  // The near dunes lie in the wall's shadow.
  if (nearGround) {
    const ground = ctx.createLinearGradient(0, 0, width * (front + 0.3), 0);
    ground.addColorStop(0, css(DUST_DEEP, 0.45 * strength));
    ground.addColorStop(1, css(DUST_DEEP, 0));
    ctx.fillStyle = ground;
    ctx.fill(nearGround);
  }
}
