/*
 * The carved board as numbers: where each hollow sits, how deep it goes,
 * and the shape of the wood around it. The mesh builder, the seed physics
 * and the screen labels all read the same functions, so a seed always rests
 * on the surface that is drawn. Units are centimetres; y is up, +z points
 * at the player, the board's base sits on the table at y = 0.
 */

import { HOLES, isStore, NORTH_STORE, SOUTH_STORE } from "@/lib/long-memory/board";
import { smoothstep, type Vec3 } from "./math";

export const BOARD = {
  halfLength: 32.5,
  halfWidth: 10.4,
  /** Height of the top face above the table. */
  top: 6.2,
  cornerRadius: 5.2,
  /** The rounded-over edge between the top face and the sides. */
  roundover: 1.25,
  /** Gap between the table and the underside, behind a chamfer: the board looks lifted. */
  plinth: 0.55,
};

export const PIT = { radius: 3.2, depth: 2.45, spacing: 7.45, rowZ: 4.75, rimBlend: 0.5 };
export const STORE = { halfX: 3.45, halfZ: 7.6, depth: 3.1, centerX: 26.15 };

/** Seeds: about 1.5 cm across, like the grey nickernuts many boards are played with. */
export const SEED_RADIUS = 0.86;

export type Hollow = {
  hole: number;
  store: boolean;
  /** Centre of the opening on the top face. */
  cx: number;
  cz: number;
  /** Half-size of the opening along x and z (equal for pits). */
  ax: number;
  az: number;
  depth: number;
  /** Sphere radius of the bowl in units of the opening's half-size: the profile is a spherical cap. */
  bowl: number;
};

function bowlRadius(halfSize: number, depth: number) {
  return (halfSize * halfSize + depth * depth) / (2 * depth) / halfSize;
}

function pitX(column: number) {
  return (column - 2.5) * PIT.spacing;
}

function makeHollow(hole: number): Hollow {
  if (hole === SOUTH_STORE || hole === NORTH_STORE) {
    const sign = hole === SOUTH_STORE ? 1 : -1;
    return { hole, store: true, cx: sign * STORE.centerX, cz: 0, ax: STORE.halfX, az: STORE.halfZ, depth: STORE.depth, bowl: bowlRadius(1, STORE.depth / STORE.halfX) };
  }
  const south = hole < SOUTH_STORE;
  const column = south ? hole : 12 - hole;
  return { hole, store: false, cx: pitX(column), cz: south ? PIT.rowZ : -PIT.rowZ, ax: PIT.radius, az: PIT.radius, depth: PIT.depth, bowl: bowlRadius(PIT.radius, PIT.depth) };
}

export const HOLLOWS: Hollow[] = Array.from({ length: HOLES }, (_, hole) => makeHollow(hole));

/** The hollow's surface depth below the top face at normalised radius ρ (0 centre, 1 rim). */
function capDepth(h: Hollow, rho: number) {
  const r = h.bowl;
  const rim = Math.sqrt(r * r - 1);
  const profile = (Math.sqrt(Math.max(0, r * r - rho * rho)) - rim) / (r - rim);
  return h.depth * profile;
}

/** Normalised radius of a point from a hollow's centre. Stores stretch along z, so the shape is elliptic. */
export function rhoOf(h: Hollow, x: number, z: number) {
  return Math.hypot((x - h.cx) / h.ax, (z - h.cz) / h.az);
}

/* ---------- The board's outline: a rounded rectangle ---------- */

/** Signed distance from the board's outline in plan, negative inside. */
export function outlineDistance(x: number, z: number) {
  const r = BOARD.cornerRadius;
  const qx = Math.abs(x) - (BOARD.halfLength - r);
  const qz = Math.abs(z) - (BOARD.halfWidth - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qz), 0) - r;
}

/** The nearest point on the outline and the outward direction there. */
export function outlinePoint(x: number, z: number) {
  const r = BOARD.cornerRadius;
  const cx = Math.sign(x) * Math.min(Math.abs(x), BOARD.halfLength - r);
  const cz = Math.sign(z) * Math.min(Math.abs(z), BOARD.halfWidth - r);
  const inCorner = Math.abs(x) > BOARD.halfLength - r && Math.abs(z) > BOARD.halfWidth - r;
  if (inCorner) {
    const dx = x - cx;
    const dz = z - cz;
    const l = Math.hypot(dx, dz) || 1;
    return { x: cx + (dx / l) * r, z: cz + (dz / l) * r, nx: dx / l, nz: dz / l };
  }
  // On a straight edge: whichever side is closer.
  const toLong = BOARD.halfWidth - Math.abs(z);
  const toEnd = BOARD.halfLength - Math.abs(x);
  if (toLong < toEnd) return { x, z: Math.sign(z || 1) * BOARD.halfWidth, nx: 0, nz: Math.sign(z || 1) };
  return { x: Math.sign(x || 1) * BOARD.halfLength, z, nx: Math.sign(x || 1), nz: 0 };
}

/* ---------- Heights ---------- */

/** Polynomial smooth minimum: rounds the rim where a hollow meets the top face. */
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Gouge marks: shallow radial scallops a carver's tool leaves in a bowl, a little different in every hollow. */
function toolMarks(h: Hollow, x: number, z: number, rho: number) {
  const angle = Math.atan2((z - h.cz) / h.az, (x - h.cx) / h.ax);
  const facets = h.store ? 17 : 11 + (h.hole % 3);
  const twist = 0.35 * Math.sin(h.hole * 1.7) * rho;
  const t = ((((angle / (Math.PI * 2)) * facets + twist + h.hole * 0.37) % 1) + 1) % 1;
  const scallop = 1 - 4 * (t - 0.5) * (t - 0.5);
  const fade = smoothstep(0.2, 0.62, rho) * (1 - smoothstep(0.86, 1, rho));
  return 0.075 * scallop * fade;
}

/** The nearest hollow to a point, if the point is over one. */
export function hollowAt(x: number, z: number): Hollow | null {
  if (Math.abs(x) > STORE.centerX - STORE.halfX * 1.15) {
    const store = HOLLOWS[x > 0 ? SOUTH_STORE : NORTH_STORE];
    return rhoOf(store, x, z) < 1.12 ? store : null;
  }
  const column = Math.min(5, Math.max(0, Math.round(x / PIT.spacing + 2.5)));
  const pit = HOLLOWS[z > 0 ? column : 12 - column];
  return rhoOf(pit, x, z) < 1.12 ? pit : null;
}

/**
 * Height of the top surface at (x, z): the flat face, the hollows with their
 * rounded rims and tool marks, and the rounded-over edge near the outline.
 */
export function surfaceHeight(x: number, z: number, withMarks = true) {
  let y = BOARD.top;
  const h = hollowAt(x, z);
  if (h) {
    const rho = rhoOf(h, x, z);
    if (rho < 1.12) {
      const cap = rho < 1 ? BOARD.top - capDepth(h, rho) + (withMarks ? toolMarks(h, x, z, rho) : 0) : BOARD.top + (rho - 1) * 4;
      y = smin(BOARD.top, cap, PIT.rimBlend);
    }
  }
  const inset = -outlineDistance(x, z);
  const r = BOARD.roundover;
  if (inset < r) {
    const d = Math.max(0, inset);
    y = Math.min(y, BOARD.top - r + Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))));
  }
  return y;
}

/* ---------- Physics: the solid wood as a distance field ---------- */

/**
 * Signed distance from a point to the wood of one hollow (positive in the
 * air). Above the top face an invisible wall keeps a heap of seeds over its
 * own hollow, the way a player would push a spilling pile back in.
 */
export function hollowDistance(h: Hollow, p: Vec3) {
  const sx = (p[0] - h.cx) / h.ax;
  const sz = (p[2] - h.cz) / h.az;
  const unit = Math.min(h.ax, h.az);
  // The bowl: an ellipsoid (a sphere for pits) whose cap is the hollow.
  const r = h.bowl;
  const centreY = BOARD.top - h.depth + r * unit;
  const sy = (p[1] - centreY) / unit;
  const bowl = (r - Math.hypot(sx, sy, sz)) * unit;
  if (p[1] < BOARD.top) return bowl;
  const wall = (1 - Math.hypot(sx, sz)) * unit - 0.15;
  return Math.min(Math.max(bowl, p[1] - BOARD.top), wall);
}

/* ---------- Points used by the camera, labels and choreography ---------- */

/** Centre of a hollow's opening on the top face. */
export const holeTop = (hole: number): Vec3 => [HOLLOWS[hole].cx, BOARD.top, HOLLOWS[hole].cz];

/** Lowest point of a hollow, where the first seed settles. */
export const holeFloor = (hole: number): Vec3 => [HOLLOWS[hole].cx, BOARD.top - HOLLOWS[hole].depth, HOLLOWS[hole].cz];

/** Where a label for a hole sits: past the pit toward the nearest long edge, or beyond a store's end. */
export function labelAnchor(hole: number): Vec3 {
  const h = HOLLOWS[hole];
  if (isStore(hole)) return [h.cx + Math.sign(h.cx) * (h.ax + 4.2), BOARD.top, 0];
  return [h.cx, BOARD.top, Math.sign(h.cz) * (BOARD.halfWidth + 1.6)];
}

/** The space the camera must keep in view: the board, its shadow side and the book's corner of the table. */
export const FRAME = { minX: -BOARD.halfLength - 2, maxX: BOARD.halfLength + 2, minZ: -BOARD.halfWidth - 17, maxZ: BOARD.halfWidth + 3 };
