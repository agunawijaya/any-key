import { createRng } from "@/lib/kit/rng";
import { css, jitter, mix, shade, type Rgb } from "../../scene/color";
import type { FrontProp } from "../../scene/front";
import { clamp, smoothstep } from "../../scene/noise";
import { dab, type Ctx } from "../../scene/paint";
import type { Appearance, Lighting } from "../../scene/side";
import type { TargetLook } from "../types";
import { paletteFor, type Palette } from "./palette";

/*
 * The targets: equipment and positions, never people. Each is drawn twice:
 * as a prop in the observer's field glasses, in metres and in detail, and
 * as a small silhouette in the side view. Each has three states: intact,
 * damaged (a target that takes two hits, after the first) and destroyed.
 * Fire and smoke come from the effects; here is only what stays standing.
 */

type Tone = { pal: Palette; tone: number; lit: number; appearance: Appearance };

/** Unlit at night a target is only a dark shape; a flare brings its colours back. */
function toneOf(appearance: Appearance, lighting: Lighting): Tone {
  return { pal: paletteFor(appearance, lighting), tone: appearance === "night" && lighting === "ambient" ? 0.28 : 1, lit: lighting === "flare" ? 1.25 : 1, appearance };
}

const burnt = (c: Rgb, look: TargetLook) => (look.state === "destroyed" ? mix(c, [26, 22, 20], 0.72) : c);

/* ---------- In the observer's view ---------- */

/**
 * The target as a prop in the observer's view. `look` is asked at every
 * frame, so a change of state needs no new prop. Convoys move, so they are
 * drawn each frame with `drawConvoy` instead.
 */
export function targetProp(look: () => TargetLook, across: number, away: number): FrontProp {
  return {
    across,
    away,
    draw: (ctx, x, y, scale, appearance, lighting) => {
      const l = look();
      const t = toneOf(appearance, lighting);
      if (l.kind === "dump") drawDump(ctx, x, y, scale * 1.6, t, l);
      else if (l.kind === "battery") drawBattery(ctx, x, y, scale * 1.5, t, l);
      else if (l.kind === "bridge") drawBridge(ctx, x, y, scale * 1.3, t, l);
      else if (l.kind === "railyard") drawRailyard(ctx, x, y, scale * 1.25, t, l);
      else if (l.kind === "mast") drawMast(ctx, x, y, scale * 1.3, t, l);
    },
  };
}

/* The dump: shell boxes, a tarpaulin heap, drums, a corrugated-iron hut. */

function drawDump(ctx: Ctx, x: number, y: number, s: number, t: Tone, look: TargetLook) {
  const r = createRng("great-war/dump").float;
  const { pal, tone, lit } = t;
  const wood = burnt(shade(mix([128, 98, 62], pal.mud, 0.35), tone), look);
  const canvas = burnt(shade(mix([92, 90, 64], pal.mudDark, 0.3), tone), look);
  // Trampled ground under it all; scorched black once it has gone up.
  dab(ctx, x, y + s * 0.4, s * 18, look.state === "destroyed" ? [18, 15, 13] : pal.mudDark, look.state === "destroyed" ? 0.75 : 0.55, 0.16);
  if (look.state === "destroyed") {
    hut(ctx, x + s * 6.5, y - s * 1.6, s, pal, 0.35, true);
    scattered(ctx, x, y, s, wood, lit, r);
    return;
  }
  hut(ctx, x + s * 6.5, y - s * 1.6, s, pal, tone, false);
  boxStack(ctx, x - s * 3.5, y - s * 1.2, s, 7, 4, wood, lit, r);
  tarpHeap(ctx, x + s * 3.2, y + s * 0.5, s * 5, s * 2.1, canvas, pal, lit);
  boxStack(ctx, x - s * 9.5, y + s * 0.7, s, 5, 3, wood, lit, r);
  drums(ctx, x + s * 8, y + s * 1.1, s * 0.85, pal, lit, tone);
}

/** Shell boxes stacked in a stepped pile, lit on their tops. */
function boxStack(ctx: Ctx, x: number, y: number, s: number, wide: number, high: number, wood: Rgb, lit: number, r: () => number) {
  const bw = s * 1.1;
  const bh = s * 0.55;
  for (let row = 0; row < high; row++) {
    const count = wide - row;
    const x0 = x - (count * bw) / 2;
    for (let k = 0; k < count; k++) {
      const c = jitter(wood, 0.1, r);
      const bx = x0 + k * bw;
      const by = y - (row + 1) * bh;
      ctx.fillStyle = css(shade(c, 0.7 * lit));
      ctx.fillRect(bx, by, bw * 0.97, bh * 0.97);
      ctx.fillStyle = css(shade(c, 1.05 * lit));
      ctx.fillRect(bx, by, bw * 0.97, bh * 0.22);
      ctx.fillStyle = css(shade(c, 0.45));
      ctx.fillRect(bx + bw * 0.45, by + bh * 0.3, bw * 0.08, bh * 0.5);
    }
  }
}

/** What is left of the stacks: boxes thrown about and burnt, lying at angles. */
function scattered(ctx: Ctx, x: number, y: number, s: number, wood: Rgb, lit: number, r: () => number) {
  for (let k = 0; k < 26; k++) {
    const bx = x + (r() - 0.5) * s * 24;
    const by = y + (r() - 0.3) * s * 1.6;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate((r() - 0.5) * 1.4);
    ctx.fillStyle = css(shade(jitter(wood, 0.15, r), 0.55 * lit));
    ctx.fillRect(-s * 0.55, -s * 0.5, s * 1.1, s * 0.5);
    ctx.restore();
  }
}

/** A heap under a tarpaulin, roped down. */
function tarpHeap(ctx: Ctx, x: number, y: number, w: number, h: number, color: Rgb, pal: Palette, lit: number) {
  const g = ctx.createLinearGradient(0, y - h, 0, y);
  g.addColorStop(0, css(shade(color, 1.25 * lit)));
  g.addColorStop(1, css(shade(color, 0.6)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w * 0.45, y - h * 1.1, x + w * 0.4, y - h * 1.15, x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(shade(color, 0.5), 0.8);
  ctx.lineWidth = Math.max(0.6, h * 0.04);
  for (let k = 1; k < 4; k++) {
    const rx = x - w / 2 + (w * k) / 4;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.quadraticCurveTo(rx + w * 0.03, y - h * 0.7, rx + w * 0.06, y - h * 0.9);
    ctx.stroke();
  }
  ctx.strokeStyle = css(pal.rim, 0.25 * lit);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.35, y - h * 0.75);
  ctx.quadraticCurveTo(x, y - h * 0.92, x + w * 0.3, y - h * 0.8);
  ctx.stroke();
}

/** A cluster of fuel drums, standing and lying. */
function drums(ctx: Ctx, x: number, y: number, s: number, pal: Palette, lit: number, tone: number) {
  const steel: Rgb = shade(mix([84, 92, 80], pal.mudDark, 0.35), tone);
  for (let k = 0; k < 6; k++) {
    const dx = x + (k % 3) * s * 0.75 + (k > 2 ? s * 0.35 : 0);
    const dy = y - (k > 2 ? s * 0.9 : 0);
    ctx.fillStyle = css(shade(steel, 0.75 * lit));
    ctx.fillRect(dx, dy - s * 0.9, s * 0.62, s * 0.9);
    ctx.fillStyle = css(shade(steel, 1.15 * lit));
    ctx.beginPath();
    ctx.ellipse(dx + s * 0.31, dy - s * 0.9, s * 0.31, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A corrugated-iron hut: half a cylinder lying on the ground, end on; holed and black once burnt. */
function hut(ctx: Ctx, x: number, y: number, s: number, pal: Palette, tone: number, wrecked: boolean) {
  const iron: Rgb = shade(mix([96, 96, 90], pal.mudDark, 0.3), tone);
  const w = s * 6;
  const h = s * 2.8;
  ctx.fillStyle = css(shade(iron, 0.8));
  ctx.beginPath();
  if (wrecked) {
    // Torn open: the arch broken off on one side.
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.45, y - h * 0.9, x - w * 0.1, y - h * 0.95);
    ctx.lineTo(x + w * 0.05, y - h * 0.55);
    ctx.lineTo(x + w * 0.2, y - h * 0.7);
    ctx.lineTo(x + w * 0.3, y - h * 0.2);
    ctx.lineTo(x + w * 0.45, y);
    ctx.closePath();
  } else ctx.ellipse(x, y, w / 2, h, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = css(shade(iron, 0.55), 0.7);
  ctx.lineWidth = Math.max(0.5, s * 0.06);
  for (let k = 1; k < 8; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    if (wrecked && k > 3) break;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * w * 0.5, y + Math.sin(a) * h);
    ctx.lineTo(x + Math.cos(a) * w * 0.38, y + Math.sin(a) * h * 0.75);
    ctx.stroke();
  }
  ctx.fillStyle = css(shade(iron, 0.35));
  ctx.fillRect(x - s * 0.6, y - h * 0.55, s * 1.2, h * 0.55);
}

/* The battery: two guns facing us behind a wall of sandbags, a net strung over them on poles. */

function drawBattery(ctx: Ctx, x: number, y: number, s: number, t: Tone, look: TargetLook) {
  const r = createRng("great-war/battery").float;
  const { pal, tone, lit } = t;
  const steel = burnt(shade([74, 80, 66], tone), look);
  const bag = shade(mix(pal.sandbag, pal.mud, 0.25), tone);
  const wrecked = look.state === "destroyed";
  dab(ctx, x, y + s * 0.3, s * 16, wrecked ? [20, 17, 15] : pal.mudDark, 0.55, 0.15);
  if (!wrecked) net(ctx, x, y, s, t, r);
  for (const side of [-1, 1]) {
    const gx = x + side * s * 4.6;
    if (wrecked && side === 1) gunWreck(ctx, gx, y, s, steel, lit);
    else gunFacing(ctx, gx, y, s, steel, lit, pal);
  }
  // The sandbag wall in front, in a shallow curve, with a gap blown in it once hit.
  for (let course = 0; course < 3; course++) {
    for (let k = -9; k <= 9; k++) {
      if (wrecked && course > 0 && k > 1 && k < 6) continue;
      const bx = x + k * s * 1.05 + (course % 2) * s * 0.5;
      const by = y + s * 0.5 - course * s * 0.42 - Math.cos((k / 9) * 1.2) * s * 0.3;
      ctx.fillStyle = css(shade(jitter(bag, 0.08, r), (0.75 + course * 0.1) * lit));
      ctx.beginPath();
      ctx.ellipse(bx, by, s * 0.56, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  boxStack(ctx, x + s * 9.5, y + s * 0.4, s * 0.8, 3, 2, burnt(shade([118, 92, 60], tone), look), lit, r);
}

/** A field gun seen from the front: shield, muzzle, wheels edge-on. */
function gunFacing(ctx: Ctx, x: number, y: number, s: number, steel: Rgb, lit: number, pal: Palette) {
  const wheelR = s * 0.75;
  for (const side of [-1, 1]) {
    ctx.fillStyle = css(shade(steel, 0.55));
    ctx.beginPath();
    ctx.ellipse(x + side * s * 1.05, y - wheelR, s * 0.16, wheelR, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The shield: a steel plate with a slanted top and a notch for the sights.
  ctx.fillStyle = css(shade(steel, 0.85 * lit));
  ctx.beginPath();
  ctx.moveTo(x - s * 1.25, y - s * 0.35);
  ctx.lineTo(x - s * 1.25, y - s * 1.9);
  ctx.lineTo(x - s * 0.3, y - s * 2.15);
  ctx.lineTo(x - s * 0.3, y - s * 1.95);
  ctx.lineTo(x + s * 0.3, y - s * 1.95);
  ctx.lineTo(x + s * 0.3, y - s * 2.15);
  ctx.lineTo(x + s * 1.25, y - s * 1.9);
  ctx.lineTo(x + s * 1.25, y - s * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(shade(steel, 1.15 * lit));
  ctx.fillRect(x - s * 1.25, y - s * 1.92, s * 2.5, s * 0.08);
  // The barrel coming out at us, and its dark mouth.
  ctx.fillStyle = css(shade(steel, 0.6));
  ctx.beginPath();
  ctx.arc(x, y - s * 1.2, s * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css([10, 10, 10]);
  ctx.beginPath();
  ctx.arc(x, y - s * 1.2, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(pal.rim, 0.25 * lit);
  ctx.lineWidth = Math.max(0.6, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - s * 1.2, y - s * 1.9);
  ctx.lineTo(x - s * 0.35, y - s * 2.1);
  ctx.stroke();
}

/** A gun knocked over: shield on its side, barrel cocked up, one wheel lying flat. */
function gunWreck(ctx: Ctx, x: number, y: number, s: number, steel: Rgb, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.42);
  ctx.fillStyle = css(shade(steel, 0.7 * lit));
  ctx.fillRect(-s * 1.2, -s * 1.7, s * 2.3, s * 1.35);
  ctx.fillStyle = css(shade(steel, 0.45));
  ctx.fillRect(-s * 0.15, -s * 3.2, s * 0.3, s * 1.8);
  ctx.restore();
  ctx.fillStyle = css(shade(steel, 0.4));
  ctx.beginPath();
  ctx.ellipse(x - s * 2.2, y + s * 0.15, s * 0.8, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A camouflage net hung from poles: sagging between them, tufted with scraps of cloth. */
function net(ctx: Ctx, x: number, y: number, s: number, t: Tone, r: () => number) {
  const { pal, tone, lit } = t;
  const poles = [-9.5, -3, 3, 9.5].map((k) => ({ px: x + k * s, top: y - s * (3.3 + r() * 0.3) }));
  ctx.strokeStyle = css(shade([62, 52, 38], tone * lit));
  ctx.lineWidth = Math.max(0.8, s * 0.1);
  for (const p of poles) {
    ctx.beginPath();
    ctx.moveTo(p.px, y + s * 0.2);
    ctx.lineTo(p.px, p.top);
    ctx.stroke();
  }
  // The net's lower edge sags between the poles; scraps of green, brown and khaki are woven in.
  const edge = (u: number) => {
    const span = (u - poles[0].px) / (poles[3].px - poles[0].px);
    return y - s * 3.2 + Math.abs(Math.sin(span * Math.PI * 3)) * s * 0.9 + s * 0.6;
  };
  ctx.fillStyle = css(shade(mix([70, 72, 50], pal.mudDark, 0.25), tone * lit), 0.82);
  ctx.beginPath();
  ctx.moveTo(poles[0].px - s * 0.8, edge(poles[0].px) + s * 0.4);
  for (const p of poles) ctx.lineTo(p.px, p.top - s * 0.25);
  ctx.lineTo(poles[3].px + s * 0.8, edge(poles[3].px) + s * 0.4);
  for (let u = poles[3].px; u >= poles[0].px; u -= s * 0.5) ctx.lineTo(u, edge(u) + (r() - 0.5) * s * 0.35);
  ctx.closePath();
  ctx.fill();
  const scraps: Rgb[] = [
    [86, 84, 54],
    [64, 58, 40],
    [104, 96, 70],
    [52, 56, 40],
  ];
  for (let k = 0; k < 90; k++) {
    const u = poles[0].px + r() * (poles[3].px - poles[0].px);
    const v = y - s * 3.1 + r() * (edge(u) - (y - s * 3.1));
    dab(ctx, u, v, s * (0.2 + r() * 0.35), shade(scraps[k % 4], tone * lit), 0.7, 0.6);
  }
}

/* The bridge: three stone arches over a stream that runs across the view. */

function drawBridge(ctx: Ctx, x: number, y: number, s: number, t: Tone, look: TargetLook) {
  const { pal, tone, lit } = t;
  const stone = burnt(shade(mix([150, 140, 122], pal.mud, 0.25), tone), look);
  const water = shade(mix(pal.water, pal.skyMid, 0.4), tone);
  const length = s * 30;
  const deck = s * 4.2;
  const left = x - length / 2;
  // The stream and its banks, lying flat across the ground.
  ctx.fillStyle = css(shade(pal.mudDark, 0.9));
  ctx.fillRect(x - length * 0.9, y - s * 0.2, length * 1.8, s * 1.0);
  ctx.fillStyle = css(water);
  ctx.fillRect(x - length * 0.9, y - s * 0.05, length * 1.8, s * 0.6);
  ctx.fillStyle = css(shade(water, 1.15), 0.5);
  for (let k = 0; k < 18; k++) ctx.fillRect(x - length * 0.85 + k * length * 0.1, y + s * 0.1 + (k % 3) * s * 0.12, s * 1.2, s * 0.05);

  const broken = look.state === "destroyed";
  const chipped = look.state === "damaged";
  const gapFrom = left + length * 0.36;
  const gapTo = left + length * 0.64;
  const solid = (u0: number, u1: number) => {
    const g = ctx.createLinearGradient(0, y - deck, 0, y);
    g.addColorStop(0, css(shade(stone, 1.1 * lit)));
    g.addColorStop(1, css(shade(stone, 0.7)));
    ctx.fillStyle = g;
    ctx.fillRect(u0, y - deck, u1 - u0, deck);
  };
  if (broken) {
    solid(left, gapFrom);
    solid(gapTo, left + length);
    // Jagged ends where the middle span fell into the stream.
    ctx.fillStyle = css(shade(stone, 0.8 * lit));
    for (const [edgeX, dir] of [
      [gapFrom, 1],
      [gapTo, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(edgeX, y - deck);
      ctx.lineTo(edgeX + dir * s * 1.2, y - deck * 0.85);
      ctx.lineTo(edgeX + dir * s * 0.4, y - deck * 0.55);
      ctx.lineTo(edgeX + dir * s * 1.0, y - deck * 0.3);
      ctx.lineTo(edgeX, y);
      ctx.closePath();
      ctx.fill();
    }
    rubble(ctx, x, y, s, stone, lit, 7);
  } else solid(left, left + length);
  // The arches, dark beneath, and the piers between them.
  for (let k = 0; k < 3; k++) {
    const cx = left + length * (0.18 + k * 0.32);
    if (broken && k === 1) continue;
    ctx.fillStyle = css(shade(pal.mudDark, 0.55));
    ctx.beginPath();
    ctx.moveTo(cx - s * 3.6, y);
    ctx.lineTo(cx - s * 3.6, y - deck * 0.42);
    ctx.ellipse(cx, y - deck * 0.42, s * 3.6, deck * 0.38, 0, Math.PI, 0);
    ctx.lineTo(cx + s * 3.6, y);
    ctx.closePath();
    ctx.fill();
  }
  // Courses of stone and the parapet along the top.
  ctx.strokeStyle = css(shade(stone, 0.6), 0.5);
  ctx.lineWidth = Math.max(0.5, s * 0.05);
  for (let row = 1; row < 5; row++) {
    const ry = y - deck + (deck / 5) * row;
    ctx.beginPath();
    ctx.moveTo(left, ry);
    ctx.lineTo(broken ? gapFrom : left + length, ry);
    if (broken) {
      ctx.moveTo(gapTo, ry);
      ctx.lineTo(left + length, ry);
    }
    ctx.stroke();
  }
  ctx.fillStyle = css(shade(stone, 1.2 * lit));
  const parapet = (u0: number, u1: number) => ctx.fillRect(u0, y - deck - s * 0.7, u1 - u0, s * 0.7);
  if (broken) {
    parapet(left, gapFrom);
    parapet(gapTo, left + length);
  } else if (chipped) {
    // The first hit took a bite out of the parapet and scorched the stone.
    parapet(left, left + length * 0.55);
    parapet(left + length * 0.68, left + length);
    dab(ctx, left + length * 0.61, y - deck * 0.7, s * 2.6, [30, 26, 22], 0.45, 0.8);
    rubble(ctx, left + length * 0.61, y, s, stone, lit, 3);
  } else parapet(left, left + length);
  ctx.strokeStyle = css(pal.rim, 0.3 * lit);
  ctx.beginPath();
  ctx.moveTo(left, y - deck - s * 0.7);
  ctx.lineTo(broken ? gapFrom : left + length, y - deck - s * 0.7);
  ctx.stroke();
}

function rubble(ctx: Ctx, x: number, y: number, s: number, stone: Rgb, lit: number, spread: number) {
  const r = createRng(`great-war/rubble/${Math.round(x)}`).float;
  for (let k = 0; k < 30; k++) {
    const bx = x + (r() - 0.5) * s * spread;
    const by = y + (r() - 0.6) * s * 0.8;
    ctx.fillStyle = css(shade(jitter(stone, 0.12, r), (0.6 + r() * 0.4) * lit));
    ctx.beginPath();
    ctx.ellipse(bx, by, s * (0.3 + r() * 0.5), s * (0.2 + r() * 0.3), r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* The rail yard: a goods shed, wagons on the siding in front of it, a water tower. */

function drawRailyard(ctx: Ctx, x: number, y: number, s: number, t: Tone, look: TargetLook) {
  const r = createRng("great-war/railyard").float;
  const { pal, tone, lit } = t;
  const brick = burnt(shade([120, 84, 64], tone), look);
  const roof = burnt(shade(mix(pal.roof, [70, 70, 72], 0.5), tone), look);
  const wagon = burnt(shade([96, 62, 46], tone), look);
  const wrecked = look.state === "destroyed";
  dab(ctx, x, y + s * 0.4, s * 22, wrecked ? [20, 17, 15] : pal.mudDark, 0.5, 0.12);
  // The shed: a long brick building, gable end towards us on the left.
  const shedX = x - s * 4;
  const shedW = s * 18;
  const wall = s * 4.2;
  ctx.fillStyle = css(shade(brick, 0.8 * lit));
  ctx.fillRect(shedX - shedW / 2, y - wall, shedW, wall);
  ctx.fillStyle = css(shade(brick, 0.45));
  for (let k = 0; k < 6; k++) ctx.fillRect(shedX - shedW / 2 + s * (1.2 + k * 2.9), y - wall * 0.75, s * 1.4, wall * 0.42);
  if (wrecked) {
    // The roof fallen in: bare rafters against the sky.
    ctx.strokeStyle = css(shade(roof, 0.7));
    ctx.lineWidth = Math.max(0.6, s * 0.12);
    for (let k = 0; k < 9; k++) {
      const rx = shedX - shedW / 2 + (k / 8) * shedW;
      ctx.beginPath();
      ctx.moveTo(rx, y - wall);
      ctx.lineTo(rx + (r() - 0.5) * s, y - wall - s * (0.6 + r() * 1.6));
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = css(shade(roof, 0.9 * lit));
    ctx.beginPath();
    ctx.moveTo(shedX - shedW / 2 - s * 0.4, y - wall);
    ctx.lineTo(shedX - shedW / 2 + s * 1.5, y - wall - s * 2.4);
    ctx.lineTo(shedX + shedW / 2 - s * 1.5, y - wall - s * 2.4);
    ctx.lineTo(shedX + shedW / 2 + s * 0.4, y - wall);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = css(pal.rim, 0.25 * lit);
    ctx.lineWidth = Math.max(0.6, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(shedX - shedW / 2 + s * 1.5, y - wall - s * 2.4);
    ctx.lineTo(shedX + shedW / 2 - s * 1.5, y - wall - s * 2.4);
    ctx.stroke();
  }
  waterTower(ctx, x + s * 10, y, s, burnt(shade([84, 80, 74], tone), look), lit, wrecked);
  // The rails in front, then the wagons standing on them.
  ctx.strokeStyle = css(shade([60, 56, 52], tone * lit));
  ctx.lineWidth = Math.max(0.6, s * 0.09);
  for (const ry of [y + s * 1.1, y + s * 1.5]) {
    ctx.beginPath();
    ctx.moveTo(x - s * 22, ry);
    ctx.lineTo(x + s * 22, ry);
    ctx.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const wx = x - s * 12 + k * s * 7.2;
    if (wrecked && k === 1) overturnedWagon(ctx, wx, y + s * 1.3, s, wagon, lit);
    else boxcar(ctx, wx, y + s * 1.3, s, jitter(wagon, 0.08, r), lit, pal);
  }
}

function boxcar(ctx: Ctx, x: number, y: number, s: number, c: Rgb, lit: number, pal: Palette) {
  const w = s * 6.4;
  const h = s * 3;
  ctx.fillStyle = css(shade(c, 0.85 * lit));
  ctx.fillRect(x - w / 2, y - h - s * 0.6, w, h);
  ctx.fillStyle = css(shade(c, 0.6));
  ctx.fillRect(x - s * 0.9, y - h - s * 0.4, s * 1.8, h * 0.85);
  ctx.fillStyle = css(shade(c, 1.15 * lit));
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - s * 0.15, y - h - s * 0.6);
  ctx.quadraticCurveTo(x, y - h - s * 1.15, x + w / 2 + s * 0.15, y - h - s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css([20, 18, 16]);
  for (const wx of [x - w * 0.32, x + w * 0.32]) {
    ctx.beginPath();
    ctx.arc(wx, y - s * 0.45, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = css(pal.rim, 0.2 * lit);
  ctx.lineWidth = Math.max(0.5, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h - s * 0.62);
  ctx.quadraticCurveTo(x, y - h - s * 1.12, x + w / 2, y - h - s * 0.62);
  ctx.stroke();
}

function overturnedWagon(ctx: Ctx, x: number, y: number, s: number, c: Rgb, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25);
  ctx.fillStyle = css(shade(c, 0.6 * lit));
  ctx.fillRect(-s * 3.2, -s * 2.2, s * 6.4, s * 2.2);
  ctx.fillStyle = css([18, 16, 14]);
  for (const wx of [-s * 2, s * 2]) {
    ctx.beginPath();
    ctx.arc(wx, -s * 2.4, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function waterTower(ctx: Ctx, x: number, y: number, s: number, c: Rgb, lit: number, wrecked: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (wrecked) ctx.rotate(0.18);
  ctx.strokeStyle = css(shade(c, 0.6));
  ctx.lineWidth = Math.max(0.6, s * 0.14);
  for (const lx of [-1.4, 1.4]) {
    ctx.beginPath();
    ctx.moveTo(lx * s, 0);
    ctx.lineTo(lx * s * 0.8, -s * 5);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-s * 1.3, -s * 1.5);
  ctx.lineTo(s * 1.2, -s * 3.4);
  ctx.moveTo(s * 1.3, -s * 1.5);
  ctx.lineTo(-s * 1.2, -s * 3.4);
  ctx.stroke();
  ctx.fillStyle = css(shade(c, 0.9 * lit));
  ctx.fillRect(-s * 1.8, -s * 7.4, s * 3.6, s * 2.5);
  ctx.fillStyle = css(shade(c, 1.15 * lit));
  ctx.fillRect(-s * 1.8, -s * 7.4, s * 3.6, s * 0.3);
  ctx.restore();
}

/* The wireless mast: a tall lattice tower held by guy wires, a hut at its foot, the aerial wire strung away. */

const MAST_FALL_SECONDS = 2.6;

function drawMast(ctx: Ctx, x: number, y: number, s: number, t: Tone, look: TargetLook) {
  const { pal, tone, lit } = t;
  const steel = burnt(shade([70, 72, 70], tone), look);
  const height = s * 22;
  // The mast topples over once destroyed, slowly at first, then all at once.
  const fall = look.state === "destroyed" ? smoothstep(0, 1, clamp(look.since / MAST_FALL_SECONDS)) ** 2 : 0;
  const lean = fall * 1.35;
  const top = { x: x + Math.sin(lean) * height, y: y - Math.cos(lean) * height };
  // Guy wires: taut while it stands, slack once it falls.
  ctx.strokeStyle = css(shade(pal.wire, 1.4 * lit), 0.55);
  ctx.lineWidth = Math.max(0.4, s * 0.03);
  for (const k of [-1, 1]) {
    for (const level of [0.45, 0.85]) {
      const at = { x: x + Math.sin(lean) * height * level, y: y - Math.cos(lean) * height * level };
      ctx.beginPath();
      ctx.moveTo(x + k * s * 11, y + s * 0.3);
      ctx.quadraticCurveTo((x + k * s * 11 + at.x) / 2, (y + at.y) / 2 + fall * s * 3, at.x, at.y);
      ctx.stroke();
    }
  }
  // The aerial wire to a short pole on the right.
  if (fall < 0.05) {
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.quadraticCurveTo(x + s * 8, y - height * 0.6, x + s * 16, y - s * 6);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.6, s * 0.1);
    ctx.strokeStyle = css(shade([72, 60, 44], tone * lit));
    ctx.beginPath();
    ctx.moveTo(x + s * 16, y);
    ctx.lineTo(x + s * 16, y - s * 6);
    ctx.stroke();
  }
  // The lattice: two legs narrowing to the top, crossed all the way up.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  const base = s * 1.1;
  ctx.strokeStyle = css(shade(steel, 0.8 * lit));
  ctx.lineWidth = Math.max(0.6, s * 0.11);
  ctx.beginPath();
  ctx.moveTo(-base, 0);
  ctx.lineTo(-s * 0.2, -height);
  ctx.moveTo(base, 0);
  ctx.lineTo(s * 0.2, -height);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.4, s * 0.05);
  const steps = 16;
  for (let k = 0; k < steps; k++) {
    const y0 = -(k / steps) * height;
    const y1 = -((k + 1) / steps) * height;
    const w0 = base - (base - s * 0.2) * (k / steps);
    const w1 = base - (base - s * 0.2) * ((k + 1) / steps);
    ctx.beginPath();
    ctx.moveTo(-w0, y0);
    ctx.lineTo(w1, y1);
    ctx.moveTo(w0, y0);
    ctx.lineTo(-w1, y1);
    ctx.stroke();
  }
  ctx.restore();
  // The hut at its foot.
  const hutC = burnt(shade(mix([110, 96, 74], pal.mud, 0.3), tone), look);
  ctx.fillStyle = css(shade(hutC, 0.85 * lit));
  ctx.fillRect(x - s * 7, y - s * 2.6, s * 4.6, s * 2.6);
  ctx.fillStyle = css(shade(hutC, 1.1 * lit));
  ctx.beginPath();
  ctx.moveTo(x - s * 7.4, y - s * 2.6);
  ctx.lineTo(x - s * 4.7, y - s * 3.7);
  ctx.lineTo(x - s * 2, y - s * 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(shade(hutC, 0.4));
  ctx.fillRect(x - s * 5.2, y - s * 1.9, s * 1, s * 1.9);
}

/* The convoy: lorries on a road running away from the observer, drawn at their moving positions. */

/** Metres between the lorries of the convoy. */
export const CONVOY_SPACING = 28;

/** One lorry seen end on, at (x, y) on the road, `s` pixels per metre; `wrecked` leaves it burnt and slewed. */
export function drawLorry(ctx: Ctx, x: number, y: number, s: number, appearance: Appearance, lighting: Lighting, wrecked: boolean) {
  const { pal, tone, lit } = toneOf(appearance, lighting);
  const body: Rgb = wrecked ? [30, 26, 22] : shade(mix([88, 90, 68], pal.mudDark, 0.2), tone);
  const tilt: Rgb = wrecked ? [36, 30, 26] : shade(mix([138, 128, 98], pal.mud, 0.25), tone);
  ctx.save();
  ctx.translate(x, y);
  if (wrecked) ctx.rotate(-0.12);
  ctx.fillStyle = css([16, 14, 12]);
  for (const side of [-1, 1]) ctx.fillRect(side * s * 1.1 - s * 0.2, -s * 0.95, s * 0.4, s * 0.95);
  ctx.fillStyle = css(shade(body, 0.85 * lit));
  ctx.fillRect(-s * 1.15, -s * 1.5, s * 2.3, s * 0.75);
  // The canvas tilt over the load: a hooped cover, pale on top.
  const g = ctx.createLinearGradient(0, -s * 3.4, 0, -s * 1.5);
  g.addColorStop(0, css(shade(tilt, 1.2 * lit)));
  g.addColorStop(1, css(shade(tilt, 0.7)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 1.2, -s * 1.5);
  ctx.lineTo(-s * 1.2, -s * 2.8);
  ctx.quadraticCurveTo(0, -s * 3.6, s * 1.2, -s * 2.8);
  ctx.lineTo(s * 1.2, -s * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(shade(tilt, 0.45), 0.8);
  ctx.fillRect(-s * 0.7, -s * 2.6, s * 1.4, s * 1.0);
  ctx.restore();
}

/* ---------- In the side view ---------- */

/**
 * A target side-on, standing on the ground at (x, y), `size` pixels tall:
 * drawn far larger than life, like a symbol on a range diagram, so it reads
 * among the fields kilometres away.
 */
export function drawTargetSide(ctx: Ctx, look: TargetLook, x: number, y: number, size: number, appearance: Appearance, time = 0) {
  const pal = paletteFor(appearance);
  const night = appearance === "night";
  const ink: Rgb = look.state === "destroyed" ? (night ? [10, 10, 12] : [36, 30, 26]) : night ? [16, 18, 22] : mix(pal.near, [52, 48, 40], 0.4);
  const u = size / 10;
  ctx.save();
  ctx.fillStyle = css(ink);
  ctx.strokeStyle = css(ink);
  ctx.lineCap = "round";
  const down = look.state === "destroyed";
  switch (look.kind) {
    case "dump":
      if (down) for (let k = 0; k < 7; k++) ctx.fillRect(x - u * 7 + k * u * 2.2, y - u * (0.6 + (k % 3) * 0.4), u * 1.6, u * 0.8);
      else {
        for (let row = 0; row < 3; row++) ctx.fillRect(x - u * 6 + row * u, y - u * (row + 1) * 1.4, u * (8 - row * 2), u * 1.35);
        ctx.beginPath();
        ctx.ellipse(x + u * 5, y, u * 3, u * 3.2, 0, Math.PI, 0);
        ctx.fill();
      }
      break;
    case "battery":
      for (const gx of [-3, 3]) {
        if (down && gx > 0) {
          ctx.fillRect(x + gx * u - u * 1.5, y - u * 1.2, u * 3, u * 1.2);
          continue;
        }
        ctx.beginPath();
        ctx.arc(x + gx * u, y - u * 1.4, u * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + gx * u - u * 0.4, y - u * 3.6, u * 1.6, u * 2.4);
        ctx.save();
        ctx.translate(x + gx * u, y - u * 2.4);
        ctx.rotate(Math.PI + 0.45);
        ctx.fillRect(0, -u * 0.35, u * 4, u * 0.7);
        ctx.restore();
      }
      if (!down) {
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(x - u * 7, y);
        ctx.lineTo(x - u * 6, y - u * 5.2);
        ctx.quadraticCurveTo(x, y - u * 4, x + u * 6, y - u * 5.2);
        ctx.lineTo(x + u * 7, y);
        ctx.lineTo(x + u * 5.5, y - u * 3.8);
        ctx.quadraticCurveTo(x, y - u * 2.8, x - u * 5.5, y - u * 3.8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
    case "bridge": {
      const deck = y - u * 4;
      const spans = down ? [0, 2] : [0, 1, 2];
      for (const k of spans) {
        const left = x - u * 9 + k * u * 6;
        ctx.beginPath();
        ctx.moveTo(left, deck);
        ctx.lineTo(left + u * 6, deck);
        ctx.lineTo(left + u * 6, y);
        ctx.ellipse(left + u * 3, y, u * 2.2, u * 2.6, 0, 0, Math.PI, true);
        ctx.lineTo(left, y);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "railyard":
      ctx.beginPath();
      ctx.moveTo(x - u * 8, y - u * 3);
      ctx.lineTo(x - u * 6, y - u * 5.4);
      ctx.lineTo(x + u * 1, y - u * 5.4);
      ctx.lineTo(x + u * 3, y - u * 3);
      ctx.lineTo(x + u * 3, y);
      ctx.lineTo(x - u * 8, y);
      ctx.closePath();
      if (!down) ctx.fill();
      else ctx.fillRect(x - u * 8, y - u * 2.2, u * 11, u * 2.2);
      for (let k = 0; k < 2; k++) ctx.fillRect(x + u * 4 + k * u * 3.6, y - u * 2.6, u * 3.2, u * 2.2);
      break;
    case "mast": {
      const fall = down ? smoothstep(0, 1, clamp(look.since / MAST_FALL_SECONDS)) ** 2 * 1.4 : 0;
      ctx.lineWidth = Math.max(1, u * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(fall) * u * 16, y - Math.cos(fall) * u * 16);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.6, u * 0.15);
      if (!down) {
        ctx.beginPath();
        ctx.moveTo(x - u * 6, y);
        ctx.lineTo(x, y - u * 11);
        ctx.lineTo(x + u * 6, y);
        ctx.stroke();
      }
      ctx.fillRect(x - u * 5, y - u * 2, u * 3, u * 2);
      break;
    }
    case "convoy":
      for (let k = 0; k < 3; k++) {
        const lx = x + (k - 1) * u * 4.2;
        const bob = down ? 0 : Math.sin(time * 9 + k) * u * 0.08;
        ctx.fillRect(lx - u * 1.6, y - u * 2.6 + bob, u * 2.4, u * 1.8);
        ctx.fillRect(lx + u * 0.8, y - u * 1.9 + bob, u * 1, u * 1.1);
        ctx.beginPath();
        ctx.arc(lx - u * 0.9, y - u * 0.45, u * 0.45, 0, Math.PI * 2);
        ctx.arc(lx + u * 1.1, y - u * 0.45, u * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
  ctx.restore();
}
