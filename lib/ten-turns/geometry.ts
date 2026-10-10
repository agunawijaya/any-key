/*
 * The pit's geometry, shared by every rule set: whole-number cells inside a
 * circle, the eight directions a step can take, and the way a rabbit picks
 * the direction that points nearest to its prey.
 */

export type Cell = { x: number; y: number };

/** The eight directions, counter-clockwise from east, as the original counted angles. */
export const DIRECTIONS = [
  { angle: 0, dx: 1, dy: 0, name: "east" },
  { angle: 45, dx: 1, dy: 1, name: "north-east" },
  { angle: 90, dx: 0, dy: 1, name: "north" },
  { angle: 135, dx: -1, dy: 1, name: "north-west" },
  { angle: 180, dx: -1, dy: 0, name: "west" },
  { angle: 225, dx: -1, dy: -1, name: "south-west" },
  { angle: 270, dx: 0, dy: -1, name: "south" },
  { angle: 315, dx: 1, dy: -1, name: "south-east" },
] as const;

export type Direction = (typeof DIRECTIONS)[number];

/** The pit of the original: radius 10 around (0, 0). */
export const PIT_RADIUS = 10;

export const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

export const keyOf = (c: Cell) => `${c.x},${c.y}`;

export const inCircle = (c: Cell, radius = PIT_RADIUS) => c.x * c.x + c.y * c.y <= radius * radius;

/** Steps a king would need: the number of moves between two cells when diagonals count as one. */
export const kingDistance = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const distance = (a: Cell, b: Cell) => Math.hypot(a.x - b.x, a.y - b.y);

export const step = (c: Cell, d: Direction, by = 1): Cell => ({ x: c.x + d.dx * by, y: c.y + d.dy * by });

/** Every whole-number cell inside a circle, row by row from the south. */
export function cellsInCircle(radius = PIT_RADIUS): Cell[] {
  const cells: Cell[] = [];
  const r = Math.floor(radius);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (inCircle({ x, y }, radius)) cells.push({ x, y });
  return cells;
}

/**
 * The direction from `from` that points nearest to `to`, rounded to the
 * nearest 45 degrees. Whole-number offsets never land exactly between two
 * directions, so there is no tie to break.
 */
export function directionToward(from: Cell, to: Cell): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  const index = ((Math.round(degrees / 45) % 8) + 8) % 8;
  return DIRECTIONS[index];
}

export const directionAt = (angle: number) => DIRECTIONS[(((Math.round(angle / 45) % 8) + 8) % 8)];
