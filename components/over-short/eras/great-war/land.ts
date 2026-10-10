import { createRng } from "@/lib/kit/rng";
import { css, mix, shade, type Rgb } from "../../scene/color";
import { fbm1, smoothstep } from "../../scene/noise";
import { applyGrain, dab, scumble } from "../../scene/paint";
import type { SideLayer, TileRequest } from "../../scene/side";
import { church, cottage, crater, poplar, ruinedFarm, shatteredTree, trenchLine, waterLens, wireCoil, wireRun } from "./features";
import { paletteFor, type Palette } from "./palette";

/*
 * The Western Front side-on, in five layers from the horizon to the wire at
 * the viewer's feet:
 *
 *   far      a long low ridge with a village and its church spire
 *   country  rolling ground behind the lines: woods, a ruined farm, poplars
 *   field    the cratered mud the shells land on, with its trench and wire
 *   near     the slope just in front: big flooded shell holes, a sandbagged post
 *   front    the nearest wire and pickets, dark against everything
 *
 * Every feature's place and shape comes from a hash of its cell, so a tile
 * paints the same things wherever and whenever it is painted, and features
 * crossing a tile's edge are drawn in both tiles. Light and cloud shadow lie
 * across the land in broad patches that follow the world, not the tiles.
 */

/** The random stream for one cell of one layer: same cell, same feature. */
const cellRandom = (layer: string, cell: number) => createRng(`great-war/${layer}/${cell}`).float;

/** Every cell of `size` metres that can reach into the tile, with `margin` metres of overhang. */
function cellsFor(tile: TileRequest, size: number, margin: number) {
  const cells: number[] = [];
  for (let c = Math.floor((tile.u0 - margin) / size); c <= Math.floor((tile.u1 + margin) / size); c++) cells.push(c);
  return cells;
}

/** Tile y of the ground line at tile x. */
const groundAt = (tile: TileRequest, x: number) => tile.contourY(tile.u0 + x / tile.scale) - tile.top;

const H = (tile: TileRequest, share: number) => tile.viewHeight * share;

/** The land's outline as a path: the ground line across the tile, closed along the bottom. */
function groundPath(tile: TileRequest) {
  const path = new Path2D();
  path.moveTo(-4, tile.height + 4);
  for (let x = -4; x <= tile.width + 4; x += 3) path.lineTo(x, groundAt(tile, x));
  path.lineTo(tile.width + 4, tile.height + 4);
  path.closePath();
  return path;
}

/** Paints inside the land only: whatever `paint` draws is clipped to below the ground line. */
function insideGround(tile: TileRequest, paint: () => void) {
  tile.ctx.save();
  tile.ctx.clip(groundPath(tile));
  paint();
  tile.ctx.restore();
}

/** The land's body: a gradient from its lit top to its darker foot. */
function fillGround(tile: TileRequest, top: Rgb, bottom: Rgb, depth = 0.12) {
  const { ctx } = tile;
  const minY = groundAt(tile, tile.width / 2) - H(tile, 0.02);
  const g = ctx.createLinearGradient(0, minY, 0, minY + H(tile, depth));
  g.addColorStop(0, css(top));
  g.addColorStop(1, css(bottom));
  ctx.fillStyle = g;
  ctx.fill(groundPath(tile));
}

/**
 * Light and shade lying across the land in broad soft patches: where the
 * overcast thins the ground is warmer and paler, under heavy cloud it is
 * darker and cooler. Locked to the world so tiles agree.
 */
function lightPatches(tile: TileRequest, pal: Palette, seed: number, length: number, strength: number) {
  const { ctx } = tile;
  const day = tile.appearance === "day";
  const warm: Rgb = day ? mix(pal.rim, [255, 236, 200], 0.4) : pal.rim;
  const cool: Rgb = day ? shade(mix(pal.mudDark, [70, 80, 96], 0.4), 0.9) : pal.mudDark;
  insideGround(tile, () => {
    for (let x = -60; x < tile.width + 60; x += 36) {
      const u = tile.u0 + x / tile.scale;
      const n = fbm1(u / length, seed, 3);
      const y = groundAt(tile, x) + H(tile, 0.012 + (fbm1(u / (length * 0.6), seed + 9, 2) * 0.5 + 0.5) * 0.04);
      if (n > 0.15) dab(ctx, x, y, H(tile, 0.07), warm, strength * smoothstep(0.15, 0.6, n), 0.22);
      else if (n < -0.15) dab(ctx, x, y, H(tile, 0.08), cool, strength * 0.9 * smoothstep(-0.15, -0.6, n), 0.22);
    }
  });
}

/** Low mist lying in the hollow at the foot of a layer, between it and the ground in front. */
function hollowMist(tile: TileRequest, seed: number, alpha: number) {
  const { ctx } = tile;
  const day = tile.appearance === "day";
  const color: Rgb = day ? [226, 222, 210] : tile.lighting === "flare" ? [210, 218, 232] : [40, 46, 60];
  const r = createRng(`great-war/mist/${seed}/${Math.round(tile.u0)}`).float;
  insideGround(tile, () => {
    for (let i = 0; i < 14; i++) {
      const x = r() * tile.width;
      const u = tile.u0 + x / tile.scale;
      const thick = smoothstep(-0.1, 0.5, fbm1(u / 500, seed, 3));
      if (thick < 0.05) continue;
      dab(ctx, x, groundAt(tile, x) + H(tile, 0.045 + r() * 0.03), H(tile, 0.09 + r() * 0.08), color, alpha * thick, 0.16);
    }
  });
}

/** A thin line of light along the top of the land. */
function rimGround(tile: TileRequest, pal: Palette, alpha: number) {
  const { ctx, width } = tile;
  ctx.save();
  ctx.strokeStyle = css(pal.rim, alpha);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = -2; x <= width + 2; x += 3) {
    const y = groundAt(tile, x) + 0.6;
    if (x === -2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Atmospheric haze over a distant layer, so it sits back towards the sky. */
function haze(tile: TileRequest, pal: Palette, alpha: number) {
  const { ctx, width, height } = tile;
  ctx.save();
  ctx.fillStyle = css(tile.appearance === "day" ? pal.haze : pal.skyLow, alpha);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

const flare = (tile: TileRequest) => tile.lighting === "flare";

/* ---------- far: the ridge, the village, the poplars ---------- */

function paintFar(tile: TileRequest) {
  const pal = paletteFor(tile.appearance, tile.lighting);
  const { ctx } = tile;
  fillGround(tile, pal.far, mix(pal.far, pal.country, 0.5), 0.05);
  lightPatches(tile, pal, 21, 700, 0.25);
  for (const cell of cellsFor(tile, 1300, 200)) {
    const r = cellRandom("far-village", cell);
    if (r() < 0.45) continue;
    const x = tile.tileX(cell * 1300 + r() * 900);
    const gy = groundAt(tile, x) + 1;
    const houses = 3 + Math.floor(r() * 5);
    for (let i = 0; i < houses; i++) {
      const hx = x + (r() - 0.5) * H(tile, 0.09);
      cottage(ctx, hx, groundAt(tile, hx) + 1, H(tile, 0.012 + r() * 0.008), pal, r, mix(pal.farDetail, pal.far, r() * 0.4), r() < 0.5);
    }
    church(ctx, x, gy, H(tile, 0.05 + r() * 0.015), pal, r);
  }
  for (const cell of cellsFor(tile, 420, 80)) {
    const r = cellRandom("far-poplars", cell);
    if (r() < 0.5) continue;
    const start = cell * 420 + r() * 200;
    const count = 5 + Math.floor(r() * 9);
    for (let i = 0; i < count; i++) {
      const x = tile.tileX(start + i * (14 + r() * 6));
      poplar(ctx, x, groundAt(tile, x) + 1, H(tile, 0.022 + r() * 0.012), pal, r, mix(pal.farDetail, pal.far, 0.2));
    }
  }
  haze(tile, pal, tile.appearance === "day" ? 0.32 : 0.18);
  hollowMist(tile, 31, tile.appearance === "day" ? 0.35 : 0.25);
  rimGround(tile, pal, flare(tile) ? 0.5 : 0.18);
  applyGrain(ctx, 0, 0, tile.width, tile.height, 0.25, 5);
}

/* ---------- country: rolling ground, woods, a farm ---------- */

function paintCountry(tile: TileRequest) {
  const pal = paletteFor(tile.appearance, tile.lighting);
  const { ctx } = tile;
  fillGround(tile, pal.country, pal.countryDark, 0.09);
  // Fields lying along the land: soft strips of slightly different earth, and hedges between them.
  insideGround(tile, () => {
    for (const cell of cellsFor(tile, 60, 160)) {
      const r = cellRandom("country-fields", cell);
      const x = tile.tileX(cell * 60 + r() * 60);
      const y = groundAt(tile, x) + H(tile, 0.006 + r() * 0.05);
      dab(ctx, x, y, H(tile, 0.07 + r() * 0.12), mix(pal.country, r() < 0.5 ? pal.grass : pal.mudLight, 0.5), 0.35, 0.1);
    }
    ctx.strokeStyle = css(shade(pal.countryDark, 0.85), 0.55);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      for (let x = -4; x <= tile.width + 4; x += 6) {
        const u = tile.u0 + x / tile.scale;
        const y = groundAt(tile, x) + H(tile, 0.012 + i * 0.012 + fbm1(u / 300, 60 + i, 2) * 0.006);
        if (x === -4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  lightPatches(tile, pal, 23, 520, 0.3);
  for (const cell of cellsFor(tile, 380, 120)) {
    const r = cellRandom("country-woods", cell);
    if (r() < 0.42) continue;
    const start = cell * 380 + r() * 160;
    const span = 50 + r() * 140;
    const trees = 6 + Math.floor(r() * 14);
    for (let i = 0; i < trees; i++) {
      const x = tile.tileX(start + r() * span);
      const gy = groundAt(tile, x) + H(tile, 0.002 + r() * 0.006);
      shatteredTree(ctx, x, gy, H(tile, 0.025 + r() * 0.045), pal, r, mix(pal.woods, pal.country, r() * 0.25), flare(tile) ? 0.6 : 0.2);
    }
  }
  for (const cell of cellsFor(tile, 1100, 120)) {
    const r = cellRandom("country-farm", cell);
    if (r() < 0.55) continue;
    const x = tile.tileX(cell * 1100 + 200 + r() * 600);
    ruinedFarm(ctx, x, groundAt(tile, x) + H(tile, 0.004), H(tile, 0.055 + r() * 0.02), pal, r);
  }
  for (const cell of cellsFor(tile, 700, 120)) {
    const r = cellRandom("country-poplars", cell);
    if (r() < 0.55) continue;
    const start = cell * 700 + r() * 300;
    const count = 4 + Math.floor(r() * 7);
    for (let i = 0; i < count; i++) {
      const x = tile.tileX(start + i * (9 + r() * 4));
      poplar(ctx, x, groundAt(tile, x) + H(tile, 0.003), H(tile, 0.04 + r() * 0.02), pal, r, mix(pal.woods, pal.country, 0.15));
    }
  }
  haze(tile, pal, tile.appearance === "day" ? 0.14 : 0.07);
  hollowMist(tile, 37, tile.appearance === "day" ? 0.3 : 0.2);
  rimGround(tile, pal, flare(tile) ? 0.6 : 0.22);
  applyGrain(ctx, 0, 0, tile.width, tile.height, 0.3, 7);
}

/* ---------- field: the ground the shells land on ---------- */

/** How churned the field is around layer metre u: the shelled zones come and go along the front. */
const shelling = (u: number) => smoothstep(-0.35, 0.45, fbm1(u / 260, 41, 3));

function paintField(tile: TileRequest) {
  const pal = paletteFor(tile.appearance, tile.lighting);
  const { ctx } = tile;
  fillGround(tile, pal.mud, pal.mudDark, 0.12);
  const r0 = createRng(`great-war/field-texture/${Math.round(tile.u0)}`).float;
  insideGround(tile, () => {
    scumble(ctx, { x: 0, y: 0, w: tile.width, h: tile.height }, [pal.mud, pal.mudLight, pal.grass, pal.mudDark], r0, {
      count: 1400,
      length: H(tile, 0.016),
      width: H(tile, 0.0026),
      alpha: 0.32,
      angle: 0,
      spread: 0.1,
    });
    // Rain lying in ruts and wheel tracks: long thin lenses of sky.
    for (const cell of cellsFor(tile, 140, 120)) {
      const r = cellRandom("field-water", cell);
      if (r() < 0.35) continue;
      const x = tile.tileX(cell * 140 + r() * 140);
      const y = groundAt(tile, x) + H(tile, 0.02 + r() * 0.09);
      waterLens(ctx, x, y, H(tile, 0.03 + r() * 0.07), H(tile, 0.002 + r() * 0.0025), pal, r);
    }
  });
  lightPatches(tile, pal, 29, 340, 0.32);
  // Shell holes: thick in the shelled zones, sparse between, smaller and flatter higher up (farther away).
  for (const cell of cellsFor(tile, 12, 30)) {
    const r = cellRandom("field-craters", cell);
    const u = cell * 12 + r() * 12;
    if (r() > 0.06 + shelling(u) * 0.5) continue;
    const x = tile.tileX(u);
    const depth = r() * r();
    const y = groundAt(tile, x) + H(tile, 0.012 + depth * 0.11);
    crater(ctx, x, y, H(tile, 0.006 + depth * 0.022) * (0.6 + r() * 0.8), pal, r, r() < 0.18);
  }
  // The trench, with its traverses, a little below the skyline.
  trenchLine(ctx, -60, tile.width + 60, (x) => groundAt(tile, x) + H(tile, 0.036), H(tile, 0.006), pal, createRng(`great-war/trench/${Math.round(tile.u0)}`).float);
  const wireR = createRng(`great-war/field-wire/${Math.round(tile.u0)}`).float;
  wireRun(ctx, -20, tile.width + 20, (x) => groundAt(tile, x) + H(tile, 0.066), H(tile, 0.012), pal, wireR, H(tile, 0.02));
  // Shattered stumps standing on the field's skyline, thickest where the shelling was worst.
  for (const cell of cellsFor(tile, 45, 40)) {
    const r = cellRandom("field-stumps", cell);
    const u = cell * 45 + r() * 45;
    if (r() > 0.25 + (1 - shelling(u)) * 0.35) continue;
    const x = tile.tileX(u);
    shatteredTree(ctx, x, groundAt(tile, x) + 2, H(tile, 0.02 + r() * 0.06), pal, r, mix(pal.woods, pal.mudDark, 0.4), flare(tile) ? 0.7 : 0.25);
  }
  rimGround(tile, pal, flare(tile) ? 0.75 : 0.25);
  applyGrain(ctx, 0, 0, tile.width, tile.height, 0.35, 11);
}

/* ---------- near: the slope in front ---------- */

function paintNear(tile: TileRequest) {
  const pal = paletteFor(tile.appearance, tile.lighting);
  const nearPal = { ...pal, mud: pal.near, mudDark: pal.nearDark, mudLight: mix(pal.near, pal.mudLight, 0.6) };
  const { ctx } = tile;
  fillGround(tile, pal.near, pal.nearDark, 0.08);
  const r0 = createRng(`great-war/near-texture/${Math.round(tile.u0)}`).float;
  insideGround(tile, () => {
    scumble(ctx, { x: 0, y: 0, w: tile.width, h: tile.height }, [pal.near, pal.mud, pal.nearDark, shade(pal.grass, 0.8)], r0, {
      count: 700,
      length: H(tile, 0.028),
      width: H(tile, 0.0045),
      alpha: 0.4,
      angle: 0,
      spread: 0.12,
    });
    for (const cell of cellsFor(tile, 120, 90)) {
      const r = cellRandom("near-water", cell);
      if (r() < 0.6) continue;
      const x = tile.tileX(cell * 120 + r() * 120);
      waterLens(ctx, x, groundAt(tile, x) + H(tile, 0.03 + r() * 0.06), H(tile, 0.05 + r() * 0.08), H(tile, 0.003 + r() * 0.003), nearPal, r);
    }
  });
  lightPatches(tile, nearPal, 33, 200, 0.28);
  for (const cell of cellsFor(tile, 34, 40)) {
    const r = cellRandom("near-craters", cell);
    if (r() < 0.62) continue;
    const x = tile.tileX(cell * 34 + r() * 34);
    const y = groundAt(tile, x) + H(tile, 0.025 + r() * 0.06);
    crater(ctx, x, y, H(tile, 0.03 + r() * 0.035), nearPal, r, r() < 0.3);
  }
  const wireR = createRng(`great-war/near-wire/${Math.round(tile.u0)}`).float;
  wireRun(ctx, -30, tile.width + 30, (x) => groundAt(tile, x) + H(tile, 0.004), H(tile, 0.03), pal, wireR, H(tile, 0.05));
  rimGround(tile, pal, flare(tile) ? 0.6 : 0.18);
  applyGrain(ctx, 0, 0, tile.width, tile.height, 0.35, 13);
}

/* ---------- front: the wire at the viewer's feet ---------- */

function paintFront(tile: TileRequest) {
  const pal = paletteFor(tile.appearance, tile.lighting);
  const { ctx } = tile;
  fillGround(tile, pal.foreground, pal.foreground, 0.05);
  for (const cell of cellsFor(tile, 30, 30)) {
    const r = cellRandom("front-wire", cell);
    if (r() < 0.4) continue;
    const x = tile.tileX(cell * 30 + r() * 10);
    const w = H(tile, 0.08 + r() * 0.16);
    wireCoil(ctx, x, x + w, groundAt(tile, x) + H(tile, 0.01), H(tile, 0.035 + r() * 0.045), pal, r);
  }
  for (const cell of cellsFor(tile, 22, 20)) {
    const r = cellRandom("front-stakes", cell);
    if (r() < 0.7) continue;
    const x = tile.tileX(cell * 22 + r() * 22);
    const h = H(tile, 0.04 + r() * 0.07);
    const lean = (r() - 0.5) * 0.8;
    ctx.strokeStyle = css(pal.foreground);
    ctx.lineWidth = Math.max(2, h * 0.06);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, groundAt(tile, x) + 4);
    ctx.lineTo(x + lean * h, groundAt(tile, x) - h);
    ctx.stroke();
  }
  const r0 = createRng(`great-war/front-grass/${Math.round(tile.u0)}`).float;
  ctx.strokeStyle = css(pal.foreground);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 180; i++) {
    const x = r0() * tile.width;
    const y = groundAt(tile, x) + 3;
    const h = H(tile, 0.006 + r0() * 0.02);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r0() - 0.3) * h * 0.5, y - h * 0.6, x + (r0() - 0.2) * h * 0.8, y - h);
    ctx.stroke();
  }
  rimGround(tile, pal, flare(tile) ? 0.35 : 0.06);
}

/* ---------- The layers ---------- */

const rolling = (seed: number, length: number, amplitude: number) => (u: number) => fbm1(u / length, seed, 4) * amplitude;

export const greatWarLayers: SideLayer[] = [
  { id: "far", parallax: 0.12, baseline: 0.594, headroom: 0.09, contour: rolling(3, 700, 0.016), paint: paintFar },
  { id: "country", parallax: 0.32, baseline: 0.652, headroom: 0.11, contour: rolling(5, 420, 0.018), paint: paintCountry },
  { id: "field", parallax: 1, baseline: 0.738, headroom: 0.11, contour: rolling(7, 380, 0.012), paint: paintField },
  { id: "near", parallax: 1.75, baseline: 0.868, headroom: 0.07, contour: rolling(9, 160, 0.018), paint: paintNear, front: true },
  { id: "front", parallax: 2.7, baseline: 0.97, headroom: 0.14, contour: rolling(11, 60, 0.02), paint: paintFront, front: true },
];
