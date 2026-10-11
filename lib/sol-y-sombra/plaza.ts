import { dot, normalize, scale, type Vec3 } from "./rig/vec";

/*
 * The bullring as a place: the sand, the barrier, the passage behind it,
 * the tiers of seats rising in a bowl, the arcaded gallery and roof on top,
 * and the great gate. Measured in metres from the centre of the sand, y up.
 *
 * Also the light: where the afternoon sun is, which stands it lights and
 * which it leaves in shade, and the shadow the shaded stands throw across
 * the sand: the line between sol and sombra that gives the game its name.
 *
 * Styles draw all of this their own way; the shapes and the light live here
 * so the 2D poster and the 3D style agree on them.
 */

export const PLAZA = {
  /** The sand. */
  ring: 20,
  /** The red wooden barrier round the sand. */
  barrierHeight: 1.35,
  /** The passage between the barrier and the first wall. */
  passage: 2.1,
  wallHeight: 2.4,
  /** Rows of seats rising from the wall. */
  rows: 15,
  rowDepth: 0.8,
  rowRise: 0.5,
  /** The gallery above the rows: columns and arches under a tiled roof. */
  galleryDepth: 3.2,
  galleryHeight: 4.2,
  roofRise: 1.2,
  /** Painted circles on the sand, measured in from the barrier. */
  rings: [7, 10],
  /** The great gate, at this angle round the ring. */
  gateAzimuth: Math.PI * 0.5,
  gateWidth: 4.4,
  gateHeight: 4.8,
  /** The bulls' door in the barrier, where the bull comes in from the pens and goes back out. */
  torilAzimuth: -1.05,
  torilWidth: 1.75,
  torilHeight: 2.2,
  /** Aisles of steps cut through the rows at these angles. */
  aisles: 16,
};

export const wallRadius = () => PLAZA.ring + PLAZA.passage;

/** The front edge of a row of seats: its distance from the centre and its height. */
export function row(index: number) {
  return { radius: wallRadius() + 0.3 + index * PLAZA.rowDepth, height: PLAZA.wallHeight + 0.3 + index * PLAZA.rowRise };
}

/** The gallery's floor, behind the top row. */
export function gallery() {
  const top = row(PLAZA.rows);
  return { radius: top.radius, floor: top.height, height: top.height + PLAZA.galleryHeight, back: top.radius + PLAZA.galleryDepth };
}

/** The roof's outer rim, the highest edge of the bowl. */
export function roofRim() {
  const g = gallery();
  return { radius: g.back, height: g.height + PLAZA.roofRise };
}

/** A point at an angle round the ring, at a distance from the centre and a height. */
export const around = (azimuth: number, radius: number, height = 0): Vec3 => ({ x: Math.cos(azimuth) * radius, y: height, z: Math.sin(azimuth) * radius });

/** How far the passage behind the great gate runs out under the stands. */
export const GATE_TUNNEL = 7;

/** The rows the gate is cut through, and the height of the masonry block that fills the cut. */
export function gateCut() {
  let rows = 0;
  while (rows < PLAZA.rows && row(rows).height < PLAZA.gateHeight + 0.6) rows++;
  return { rows, top: row(rows).height };
}

/** Whether an angle falls inside the gate's opening. */
export function inGate(azimuth: number, radius: number) {
  const half = PLAZA.gateWidth / 2 / radius;
  const d = Math.atan2(Math.sin(azimuth - PLAZA.gateAzimuth), Math.cos(azimuth - PLAZA.gateAzimuth));
  return Math.abs(d) < half;
}

/** Whether an angle falls inside the bulls' door in the barrier. */
export function inToril(azimuth: number) {
  const half = PLAZA.torilWidth / 2 / PLAZA.ring;
  const d = Math.atan2(Math.sin(azimuth - PLAZA.torilAzimuth), Math.cos(azimuth - PLAZA.torilAzimuth));
  return Math.abs(d) < half;
}

/** Whether an angle falls on one of the aisles of steps. */
export function inAisle(azimuth: number, radius: number) {
  const spacing = (Math.PI * 2) / PLAZA.aisles;
  const d = ((azimuth % spacing) + spacing) % spacing;
  const half = 0.6 / radius;
  return d < half || d > spacing - half;
}

/* ---------- The light ---------- */

export type Light = {
  /** The direction sunlight travels: from the sun, down onto the sand. */
  sun: Vec3;
  /** 0 the afternoon, 1 the evening festival under lamps. */
  evening: number;
};

/**
 * The late afternoon sun: low enough to throw the shaded stands' shadow well
 * across the sand. `azimuth` is where the sun stands round the ring.
 */
export function afternoonSun(azimuth: number, elevation: number): Vec3 {
  const toSun = { x: Math.cos(azimuth) * Math.cos(elevation), y: Math.sin(elevation), z: Math.sin(azimuth) * Math.cos(elevation) };
  return scale(normalize(toSun), -1);
}

/** Whether the stands at an angle face the sun (lit, the sol side) or turn their backs to it (the sombra side). */
export function standsLit(azimuth: number, sun: Vec3) {
  const inward = { x: -Math.cos(azimuth), y: 0, z: -Math.sin(azimuth) };
  return dot(inward, scale(sun, -1)) > 0;
}

/**
 * Where the sun reaches the sand. Sunlight comes in over the roof's rim, a
 * circle; carried down the sun's rays a level circle lands as the same
 * circle, shifted away from the sun. Sand inside it is in sun, sand outside
 * it lies in the shadow of the stands.
 */
export function sunPatch(sun: Vec3) {
  const rim = roofRim();
  const reach = rim.height / -sun.y;
  return { centre: { x: sun.x * reach, y: 0, z: sun.z * reach }, radius: rim.radius };
}

export type SunPatch = ReturnType<typeof sunPatch>;

/** Whether a point on the sand is in the stands' shadow. */
export function inShadow(point: Vec3, patch: SunPatch) {
  return Math.hypot(point.x - patch.centre.x, point.z - patch.centre.z) > patch.radius;
}
