import { css, jitter, mix, shade, type Rgb } from "../../scene/color";
import { brushStroke, dab, type Ctx } from "../../scene/paint";
import type { Palette } from "./palette";

/*
 * The furniture of the Western Front, drawn in pixels at a given size: a
 * village church, poplars, shattered trees, a ruined farm, shell holes,
 * trenches, wire and sandbags. Light comes from above and a little to the
 * left (the pale sun behind the overcast, or a star shell overhead), so top
 * and left edges catch it.
 */

type R = () => number;
const between = (r: R, a: number, b: number) => a + (b - a) * r();

/** A thin bright line along the lit edge of a shape. */
function rimLine(ctx: Ctx, points: [number, number][], pal: Palette, width: number, alpha: number) {
  ctx.save();
  ctx.strokeStyle = css(pal.rim, alpha);
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

/** A village church: nave, a square tower and a tall spire, sometimes with its tip shot away. */
export function church(ctx: Ctx, x: number, gy: number, h: number, pal: Palette, r: R, color = pal.farDetail) {
  const naveW = h * 0.75;
  const naveH = h * 0.24;
  const towerW = h * 0.16;
  const towerH = h * 0.46;
  const tx = x - naveW * 0.32;
  const broken = r() < 0.35;
  ctx.fillStyle = css(color);
  // Nave with its roof.
  ctx.beginPath();
  ctx.moveTo(x - naveW / 2, gy);
  ctx.lineTo(x - naveW / 2, gy - naveH);
  ctx.lineTo(x - naveW / 2 + naveH * 0.5, gy - naveH * 1.55);
  ctx.lineTo(x + naveW / 2 - naveH * 0.5, gy - naveH * 1.55);
  ctx.lineTo(x + naveW / 2, gy - naveH);
  ctx.lineTo(x + naveW / 2, gy);
  ctx.fill();
  // Tower and spire.
  ctx.fillStyle = css(shade(color, 0.94));
  ctx.fillRect(tx - towerW / 2, gy - towerH, towerW, towerH);
  ctx.beginPath();
  const spireTop = broken ? gy - h * 0.82 : gy - h;
  ctx.moveTo(tx - towerW * 0.6, gy - towerH);
  if (broken) {
    ctx.lineTo(tx - towerW * 0.12, spireTop);
    ctx.lineTo(tx + towerW * 0.05, spireTop + h * 0.05);
    ctx.lineTo(tx + towerW * 0.18, spireTop - h * 0.02);
  } else ctx.lineTo(tx, spireTop);
  ctx.lineTo(tx + towerW * 0.6, gy - towerH);
  ctx.fill();
  rimLine(
    ctx,
    [
      [tx - towerW * 0.6, gy - towerH],
      [tx, spireTop],
    ],
    pal,
    Math.max(0.6, h * 0.012),
    0.35,
  );
  // A dark slit for the belfry.
  ctx.fillStyle = css(shade(color, 0.7));
  ctx.fillRect(tx - towerW * 0.15, gy - towerH * 0.82, towerW * 0.3, towerH * 0.16);
}

/** A cottage with a pitched roof; ruined ones have a broken roof line and a gap in the wall. */
export function cottage(ctx: Ctx, x: number, gy: number, w: number, pal: Palette, r: R, color: Rgb, ruined = false) {
  const h = w * between(r, 0.45, 0.6);
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, gy);
  ctx.lineTo(x - w / 2, gy - h);
  if (ruined) {
    ctx.lineTo(x - w * 0.2, gy - h * 1.35);
    ctx.lineTo(x - w * 0.05, gy - h * 1.05);
    ctx.lineTo(x + w * 0.12, gy - h * 1.2);
    ctx.lineTo(x + w * 0.3, gy - h * 0.8);
  } else ctx.lineTo(x, gy - h * 1.6);
  ctx.lineTo(x + w / 2, gy - h);
  ctx.lineTo(x + w / 2, gy);
  ctx.fill();
}

/** A tall narrow poplar, or what the shelling left of one. */
export function poplar(ctx: Ctx, x: number, gy: number, h: number, pal: Palette, r: R, color: Rgb) {
  if (r() < 0.4) {
    // Shattered: a bare trunk with a splintered top.
    const top = gy - h * between(r, 0.35, 0.7);
    ctx.strokeStyle = css(color);
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + between(r, -1, 1) * h * 0.04, top);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.ellipse(x, gy - h * 0.55, h * 0.09, h * 0.47, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - h * 0.012, gy - h * 0.12, h * 0.024, h * 0.12);
}

/**
 * A tree after a bombardment: a tall bare trunk, a few stubs of branches
 * snapped off at angles, sometimes a split crown.
 */
export function shatteredTree(ctx: Ctx, x: number, gy: number, h: number, pal: Palette, r: R, color: Rgb, rimAlpha = 0.25) {
  const lean = between(r, -0.06, 0.06);
  const top: [number, number] = [x + lean * h, gy - h];
  const base = Math.max(1.2, h * 0.045);
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.moveTo(x - base, gy);
  ctx.lineTo(top[0] - base * 0.25, top[1] + h * 0.04);
  // A splintered top.
  ctx.lineTo(top[0] - base * 0.1, top[1]);
  ctx.lineTo(top[0] + base * 0.15, top[1] + h * 0.06);
  ctx.lineTo(top[0] + base * 0.3, top[1] + h * 0.02);
  ctx.lineTo(x + base, gy);
  ctx.fill();
  ctx.strokeStyle = css(color);
  ctx.lineCap = "round";
  const stubs = 2 + Math.floor(r() * 4);
  for (let i = 0; i < stubs; i++) {
    const at = between(r, 0.35, 0.92);
    const sx = x + lean * h * at;
    const sy = gy - h * at;
    const side = r() < 0.5 ? -1 : 1;
    const len = h * between(r, 0.08, 0.28) * (1.1 - at * 0.5);
    const ang = side * between(r, 0.5, 1.2);
    ctx.lineWidth = Math.max(0.8, base * between(r, 0.3, 0.6));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.sin(ang) * len, sy - Math.cos(ang) * len);
    ctx.stroke();
  }
  rimLine(
    ctx,
    [
      [x - base, gy],
      [top[0] - base * 0.25, top[1] + h * 0.04],
    ],
    pal,
    Math.max(0.6, base * 0.35),
    rimAlpha,
  );
}

/** A farmhouse with its roof blown in: jagged walls, bare rafters, a chimney stack still standing. */
export function ruinedFarm(ctx: Ctx, x: number, gy: number, w: number, pal: Palette, r: R) {
  const h = w * 0.42;
  const wall = pal.plaster;
  const shadow = shade(wall, 0.72);
  // The end wall with its gable, in light.
  ctx.fillStyle = css(wall);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, gy);
  ctx.lineTo(x - w / 2, gy - h);
  ctx.lineTo(x - w * 0.3, gy - h * 1.5);
  ctx.lineTo(x - w * 0.12, gy - h * 1.05);
  ctx.lineTo(x - w * 0.1, gy - h * 0.7);
  ctx.lineTo(x - w * 0.02, gy - h * 0.82);
  ctx.lineTo(x + w * 0.14, gy - h * 0.55);
  ctx.lineTo(x + w * 0.22, gy - h * 0.78);
  ctx.lineTo(x + w * 0.35, gy - h * 0.6);
  ctx.lineTo(x + w / 2, gy - h * 0.66);
  ctx.lineTo(x + w / 2, gy);
  ctx.fill();
  // The long wall in shade, and the holes through it.
  ctx.fillStyle = css(shadow);
  ctx.fillRect(x - w * 0.1, gy - h * 0.55, w * 0.6, h * 0.55);
  ctx.fillStyle = css(shade(wall, 0.35));
  ctx.fillRect(x - w * 0.38, gy - h * 0.62, w * 0.1, h * 0.22);
  ctx.fillRect(x + w * 0.08, gy - h * 0.4, w * 0.08, h * 0.2);
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, gy - h * 0.3, w * 0.07, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rafters still hanging from the ridge.
  ctx.strokeStyle = css(shade(pal.roof, 0.7));
  ctx.lineWidth = Math.max(0.8, w * 0.012);
  for (let i = 0; i < 5; i++) {
    const rx = x - w * 0.28 + i * w * 0.1;
    ctx.beginPath();
    ctx.moveTo(rx, gy - h * 1.42 + i * h * 0.06);
    ctx.lineTo(rx + w * 0.08, gy - h * (0.95 - i * 0.03));
    ctx.stroke();
  }
  // The chimney stack.
  ctx.fillStyle = css(mix(pal.roof, wall, 0.3));
  ctx.fillRect(x - w * 0.45, gy - h * 1.75, w * 0.07, h * 0.6);
  rimLine(
    ctx,
    [
      [x - w / 2, gy - h],
      [x - w * 0.3, gy - h * 1.5],
      [x - w * 0.12, gy - h * 1.05],
    ],
    pal,
    Math.max(0.7, w * 0.01),
    0.5,
  );
  // Rubble at the foot of the walls.
  for (let i = 0; i < 12; i++) dab(ctx, x + between(r, -0.6, 0.6) * w, gy - between(r, 0, 0.06) * h, w * between(r, 0.03, 0.07), jitter(shadow, 0.15, r), 0.8, 0.5);
}

/**
 * A shell hole seen at a low angle: a flattened bowl, its far lip catching
 * the light, sometimes holding water that mirrors the sky.
 */
export function crater(ctx: Ctx, cx: number, cy: number, rw: number, pal: Palette, r: R, water: boolean) {
  const rh = rw * between(r, 0.22, 0.32);
  // The thrown-up lip, wider than the hole.
  dab(ctx, cx, cy + rh * 0.1, rw * 1.45, pal.mudLight, 0.35, 0.3);
  ctx.fillStyle = css(pal.mudDark);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  if (water) {
    // Standing water mirrors the sky: paler at the far edge, darker under the near lip.
    const g = ctx.createLinearGradient(0, cy - rh * 0.3, 0, cy + rh * 0.7);
    g.addColorStop(0, css(mix(pal.water, pal.mudDark, 0.15), 0.9));
    g.addColorStop(1, css(mix(pal.water, pal.mudDark, 0.55), 0.9));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx + rw * 0.05, cy + rh * 0.18, rw * 0.7, rh * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css(pal.rim, 0.4);
    ctx.lineWidth = Math.max(0.6, rh * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx - rw * 0.4, cy + rh * 0.02);
    ctx.lineTo(cx + rw * 0.18, cy - rh * 0.02);
    ctx.stroke();
  }
  // The far lip in light, the near lip in shadow.
  ctx.strokeStyle = css(pal.mudLight, 0.85);
  ctx.lineWidth = Math.max(0.8, rh * 0.28);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw, rh, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.strokeStyle = css(shade(pal.mudDark, 0.8), 0.6);
  ctx.beginPath();
  ctx.ellipse(cx, cy + rh * 0.1, rw * 1.02, rh * 1.05, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();
}

/** A wooden picket with a few strands of wire sagging to the next. */
export function wireRun(ctx: Ctx, x0: number, x1: number, gy: (x: number) => number, h: number, pal: Palette, r: R, spacing: number) {
  const posts: [number, number][] = [];
  for (let x = x0; x <= x1; x += spacing * between(r, 0.8, 1.2)) posts.push([x, gy(x)]);
  ctx.strokeStyle = css(pal.wire);
  ctx.lineCap = "round";
  for (const [x, y] of posts) {
    const lean = between(r, -0.25, 0.25);
    ctx.lineWidth = Math.max(0.8, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean * h, y - h * between(r, 0.75, 1.05));
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(0.5, h * 0.018);
  ctx.strokeStyle = css(pal.wire, 0.85);
  for (let i = 1; i < posts.length; i++) {
    const [ax, ay] = posts[i - 1];
    const [bx, by] = posts[i];
    for (const level of [0.3, 0.55, 0.8]) {
      const sag = h * 0.08;
      ctx.beginPath();
      ctx.moveTo(ax, ay - h * level);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - h * level + sag, bx, by - h * level);
      ctx.stroke();
    }
    // Criss-cross strands between the rows.
    ctx.beginPath();
    ctx.moveTo(ax, ay - h * 0.3);
    ctx.lineTo(bx, by - h * 0.8);
    ctx.moveTo(ax, ay - h * 0.8);
    ctx.lineTo(bx, by - h * 0.3);
    ctx.stroke();
  }
}

/** A coil of concertina wire, the nearest thing on the screen, drawn as loops. */
export function wireCoil(ctx: Ctx, x0: number, x1: number, gy: number, h: number, pal: Palette, r: R) {
  ctx.strokeStyle = css(pal.foreground);
  ctx.lineWidth = Math.max(1, h * 0.03);
  const loop = h * 0.55;
  for (let x = x0; x < x1; x += loop * between(r, 0.45, 0.7)) {
    ctx.beginPath();
    ctx.ellipse(x, gy - h * 0.5, loop * 0.5, h * 0.5 * between(r, 0.85, 1.05), between(r, -0.3, 0.3), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Barbs: tiny crossed ticks along the loops.
  ctx.lineWidth = Math.max(0.8, h * 0.018);
  for (let i = 0; i < (x1 - x0) / 6; i++) {
    const bx = between(r, x0, x1);
    const by = gy - between(r, 0, h);
    ctx.beginPath();
    ctx.moveTo(bx - 3, by - 3);
    ctx.lineTo(bx + 3, by + 3);
    ctx.moveTo(bx + 3, by - 3);
    ctx.lineTo(bx - 3, by + 3);
    ctx.stroke();
  }
}

/** A low wall of sandbags, two or three courses, each bag a little rounded and lit on top. */
export function sandbags(ctx: Ctx, x0: number, x1: number, gy: number, bagW: number, courses: number, pal: Palette, r: R) {
  const bagH = bagW * 0.42;
  for (let c = 0; c < courses; c++) {
    const y = gy - (c + 1) * bagH * 0.92;
    const offset = c % 2 ? bagW / 2 : 0;
    for (let x = x0 + offset; x < x1 - bagW * 0.3; x += bagW * 0.97) {
      const color = jitter(mix(pal.sandbag, pal.mud, 0.25 + r() * 0.3), 0.08, r);
      ctx.fillStyle = css(shade(color, 0.78));
      ctx.beginPath();
      ctx.roundRect(x, y, bagW, bagH, bagH * 0.45);
      ctx.fill();
      ctx.fillStyle = css(color);
      ctx.beginPath();
      ctx.roundRect(x + bagW * 0.04, y, bagW * 0.92, bagH * 0.55, bagH * 0.4);
      ctx.fill();
    }
  }
}

/**
 * A trench seen from a little above: a dark cut behind a pale parapet of
 * thrown-up spoil, stepping back and forth in traverses so a shell bursting
 * in one bay can't sweep the next.
 */
export function trenchLine(ctx: Ctx, x0: number, x1: number, y: (x: number) => number, depth: number, pal: Palette, r: R) {
  const cut: [number, number][] = [];
  let x = x0;
  let forward = true;
  while (x < x1 + depth * 12) {
    const len = depth * between(r, 4, 11);
    const off = forward ? 0 : depth * 0.9;
    cut.push([x, y(x) + off], [x + len, y(x + len) + off]);
    x += len;
    forward = !forward;
  }
  brushStroke(
    ctx,
    cut.map(([px, py]) => [px, py - depth * 0.45]),
    depth * 1.2,
    pal.mudLight,
    0.3,
    r,
    2,
  );
  brushStroke(ctx, cut, depth * 0.8, shade(pal.mudDark, 0.85), 0.55, r, 3);
}

/** Rainwater lying in a rut or a long hollow: a thin lens of sky with a bright streak. */
export function waterLens(ctx: Ctx, x: number, y: number, rx: number, ry: number, pal: Palette, r: R) {
  const g = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, css(pal.water, 0));
  g.addColorStop(0.3, css(mix(pal.water, pal.mudDark, 0.2), 0.75));
  g.addColorStop(0.7, css(mix(pal.water, pal.mudDark, 0.3), 0.75));
  g.addColorStop(1, css(pal.water, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, between(r, -0.02, 0.02), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = css(pal.rim, 0.45);
  ctx.lineWidth = Math.max(0.5, ry * 0.35);
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.5, y - ry * 0.15);
  ctx.lineTo(x + rx * 0.3, y - ry * 0.2);
  ctx.stroke();
}
