/*
 * The release: the last page of a survived pit. We stand on the pit floor
 * and look up at the far wall: a rope ladder has unrolled down it, the kid
 * climbs out against a sun (or moon) rising behind the rim, and in front of
 * us the rabbit sulks. Drawn flat on the screen, as a picture-book spread.
 */

import { critters, paperFinish, softEllipse } from "./fx";
import { flower, FLOWER_KINDS, pebble, toadstool, tuft } from "./flora";
import { drawKid, STANDING, type KidPose } from "./kid";
import { lookFor, type Look } from "./look";
import { alpha, fbm2, mix, noise2, paperTile, scatter, taperedStroke, type Pt } from "./paint";
import type { ReleaseMoment } from "../style";
import { drawRabbit, RESTING } from "./rabbit";

export type { ReleaseMoment } from "../style";

type Layout = {
  w: number;
  h: number;
  centreX: number;
  rimY: (x: number) => number;
  floorY: (x: number) => number;
  ladderX: number;
  sun: Pt & { r: number };
};

function layoutFor(w: number, h: number): Layout {
  const centreX = w * 0.585;
  return {
    w,
    h,
    centreX,
    // Inside a round pit the rim is nearest at the sides, so it rises towards the edges of the picture.
    rimY: (x) => h * 0.47 - h * 0.34 * ((x - centreX) / w) ** 2,
    floorY: (x) => h * 0.8 + h * 0.22 * ((x - centreX) / w) ** 2,
    ladderX: centreX,
    sun: { x: centreX + w * 0.012, y: h * 0.47, r: h * 0.17 },
  };
}

export class StorybookRelease {
  look: Look = lookFor(false);
  private width = 1;
  private height = 1;
  private dpr = 1;
  private sky: HTMLCanvasElement | null = null;
  private land: HTMLCanvasElement | null = null;
  private paper: CanvasPattern | null = null;

  constructor(readonly ctx: CanvasRenderingContext2D) {}

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.rebuild();
  }

  setNight(night: boolean) {
    if (this.look.night === night) return;
    this.look = lookFor(night);
    if (this.sky) this.rebuild();
  }

  private rebuild() {
    const make = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(this.width * this.dpr);
      canvas.height = Math.round(this.height * this.dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(this.dpr, this.dpr);
      return { canvas, ctx };
    };
    const layout = layoutFor(this.width, this.height);
    const sky = make();
    paintSky(sky.ctx, this.look, layout);
    const land = make();
    paintHills(land.ctx, this.look, layout);
    paintWall(land.ctx, this.look, layout);
    paintFloor(land.ctx, this.look, layout);
    this.sky = sky.canvas;
    this.land = land.canvas;
    this.paper = this.ctx.createPattern(paperTile(256, 5), "repeat");
  }

  draw(moment: ReleaseMoment) {
    const ctx = this.ctx;
    const look = this.look;
    const layout = layoutFor(this.width, this.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.sky || !this.land) return;
    ctx.drawImage(this.sky, 0, 0, this.width, this.height);
    const disc = { ...layout.sun, y: layout.sun.y - layout.sun.r * 0.55 * moment.rise };
    drawDisc(ctx, look, disc, moment.time);
    ctx.drawImage(this.land, 0, 0, this.width, this.height);

    ladder(ctx, look, layout, moment);
    kidOnLadder(ctx, look, layout, moment, disc);
    sulkingRabbit(ctx, look, layout, moment.time, !moment.hat);
    airborne(ctx, look, layout, moment.time);
    if (this.paper) paperFinish(ctx, look, this.paper, this.width, this.height);
  }
}

/* ---------- Sky ---------- */

function paintSky(ctx: CanvasRenderingContext2D, look: Look, l: Layout) {
  const s = look.sky;
  const g = ctx.createLinearGradient(0, 0, 0, l.h * 0.5);
  g.addColorStop(0, s.top);
  g.addColorStop(0.55, s.middle);
  g.addColorStop(1, s.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, l.w, l.h);
  // The glow of the coming sun or moon spreads along the horizon.
  softEllipse(ctx, { x: l.sun.x, y: l.sun.y }, l.w * 0.5, l.h * 0.32, 0, s.glow, look.night ? 0.35 : 0.55, 1);

  const rand = scatter(91);
  if (look.night) {
    for (let i = 0; i < 260; i++) {
      const x = rand() * l.w;
      const y = rand() * l.h * 0.46;
      const bright = rand() ** 3;
      ctx.fillStyle = alpha("#fffbe8", 0.3 + bright * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + bright * 1.6, 0, Math.PI * 2);
      ctx.fill();
      if (bright > 0.75) {
        ctx.strokeStyle = alpha("#fffbe8", 0.5);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
      }
    }
  }
  // Picture-book clouds: soft heaps with an inked underside.
  const clouds: [number, number, number][] = [
    [0.14, 0.15, 1],
    [0.36, 0.09, 0.7],
    [0.83, 0.18, 0.9],
    [0.66, 0.06, 0.55],
  ];
  for (const [cx, cy, size] of clouds) cloud(ctx, look, cx * l.w, cy * l.h, l.h * 0.11 * size, rand);
}

function cloud(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number, rand: () => number) {
  const puffs = Array.from({ length: 7 }, (_, i) => ({
    x: x + (i - 3) * size * 0.42 + (rand() - 0.5) * size * 0.2,
    y: y - Math.sin((i / 6) * Math.PI) * size * 0.35 + (rand() - 0.5) * size * 0.1,
    r: size * (0.35 + Math.sin((i / 6) * Math.PI) * 0.3 + rand() * 0.1),
  }));
  const fill = look.sky.cloud;
  ctx.save();
  ctx.beginPath();
  for (const p of puffs) {
    ctx.moveTo(p.x + p.r, p.y);
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  }
  for (let i = 0; i < 5; i++) {
    const bx = x + (i - 2) * size * 0.55;
    ctx.moveTo(bx + size * 0.4, y + size * 0.05);
    ctx.ellipse(bx, y + size * 0.05, size * 0.4, size * 0.2, 0, 0, Math.PI * 2);
  }
  ctx.fillStyle = alpha(fill, look.night ? 0.55 : 0.92);
  ctx.fill();
  ctx.clip();
  // Shade along the bottom, light on top: the light comes from the low sun behind the pit.
  const shade = ctx.createLinearGradient(0, y - size, 0, y + size * 0.3);
  shade.addColorStop(0, alpha(look.night ? "#c9d4ff" : "#fff6dc", look.night ? 0.25 : 0.6));
  shade.addColorStop(1, alpha(look.night ? "#0b1230" : "#e4b98f", 0.45));
  ctx.fillStyle = shade;
  ctx.fillRect(x - size * 2, y - size * 1.4, size * 4, size * 2);
  ctx.restore();
}

function drawDisc(ctx: CanvasRenderingContext2D, look: Look, disc: Pt & { r: number }, time: number) {
  const s = look.sky;
  softEllipse(ctx, disc, disc.r * 2.6, disc.r * 2.6, 0, s.glow, look.night ? 0.32 : 0.55, 1);
  if (!look.night) {
    // Long soft rays fanning out from the sun.
    ctx.save();
    ctx.translate(disc.x, disc.y);
    ctx.rotate(time * 0.03);
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      const g = ctx.createLinearGradient(0, 0, disc.r * 3.4, 0);
      g.addColorStop(0, alpha("#fff3c4", 0.32));
      g.addColorStop(1, alpha("#fff3c4", 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(disc.r * 0.8, -disc.r * 0.1);
      ctx.lineTo(disc.r * 3.4, -disc.r * 0.32);
      ctx.lineTo(disc.r * 3.4, disc.r * 0.32);
      ctx.lineTo(disc.r * 0.8, disc.r * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.fillStyle = s.disc;
  ctx.beginPath();
  ctx.arc(disc.x, disc.y, disc.r, 0, Math.PI * 2);
  ctx.fill();
  if (look.night) {
    // The man in the moon's seas: soft grey blotches.
    ctx.save();
    ctx.clip();
    for (const [dx, dy, r] of [
      [-0.3, -0.25, 0.28],
      [0.22, -0.05, 0.2],
      [-0.05, 0.35, 0.24],
      [0.38, 0.38, 0.12],
    ]) {
      softEllipse(ctx, { x: disc.x + dx * disc.r, y: disc.y + dy * disc.r }, r * disc.r, r * disc.r * 0.85, 0.3, "#c8c2a8", 0.55, 0.6);
    }
    ctx.restore();
  }
  ctx.strokeStyle = alpha(look.night ? "#ffffff" : "#ffffff", 0.6);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ---------- Hills beyond the rim ---------- */

function paintHills(ctx: CanvasRenderingContext2D, look: Look, l: Layout) {
  const ranges: { base: number; height: number; seed: number }[] = [
    { base: l.h * 0.44, height: l.h * 0.09, seed: 3 },
    { base: l.h * 0.455, height: l.h * 0.06, seed: 9 },
    { base: l.h * 0.47, height: l.h * 0.04, seed: 15 },
  ];
  ranges.forEach((range, i) => {
    const color = look.sky.hills[i];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, l.h);
    for (let x = 0; x <= l.w; x += 8) {
      const y = range.base - fbm2(x / (l.w * 0.22), range.seed, range.seed, 3) * range.height;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(l.w, l.h);
    ctx.closePath();
    ctx.fill();
    // Round storybook trees along the nearer ridges.
    if (i > 0) {
      const rand = scatter(range.seed * 7);
      for (let k = 0; k < 16; k++) {
        const x = rand() * l.w;
        const y = range.base - fbm2(x / (l.w * 0.22), range.seed, range.seed, 3) * range.height + 2;
        const r = l.h * (0.008 + rand() * 0.008) * (i === 2 ? 1.4 : 1);
        ctx.fillStyle = mix(color, look.night ? "#000000" : "#2e4a2a", 0.25);
        ctx.fillRect(x - r * 0.12, y - r * 1.2, r * 0.24, r * 1.2);
        ctx.beginPath();
        ctx.arc(x, y - r * 1.6, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  // A cottage on the far hill, its window lit at night.
  const cx = l.w * 0.3;
  const cy = l.h * 0.445 - fbm2(cx / (l.w * 0.22), 9, 9, 3) * l.h * 0.06;
  const u = l.h * 0.012;
  ctx.fillStyle = look.night ? "#1a2638" : "#c9b48f";
  ctx.fillRect(cx - u * 1.6, cy - u * 2, u * 3.2, u * 2);
  ctx.fillStyle = look.night ? "#2a2030" : "#b5583e";
  ctx.beginPath();
  ctx.moveTo(cx - u * 2, cy - u * 2);
  ctx.lineTo(cx, cy - u * 3.6);
  ctx.lineTo(cx + u * 2, cy - u * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = look.night ? "#ffd47a" : "#5a4a3a";
  ctx.fillRect(cx - u * 0.5, cy - u * 1.4, u * 0.8, u * 0.7);
  if (look.night) softEllipse(ctx, { x: cx, y: cy - u }, u * 3, u * 3, 0, "#ffc860", 0.35, 1);
}

/* ---------- The far wall ---------- */

function wallPath(ctx: CanvasRenderingContext2D, l: Layout, top: (x: number) => number, bottom: (x: number) => number) {
  ctx.beginPath();
  ctx.moveTo(0, top(0));
  for (let x = 0; x <= l.w; x += 10) ctx.lineTo(x, top(x));
  for (let x = l.w; x >= 0; x -= 10) ctx.lineTo(x, bottom(x));
  ctx.closePath();
}

function paintWall(ctx: CanvasRenderingContext2D, look: Look, l: Layout) {
  const e = look.earth;
  const between = (k: number) => (x: number) => l.rimY(x) + (l.floorY(x) - l.rimY(x)) * k + (noise2(x / 60, k * 9, 4) - 0.5) * l.h * 0.012;
  const bands: [number, number, string][] = [
    [0, 0.12, e.topsoil],
    [0.12, 0.3, mix(e.topsoil, e.wall, 0.6)],
    [0.3, 0.55, e.wall],
    [0.55, 0.72, e.clay],
    [0.72, 0.88, mix(e.clay, e.sand, 0.5)],
    [0.88, 1.02, e.sand],
  ];
  for (const [a, b, color] of bands) {
    ctx.fillStyle = color;
    wallPath(ctx, l, a === 0 ? l.rimY : between(a), between(b));
    ctx.fill();
  }
  // Backlit: the wall is in its own shadow, darkest just under the rim; the sides curve away into shade.
  ctx.save();
  wallPath(ctx, l, l.rimY, l.floorY);
  ctx.clip();
  const shade = ctx.createLinearGradient(0, l.h * 0.4, 0, l.h * 0.82);
  shade.addColorStop(0, alpha(look.shadow, look.night ? 0.62 : 0.42));
  shade.addColorStop(1, alpha(look.shadow, look.night ? 0.25 : 0.06));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, l.w, l.h);
  const sides = ctx.createLinearGradient(0, 0, l.w, 0);
  sides.addColorStop(0, alpha(look.shadow, 0.45));
  sides.addColorStop(0.35, alpha(look.shadow, 0));
  sides.addColorStop(0.75, alpha(look.shadow, 0));
  sides.addColorStop(1, alpha(look.shadow, 0.45));
  ctx.fillStyle = sides;
  ctx.fillRect(0, 0, l.w, l.h);

  const rand = scatter(57);
  for (let i = 0; i < 46; i++) {
    const x = rand() * l.w;
    const k = 0.15 + rand() * 0.8;
    const y = l.rimY(x) + (l.floorY(x) - l.rimY(x)) * k;
    const size = l.h * (0.006 + rand() * 0.012) * (1 + Math.abs(x - l.centreX) / l.w);
    pebble(ctx, look, x, y, size, size * (0.6 + rand() * 0.3), e.pebble[i % e.pebble.length], rand() - 0.5);
  }
  // Roots, thick and tangled near the top.
  for (let i = 0; i < 70; i++) {
    const x0 = rand() * l.w;
    const length = l.h * (0.04 + rand() * rand() * 0.2);
    const pts: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      pts.push({ x: x0 + (noise2(t * 3, i, 8) - 0.5) * l.h * 0.04, y: l.rimY(x0) + l.h * 0.008 + t * length });
    }
    const width = l.h * (0.004 + rand() * 0.006);
    ctx.fillStyle = alpha(look.ink, 0.45);
    taperedStroke(ctx, pts.map((p) => ({ x: p.x + 1.2, y: p.y + 1.2 })), width * 1.3, 0, 1);
    ctx.fillStyle = e.root;
    taperedStroke(ctx, pts, width, 0, 1);
  }
  ctx.restore();

  // The rim: turf against the sky, grass blades lit along their edges.
  ctx.strokeStyle = alpha(look.ink, 0.8);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= l.w; x += 10) {
    if (x === 0) ctx.moveTo(x, l.rimY(x));
    else ctx.lineTo(x, l.rimY(x));
  }
  ctx.stroke();
  const blades = look.night ? ["#16262c", "#1d3338", "#24403f"] : ["#4f6b36", "#5f7f40", "#6f8f48"];
  for (let x = -10; x < l.w + 10; x += 4) {
    const y = l.rimY(x) + 2;
    const near = 1 + Math.abs(x - l.centreX) / l.w;
    tuft(ctx, x, y, l.h * 0.028 * near * (0.7 + rand() * 0.6), blades, rand, (rand() - 0.5) * 0.4);
  }
  for (let i = 0; i < 26; i++) {
    const x = rand() * l.w;
    if (Math.abs(x - l.ladderX) < l.w * 0.05) continue;
    const near = 1 + Math.abs(x - l.centreX) / l.w;
    flower(ctx, look, FLOWER_KINDS[i % FLOWER_KINDS.length], x, l.rimY(x) + 2, l.h * 0.014 * near, rand);
  }
  toadstool(ctx, look, l.w * 0.08, l.rimY(l.w * 0.08) + 4, l.h * 0.05, rand);
  toadstool(ctx, look, l.w * 0.115, l.rimY(l.w * 0.115) + 3, l.h * 0.034, rand);
  toadstool(ctx, look, l.w * 0.92, l.rimY(l.w * 0.92) + 4, l.h * 0.042, rand);
}

/* ---------- The floor in front ---------- */

function paintFloor(ctx: CanvasRenderingContext2D, look: Look, l: Layout) {
  const f = look.floor;
  ctx.beginPath();
  ctx.moveTo(0, l.floorY(0));
  for (let x = 0; x <= l.w; x += 10) ctx.lineTo(x, l.floorY(x));
  ctx.lineTo(l.w, l.h);
  ctx.lineTo(0, l.h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, l.h * 0.78, 0, l.h);
  g.addColorStop(0, f.dark);
  g.addColorStop(0.3, f.base);
  g.addColorStop(1, f.light);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const rand = scatter(23);
  for (let i = 0; i < 500; i++) {
    const x = rand() * l.w;
    const y = l.floorY(x) + rand() * (l.h - l.floorY(x));
    const depth = (y - l.h * 0.8) / (l.h * 0.2);
    ctx.fillStyle = alpha(rand() < 0.6 ? f.speck : f.light, 0.5);
    ctx.beginPath();
    ctx.ellipse(x, y, 1 + depth * 3 * rand(), 0.6 + depth * 1.6 * rand(), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = rand() * l.w;
    const y = l.floorY(x) + rand() * (l.h - l.floorY(x));
    const depth = 0.4 + (y - l.h * 0.8) / (l.h * 0.2);
    pebble(ctx, look, x, y, l.h * 0.01 * depth * 1.6, l.h * 0.006 * depth * 1.6, look.earth.pebble[i % 4], rand() - 0.5);
  }
  for (let i = 0; i < 12; i++) {
    const x = rand() * l.w;
    const y = l.floorY(x) + 4 + rand() * l.h * 0.06;
    tuft(ctx, x, y, l.h * 0.03, look.meadow.blades.slice(0, 3), rand, (rand() - 0.5) * 0.4);
  }
  // The kid's boot prints, wandering in from the front to the foot of the ladder.
  ctx.fillStyle = alpha(f.spot, look.night ? 0.45 : 0.32);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = l.w * 0.86 + (l.ladderX - l.w * 0.86) * t + Math.sin(t * 5) * l.w * 0.02 + (i % 2 ? l.w * 0.012 : -l.w * 0.012);
    const y = l.h * 0.99 + (l.floorY(l.ladderX) + l.h * 0.03 - l.h * 0.99) * t;
    const near = 1.4 - t * 0.7;
    ctx.beginPath();
    ctx.ellipse(x, y, l.h * 0.014 * near, l.h * 0.006 * near, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Long shadows from the light behind the far wall reach towards us.
  const shade = ctx.createLinearGradient(0, l.h * 0.78, 0, l.h * 0.9);
  shade.addColorStop(0, alpha(look.shadow, look.night ? 0.55 : 0.35));
  shade.addColorStop(1, alpha(look.shadow, 0));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, l.w, l.h);
  ctx.restore();
}

/* ---------- The ladder, the kid, the rabbit ---------- */

function ladder(ctx: CanvasRenderingContext2D, look: Look, l: Layout, m: ReleaseMoment) {
  const top = l.rimY(l.ladderX) + 4;
  const bottom = l.floorY(l.ladderX) + l.h * 0.01;
  const reach = top + (bottom - top) * m.ladder;
  const sway = Math.sin(m.time * 1.6) * l.h * 0.003;
  const halfTop = l.h * 0.03;
  const halfBottom = l.h * 0.036;
  const rope = look.night ? "#b49a6a" : "#d9b779";
  const rung = look.night ? "#6d5338" : "#a8703e";
  const at = (t: number, side: -1 | 1) => {
    const y = top + (reach - top) * t;
    const half = halfTop + (halfBottom - halfTop) * t;
    return { x: l.ladderX + side * half + Math.sin(t * Math.PI) * sway, y };
  };
  // The stake it is tied to, driven into the turf.
  ctx.fillStyle = look.night ? "#4a3a2c" : "#8a6040";
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = 2;
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.roundRect(l.ladderX + side * halfTop * 1.25 - l.h * 0.006, top - l.h * 0.05, l.h * 0.012, l.h * 0.06, 2);
    ctx.fill();
    ctx.stroke();
  }
  const rungs = Math.floor(9 * m.ladder) + 1;
  for (let i = 0; i < rungs; i++) {
    const t = (i + 0.5) / 9 / Math.max(0.05, m.ladder);
    if (t > 1) break;
    const a = at(t, -1);
    const b = at(t, 1);
    ctx.fillStyle = alpha(look.shadow, 0.35);
    ctx.fillRect(a.x - 2, a.y + 4, b.x - a.x + 4, l.h * 0.008);
    ctx.fillStyle = rung;
    ctx.beginPath();
    ctx.roundRect(a.x - 4, a.y - l.h * 0.005, b.x - a.x + 8, l.h * 0.011, 2);
    ctx.fill();
    ctx.stroke();
  }
  for (const side of [-1, 1] as const) {
    ctx.strokeStyle = look.ink;
    ctx.lineWidth = l.h * 0.007;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) {
      const p = at(k / 20, side);
      if (k === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.strokeStyle = rope;
    ctx.lineWidth = l.h * 0.0045;
    ctx.stroke();
  }
  // Still rolled up: the bundle bouncing at the end of the ropes.
  if (m.ladder < 0.98) {
    const end = at(1, -1);
    ctx.fillStyle = rung;
    ctx.beginPath();
    ctx.ellipse(l.ladderX, end.y + l.h * 0.01, halfTop * 1.3, l.h * 0.016, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function kidOnLadder(ctx: CanvasRenderingContext2D, look: Look, l: Layout, m: ReleaseMoment, disc: Pt & { r: number }) {
  const top = l.rimY(l.ladderX) + 2;
  const bottom = l.floorY(l.ladderX);
  const scale = l.h * 0.13;
  const standing = m.cheer > 0;
  const x = standing ? l.ladderX + l.w * 0.035 * m.cheer : l.ladderX;
  const y = standing ? top + 3 : bottom - (bottom - top) * m.climb + scale * 0.2;
  // One rung per step, the feet taking turns and each hand reaching with the opposite foot.
  const stride = Math.sin(m.climb * Math.PI * 9);
  const bob = standing ? -Math.abs(Math.sin(m.time * 5)) * scale * 0.05 * m.cheer : -Math.abs(stride) * scale * 0.04;
  const pose: KidPose = standing
    ? {
        ...STANDING,
        time: m.time,
        face: "joy",
        hat: m.hat,
        hands: { left: { x: -0.62, y: -1.62 + Math.sin(m.time * 6) * 0.05 }, right: { x: 0.64, y: -1.66 - Math.sin(m.time * 6) * 0.05 } },
        wind: { x: 0.55, y: 0.1 },
      }
    : {
        ...STANDING,
        time: m.time,
        back: true,
        legs: "climb",
        stride,
        hat: m.hat,
        hands: { left: { x: -0.32, y: -1.6 + stride * 0.16 }, right: { x: 0.32, y: -1.6 - stride * 0.16 } },
        wind: { x: 0.6, y: 0.2 },
      };
  // Backlit: a bright edge where the disc shines round the kid.
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);
  const toward = { x: (disc.x - x) / disc.r, y: -0.9 };
  const len = Math.hypot(toward.x, toward.y);
  const rimLight = { ...look, lightScreen: { x: toward.x / len, y: toward.y / len }, kid: { ...look.kid, rim: look.night ? "#fff8dc" : "#fff4c8" } };
  drawKid(ctx, rimLight, pose);
  ctx.restore();
}

/** The rabbit sulking in front, in the kid's bobble hat if it got hold of it. */
function sulkingRabbit(ctx: CanvasRenderingContext2D, look: Look, l: Layout, time: number, wearsHat: boolean) {
  const scale = l.h * 0.19;
  const foot = { x: l.w * 0.19, y: l.h * 0.985 };
  softEllipse(ctx, { x: foot.x + scale * 0.1, y: foot.y - scale * 0.02 }, scale * 0.85, scale * 0.12, 0, look.shadow, look.night ? 0.6 : 0.4, 0.5);
  const tap = Math.max(0, Math.sin(time * 4)) * 0.04;
  ctx.save();
  ctx.translate(foot.x, foot.y);
  ctx.scale(-scale, scale);
  drawRabbit(ctx, look, {
    ...RESTING,
    time,
    sulk: 1,
    squash: 0.97 + tap * 0.3,
    menace: look.night ? 0.62 : 0,
    look: { x: -0.8, y: -0.4 },
    nose: Math.sin(time * 3) * 0.3,
    wearsHat,
  });
  ctx.restore();
  grumble(ctx, look, { x: foot.x - scale * 0.1, y: foot.y - scale * 2.3 }, scale * 0.42, time);
}

/** A storybook grumble: a small dark cloud over a cross head, with a zigzag of temper. */
function grumble(ctx: CanvasRenderingContext2D, look: Look, at: Pt, size: number, time: number) {
  const drift = Math.sin(time * 1.5) * size * 0.05;
  ctx.save();
  ctx.translate(at.x + drift, at.y);
  ctx.lineJoin = "round";
  ctx.strokeStyle = look.ink;
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.fillStyle = look.night ? "#3a3f5c" : "#6d6a78";
  ctx.beginPath();
  for (const [x, y, r] of [
    [-0.45, 0.05, 0.3],
    [-0.1, -0.15, 0.38],
    [0.3, -0.05, 0.32],
    [0.55, 0.1, 0.22],
    [0.05, 0.15, 0.3],
  ]) {
    ctx.moveTo((x + r) * size, y * size);
    ctx.arc(x * size, y * size, r * size, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.fill();
  ctx.fillStyle = look.night ? "#ffe27a" : "#ffd23f";
  ctx.beginPath();
  ctx.moveTo(0.02 * size, 0.3 * size);
  ctx.lineTo(-0.14 * size, 0.62 * size);
  ctx.lineTo(0.02 * size, 0.6 * size);
  ctx.lineTo(-0.1 * size, 0.92 * size);
  ctx.lineTo(0.2 * size, 0.5 * size);
  ctx.lineTo(0.04 * size, 0.52 * size);
  ctx.lineTo(0.16 * size, 0.3 * size);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function airborne(ctx: CanvasRenderingContext2D, look: Look, l: Layout, time: number) {
  if (look.night) {
    critters(ctx, look, l.w, l.h, time, 14);
    return;
  }
  // Dandelion seeds drifting through the sunlight.
  for (let i = 0; i < 18; i++) {
    const x = ((i * 137.5 + time * (12 + (i % 5) * 4)) % (l.w + 100)) - 50;
    const y = l.h * (0.15 + 0.6 * noise2(i, time * 0.1, 5));
    ctx.strokeStyle = alpha("#fffdf0", 0.8);
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + time;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      ctx.stroke();
    }
    ctx.fillStyle = alpha("#8a7a5a", 0.8);
    ctx.fillRect(x - 0.5, y, 1, 6);
  }
  critters(ctx, look, l.w, l.h * 0.6, time, 3);
}
