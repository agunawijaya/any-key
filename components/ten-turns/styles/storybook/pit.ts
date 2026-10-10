/*
 * The pit in the meadow, painted once into a backdrop and kept until the
 * window or the appearance changes. The pit is a bowl of earth: a floor 10.8
 * units across the middle, walls that lean out as they rise, and a grassy rim.
 * The painting order does the depth work: each ring of the wall is painted
 * as a whole disc, from the rim down, so the far wall shows as bands.
 */

import { PitCamera, type ScreenPoint } from "../../scene/camera";
import { flower, FLOWER_KINDS, pebble, toadstool, tuft } from "./flora";
import { blooms, lostThings, rabbitTracks } from "./floorStory";
import type { Look } from "./look";
import { alpha, fbm2, mix, noise2, scatter, taperedStroke, type Pt } from "./paint";

/** The bowl of earth around a playing circle of a given radius. */
export type PitShape = {
  /** The playing circle: cells at most this far from the centre. */
  lattice: number;
  floor: number;
  depth: number;
  rim: number;
};

export const pitShape = (lattice: number): PitShape => ({ lattice, floor: lattice + 0.85, depth: 3.3, rim: lattice + 2.95 });

/** The original's pit, radius 10. */
export const PIT = pitShape(10);

/** The wall's radius at height z, from the floor to the rim. */
export const wallRadius = (shape: PitShape, z: number) => shape.floor + (shape.rim - shape.floor) * (z / shape.depth);

export function pitCamera(width: number, height: number, shape: PitShape = PIT): PitCamera {
  const camera = new PitCamera({ pitch: (54 * Math.PI) / 180, distance: 66 });
  const rim: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    rim.push({ x: Math.cos(a) * (shape.rim + 0.2), y: Math.sin(a) * (shape.rim + 0.2), z: shape.depth });
  }
  camera.fit(rim, { left: width * 0.14, top: height * 0.045, width: width * 0.72, height: height * 0.92 });
  return camera;
}

/** A ring of the pit at height z, projected; `wobble` bends it for hand-drawn strata. */
export function ring(camera: PitCamera, radius: number, z: number, segments = 180, wobble?: (angle: number) => number): ScreenPoint[] {
  const pts: ScreenPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const r = radius + (wobble ? wobble(a) : 0);
    pts.push(camera.project(Math.cos(a) * r, Math.sin(a) * r, z));
  }
  return pts;
}

function polygon(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Does the inside of the wall at this angle and height face the camera? */
function wallFacesCamera(camera: PitCamera, shape: PitShape, angle: number, z: number) {
  const r = wallRadius(shape, z);
  const run = shape.rim - shape.floor;
  const normal = { x: -Math.cos(angle) * shape.depth, y: -Math.sin(angle) * shape.depth, z: run };
  const eye = camera.eye;
  return normal.x * (eye.x - Math.cos(angle) * r) + normal.y * (eye.y - Math.sin(angle) * r) + normal.z * (eye.z - z) > 0;
}

export type PitLayers = { backdrop: HTMLCanvasElement; foreground: HTMLCanvasElement };

/** Paints the meadow and the pit for one size and one look. */
export function paintPit(camera: PitCamera, look: Look, width: number, height: number, dpr: number, shape: PitShape = PIT, options: { grid?: boolean } = {}, seed = 7): PitLayers {
  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    return { canvas, ctx };
  };
  const back = make();
  const front = make();

  meadow(back.ctx, camera, shape, look, width, height, seed);
  const rimRing = ring(camera, shape.rim, shape.depth, 220, (a) => (noise2(a * 6, 1, seed) - 0.5) * 0.25);
  back.ctx.save();
  back.ctx.beginPath();
  polygon(back.ctx, rimRing);
  back.ctx.clip();
  walls(back.ctx, camera, shape, look, seed);
  floor(back.ctx, camera, shape, look, seed, options.grid ?? true);
  back.ctx.restore();
  rimEdge(back.ctx, front.ctx, camera, shape, look, rimRing, seed);
  grade(back.ctx, look, width, height);
  return { backdrop: back.canvas, foreground: front.canvas };
}

/* ---------- The meadow ---------- */

function meadow(ctx: CanvasRenderingContext2D, camera: PitCamera, shape: PitShape, look: Look, width: number, height: number, seed: number) {
  const m = look.meadow;
  ctx.fillStyle = m.base;
  ctx.fillRect(0, 0, width, height);

  // Painterly mottling: overlapping dabs whose colour follows a noise field on the ground.
  const step = 18;
  const rand = scatter(seed);
  for (let sy = -step; sy < height + step; sy += step * 0.8) {
    for (let sx = -step; sx < width + step; sx += step) {
      const jx = sx + (rand() - 0.5) * step;
      const jy = sy + (rand() - 0.5) * step;
      const g = camera.toPlane(jx, jy, shape.depth);
      const n = fbm2(g.x * 0.16, g.y * 0.16, seed, 4);
      const tone = n < 0.45 ? mix(m.shade, m.base, n / 0.45) : mix(m.base, m.lit, (n - 0.45) / 0.55);
      ctx.fillStyle = alpha(hexOf(tone), 0.55);
      ctx.beginPath();
      ctx.ellipse(jx, jy, step * (0.7 + rand() * 0.5), step * (0.45 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tufts and flowers, back to front so nearer ones overlap farther ones.
  const corners = [camera.toPlane(0, 0, shape.depth), camera.toPlane(width, 0, shape.depth), camera.toPlane(0, height, shape.depth), camera.toPlane(width, height, shape.depth)];
  const minX = Math.min(...corners.map((c) => c.x)) - 1;
  const maxX = Math.max(...corners.map((c) => c.x)) + 1;
  const minY = Math.min(...corners.map((c) => c.y)) - 1;
  const maxY = Math.max(...corners.map((c) => c.y)) + 1;
  const grid = 0.42;
  for (let wy = maxY; wy > minY; wy -= grid) {
    for (let wx = minX; wx < maxX; wx += grid) {
      const x = wx + (rand() - 0.5) * grid;
      const y = wy + (rand() - 0.5) * grid;
      const r = Math.hypot(x, y);
      if (r < shape.rim + 0.35) continue;
      const s = camera.project(x, y, shape.depth);
      if (s.x < -30 || s.x > width + 30 || s.y < -10 || s.y > height + 40) continue;
      const lush = fbm2(x * 0.22, y * 0.22, seed + 3, 3);
      if (rand() > 0.35 + lush * 0.75) continue;
      const blades = lush > 0.55 ? m.blades.slice(2) : m.blades.slice(0, 4);
      tuft(ctx, s.x, s.y, s.scale * (0.26 + lush * 0.22), blades, rand, (rand() - 0.5) * 0.3);
      const bloom = noise2(x * 0.35, y * 0.35, seed + 11);
      if (bloom > 0.7 && rand() < 0.35) {
        const kind = FLOWER_KINDS[Math.floor(noise2(x * 0.12, y * 0.12, seed + 17) * FLOWER_KINDS.length)];
        flower(ctx, look, kind, s.x + (rand() - 0.5) * 6, s.y, s.scale * 0.2, rand);
      }
    }
  }

  // A few pebbles and a ring of toadstools by the rim.
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const d = shape.rim + 0.7 + rand() * 9;
    const s = camera.project(Math.cos(a) * d, Math.sin(a) * d, shape.depth);
    pebble(ctx, look, s.x, s.y, s.scale * (0.1 + rand() * 0.14), s.scale * (0.07 + rand() * 0.08), look.earth.pebble[i % look.earth.pebble.length], rand() - 0.5);
  }
  const toadstools: [number, number][] = [
    [2.35, 0.9],
    [2.48, 1.3],
    [2.6, 0.75],
    [5.9, 1.1],
    [6.0, 1.6],
  ];
  for (const [a, d] of toadstools) {
    const s = camera.project(Math.cos(a) * (shape.rim + d), Math.sin(a) * (shape.rim + d), shape.depth);
    toadstool(ctx, look, s.x, s.y, s.scale * 0.42, rand);
  }
}

/** mix() returns rgb(); the dabs need a hex to add opacity, so convert back. */
function hexOf(rgb: string): string {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/* ---------- The walls ---------- */

function walls(ctx: CanvasRenderingContext2D, camera: PitCamera, shape: PitShape, look: Look, seed: number) {
  const e = look.earth;
  // Strata from the rim down: dark topsoil, the body of the wall, a band of clay, sand at the foot.
  const bands: [number, string][] = [
    [shape.depth, e.topsoil],
    [shape.depth - 0.32, mix(e.topsoil, e.wall, 0.55)],
    [shape.depth - 0.55, e.wall],
    [shape.depth * 0.62, mix(e.wall, e.clay, 0.6)],
    [shape.depth * 0.48, e.clay],
    [shape.depth * 0.3, mix(e.clay, e.sand, 0.5)],
    [shape.depth * 0.14, e.sand],
  ];
  for (const [i, [z, color]] of bands.entries()) {
    const wobble = (a: number) => (noise2(a * 9, i * 3.1, seed) - 0.5) * 0.28 * (i === 0 ? 0 : 1);
    const pts = ring(camera, wallRadius(shape, z), z, 220, wobble);
    ctx.fillStyle = color;
    ctx.beginPath();
    polygon(ctx, pts);
    ctx.fill();
  }

  // Light and shade round the bowl, as a conic gradient about the pit's middle.
  const centre = camera.project(0, 0, shape.depth / 2);
  const l = look.lightGround;
  const cosE = Math.cos(look.lightElevation);
  const sinE = Math.sin(look.lightElevation);
  const run = shape.rim - shape.floor;
  const len = Math.hypot(run, shape.depth);
  const stops: { at: number; dark: number }[] = [];
  const start = -Math.PI;
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const nx = (-Math.cos(a) * shape.depth) / len;
    const ny = (-Math.sin(a) * shape.depth) / len;
    const nz = run / len;
    const lit = Math.max(0, nx * l.x * cosE + ny * l.y * cosE + nz * sinE);
    const r = wallRadius(shape, shape.depth / 2);
    const p = camera.project(Math.cos(a) * r, Math.sin(a) * r, shape.depth / 2);
    let angle = Math.atan2(p.y - centre.y, p.x - centre.x) - start;
    angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    stops.push({ at: angle / (Math.PI * 2), dark: 1 - Math.min(1, lit * 1.25) });
  }
  stops.sort((a, b) => a.at - b.at);
  const conic = ctx.createConicGradient(start, centre.x, centre.y);
  for (const s of stops) conic.addColorStop(s.at, alpha(look.shadow, s.dark * (look.night ? 0.72 : 0.5)));
  ctx.fillStyle = conic;
  ctx.beginPath();
  polygon(ctx, ring(camera, shape.rim, shape.depth, 180));
  ctx.fill();

  // Soft darkness where the wall meets the floor.
  ctx.save();
  ctx.filter = `blur(${Math.max(2, camera.project(0, 0).scale * 0.35)}px)`;
  ctx.strokeStyle = alpha(look.shadow, look.night ? 0.75 : 0.45);
  ctx.lineWidth = camera.project(0, 0).scale * 0.7;
  ctx.beginPath();
  polygon(ctx, ring(camera, shape.floor + 0.25, 0.15, 160));
  ctx.stroke();
  ctx.restore();

  wallDetails(ctx, camera, shape, look, seed);
}

function wallDetails(ctx: CanvasRenderingContext2D, camera: PitCamera, shape: PitShape, look: Look, seed: number) {
  const rand = scatter(seed + 21);
  const onWall = (a: number, z: number, inset = 0.02): ScreenPoint => {
    const r = wallRadius(shape, z) - inset;
    return camera.project(Math.cos(a) * r, Math.sin(a) * r, z);
  };

  // Pebbles set in the earth.
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const z = 0.25 + rand() * (shape.depth - 0.6);
    if (!wallFacesCamera(camera, shape, a, z)) continue;
    const s = onWall(a, z);
    const size = s.scale * (0.06 + rand() * 0.1);
    pebble(ctx, look, s.x, s.y, size, size * (0.55 + rand() * 0.3), look.earth.pebble[Math.floor(rand() * look.earth.pebble.length)], (rand() - 0.5) * 0.8);
  }

  // Roots hanging from the topsoil: tapered, wandering, some forked.
  ctx.fillStyle = look.earth.root;
  for (let i = 0; i < 46; i++) {
    const a0 = rand() * Math.PI * 2;
    if (!wallFacesCamera(camera, shape, a0, shape.depth - 0.3)) continue;
    const length = 0.35 + rand() * rand() * 1.6;
    const pts: Pt[] = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const z = shape.depth - 0.05 - t * length;
      const a = a0 + (noise2(t * 3, i, seed) - 0.5) * 0.06;
      pts.push(onWall(a, z, 0.04));
    }
    const width = camera.project(0, 0).scale * (0.05 + rand() * 0.06);
    ctx.fillStyle = alpha(look.ink, 0.5);
    taperedStroke(ctx, pts.map((p) => ({ x: p.x + 0.8, y: p.y + 0.8 })), width * 1.4, 0, 1);
    ctx.fillStyle = look.earth.root;
    taperedStroke(ctx, pts, width, 0, 1);
    if (rand() < 0.5) {
      const fork = pts.slice(4).map((p, k) => ({ x: p.x + (k * k * 0.6 + 1) * (rand() < 0.5 ? -1 : 1) * 0.5, y: p.y - k * 0.4 }));
      taperedStroke(ctx, fork, width * 0.6, 0, 1);
    }
  }

  // A few treasures in the soil for people who look closely: a lost key, a snail shell, an acorn.
  const key = onWall(1.98, shape.depth * 0.42);
  lostKey(ctx, look, key.x, key.y, key.scale * 0.42, -0.35);
  const shell = onWall(1.05, shape.depth * 0.7);
  snailShell(ctx, look, shell.x, shell.y, shell.scale * 0.16);
  const acorn = onWall(2.55, shape.depth * 0.78);
  acornIn(ctx, look, acorn.x, acorn.y, acorn.scale * 0.13);
}

function lostKey(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const metal = look.night ? "#a99a6a" : "#c9a54b";
  ctx.strokeStyle = alpha(look.ink, 0.85);
  ctx.lineWidth = size * 0.06;
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(-size * 0.32, 0, size * 0.17, 0, Math.PI * 2);
  ctx.arc(-size * 0.32, 0, size * 0.08, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-size * 0.16, -size * 0.04, size * 0.5, size * 0.08);
  ctx.rect(size * 0.22, size * 0.04, size * 0.06, size * 0.1);
  ctx.rect(size * 0.3, size * 0.04, size * 0.04, size * 0.07);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function snailShell(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = look.night ? "#8c7a8a" : "#e3b98b";
  ctx.strokeStyle = alpha(look.ink, 0.85);
  ctx.lineWidth = size * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.15) {
    const r = size * (1 - a / (Math.PI * 5.5));
    const px = Math.cos(a) * r * 0.9;
    const py = Math.sin(a) * r * 0.9;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function acornIn(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.5);
  ctx.strokeStyle = alpha(look.ink, 0.85);
  ctx.lineWidth = size * 0.12;
  ctx.fillStyle = look.night ? "#7a5a48" : "#b9783e";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.25, size * 0.6, size * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.night ? "#4d3a34" : "#7a5233";
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.3, size * 0.72, size * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/* ---------- The floor ---------- */

function floor(ctx: CanvasRenderingContext2D, camera: PitCamera, shape: PitShape, look: Look, seed: number, grid: boolean) {
  const f = look.floor;
  const edge = ring(camera, shape.floor, 0, 200);
  ctx.save();
  ctx.beginPath();
  polygon(ctx, edge);
  ctx.fillStyle = f.base;
  ctx.fill();
  ctx.clip();

  const rand = scatter(seed + 33);
  const unit = camera.project(0, 0).scale;
  // Packed earth: mottled dabs, then specks and crumbs.
  for (let i = 0; i < 1400; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * shape.floor;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const s = camera.project(x, y, 0);
    const n = fbm2(x * 0.3, y * 0.3, seed + 5, 3);
    ctx.fillStyle = alpha(hexOf(n > 0.5 ? mix(f.base, f.light, (n - 0.5) * 2) : mix(f.dark, f.base, n * 2)), 0.5);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, unit * (0.3 + rand() * 0.4), unit * (0.18 + rand() * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 900; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * shape.floor;
    const s = camera.project(Math.cos(a) * r, Math.sin(a) * r, 0);
    ctx.fillStyle = alpha(rand() < 0.7 ? f.speck : f.light, 0.6);
    ctx.beginPath();
    ctx.arc(s.x, s.y, unit * (0.015 + rand() * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
  // Hairline cracks in the dry earth.
  ctx.strokeStyle = alpha(f.spot, 0.45);
  ctx.lineWidth = Math.max(0.7, unit * 0.025);
  for (let i = 0; i < 16; i++) {
    let x = (rand() - 0.5) * shape.floor * 1.6;
    let y = (rand() - 0.5) * shape.floor * 1.6;
    let heading = rand() * Math.PI * 2;
    ctx.beginPath();
    const start = camera.project(x, y, 0);
    ctx.moveTo(start.x, start.y);
    for (let k = 0; k < 6; k++) {
      heading += (rand() - 0.5) * 1.2;
      x += Math.cos(heading) * 0.35;
      y += Math.sin(heading) * 0.35;
      const p = camera.project(x, y, 0);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  if (grid) stepMarks(ctx, camera, shape, look);
  blooms(ctx, camera, look, shape.floor, seed);
  rabbitTracks(ctx, camera, look, seed);
  lostThings(ctx, camera, look);

  // Pebbles, sprouts and a few fallen leaves.
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (shape.floor - 0.4);
    const s = camera.project(Math.cos(a) * r, Math.sin(a) * r, 0);
    const size = s.scale * (0.05 + rand() * 0.07);
    pebble(ctx, look, s.x, s.y, size, size * 0.65, look.earth.pebble[i % look.earth.pebble.length], rand() - 0.5);
  }
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = shape.floor - 0.3 - rand() * 2.2;
    const s = camera.project(Math.cos(a) * r, Math.sin(a) * r, 0);
    tuft(ctx, s.x, s.y, s.scale * 0.22, look.meadow.blades.slice(0, 3), rand, (rand() - 0.5) * 0.4);
  }
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (shape.floor - 1);
    const s = camera.project(Math.cos(a) * r, Math.sin(a) * r, 0);
    leaf(ctx, look, s.x, s.y, s.scale * 0.2, rand() * Math.PI * 2, rand);
  }

  // The rim's shadow: the floor is lit only where a ray towards the light clears the rim.
  const reach = shape.depth / Math.tan(look.lightElevation);
  const l = look.lightGround;
  const lit: Pt[] = [];
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    const p = camera.project(-l.x * reach + Math.cos(a) * shape.rim, -l.y * reach + Math.sin(a) * shape.rim, 0);
    lit.push(p);
  }
  ctx.save();
  ctx.filter = `blur(${Math.max(1.5, unit * 0.12)}px)`;
  ctx.beginPath();
  polygon(ctx, ring(camera, shape.floor + 2, 0, 160));
  polygon(ctx, lit);
  ctx.fillStyle = alpha(look.shadow, look.night ? 0.62 : 0.32);
  ctx.fill("evenodd");
  ctx.restore();

  // A soft dark rim round the floor where it meets the wall.
  ctx.save();
  ctx.filter = `blur(${Math.max(2, unit * 0.3)}px)`;
  ctx.strokeStyle = alpha(look.shadow, look.night ? 0.55 : 0.32);
  ctx.lineWidth = unit * 0.9;
  ctx.beginPath();
  polygon(ctx, edge);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/**
 * The cells you can stand on, as faint pressed dots in the earth, so steps can
 * be counted without drawing a grid over the picture.
 */
function stepMarks(ctx: CanvasRenderingContext2D, camera: PitCamera, shape: PitShape, look: Look) {
  const r = Math.floor(shape.lattice);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > shape.lattice * shape.lattice) continue;
      const p = camera.project(x, y, 0);
      const rx = p.scale * 0.075;
      ctx.fillStyle = alpha(look.floor.light, look.night ? 0.35 : 0.55);
      ctx.beginPath();
      ctx.ellipse(p.x + rx * 0.35, p.y + rx * 0.3, rx, rx * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(look.floor.spot, look.night ? 0.5 : 0.4);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, rx * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function leaf(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, size: number, rotation: number, rand: () => number) {
  const colors = look.night ? ["#6b5a4a", "#5b4a5a", "#7a6a4e"] : ["#d99a3e", "#c4682f", "#b98a3a"];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(1, 0.6);
  ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
  ctx.strokeStyle = alpha(look.ink, 0.6);
  ctx.lineWidth = Math.max(0.6, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.quadraticCurveTo(0, -size * 0.55, size, 0);
  ctx.quadraticCurveTo(0, size * 0.55, -size, 0);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-size * 1.15, 0);
  ctx.lineTo(size * 0.8, 0);
  ctx.stroke();
  ctx.restore();
}

/* ---------- The rim ---------- */

function rimEdge(back: CanvasRenderingContext2D, front: CanvasRenderingContext2D, camera: PitCamera, shape: PitShape, look: Look, rimRing: ScreenPoint[], seed: number) {
  const unit = camera.project(0, 0).scale;
  // The lip of turf: a dark inked edge round the hole.
  back.save();
  back.strokeStyle = alpha(look.ink, 0.7);
  back.lineWidth = Math.max(1.2, unit * 0.06);
  back.beginPath();
  polygon(back, rimRing);
  back.stroke();
  back.restore();

  // Grass hangs over the edge. The far half is painted over the wall now; the near half is
  // kept for the foreground, so it can hang in front of whoever stands at the near wall.
  const rand = scatter(seed + 51);
  const count = 360;
  const order = Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2).sort((a, b) => Math.sin(b) - Math.sin(a));
  for (const a of order) {
    const r = shape.rim + 0.05 + (rand() - 0.3) * 0.25;
    const s = camera.project(Math.cos(a) * r, Math.sin(a) * r, shape.depth);
    const ctx = Math.sin(a) < -0.25 ? front : back;
    const inward = camera.project(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1), shape.depth);
    const lean = Math.atan2(inward.y - s.y, inward.x - s.x) + Math.PI / 2;
    const blades = rand() < 0.5 ? look.meadow.blades.slice(0, 3) : look.meadow.blades.slice(2, 5);
    tuft(ctx, s.x, s.y, s.scale * (0.32 + rand() * 0.25), blades, rand, Math.max(-1.1, Math.min(1.1, lean * 0.55)));
    if (rand() < 0.07) {
      const kind = FLOWER_KINDS[Math.floor(rand() * FLOWER_KINDS.length)];
      flower(ctx, look, kind, s.x, s.y, s.scale * 0.2, rand);
    }
  }
}

/* ---------- Light over everything ---------- */

function grade(ctx: CanvasRenderingContext2D, look: Look, width: number, height: number) {
  const reach = Math.hypot(width, height);
  const glow = ctx.createRadialGradient(width * 0.12, height * 0.02, 0, width * 0.12, height * 0.02, reach * 0.9);
  if (look.night) {
    glow.addColorStop(0, "rgb(190 210 255 / 0.22)");
    glow.addColorStop(0.45, "rgb(120 140 200 / 0.06)");
    glow.addColorStop(1, "rgb(5 8 25 / 0.42)");
  } else {
    glow.addColorStop(0, "rgb(255 236 180 / 0.28)");
    glow.addColorStop(0.5, "rgb(255 230 170 / 0.06)");
    glow.addColorStop(1, "rgb(90 60 40 / 0.16)");
  }
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}
