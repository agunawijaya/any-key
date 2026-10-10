/*
 * Classic: the 1970s game with its slips put right. Both of you stand on
 * whole-number cells inside the pit; you step one cell in eight directions,
 * never into the wall or onto the rabbit; the rabbit pounces one cell
 * towards you, and may pounce again (1 in 2, then 1 in 3, then 1 in 4...).
 * Survive ten of its turns and you are released; a landing on you in the
 * tenth turn counts.
 */

import { cellsInCircle, type Cell, type Direction, DIRECTIONS, directionToward, inCircle, PIT_RADIUS, same, step } from "./geometry";

export const CLASSIC_TURNS = 10;

export type ClassicOutcome = "squish" | "crunch" | "released";

export type ClassicState = {
  rabbit: Cell;
  /** Null until the drop. */
  player: Cell | null;
  /** The turn being played, 1 to 10. */
  turn: number;
  outcome: ClassicOutcome | null;
};

export type Pounce = { from: Cell; to: Cell; direction: Direction | null; again: boolean };

export type RabbitTurn = { pounces: Pounce[]; caught: boolean };

/** The odds of one more pounce after the `count`th: 1 in count + 1. */
export const chainChance = (count: number) => 1 / (count + 1);

/** Where the rabbit starts: any cell in the pit, all equally likely, as in the original. */
export function classicStart(random: () => number): ClassicState {
  const cells = cellsInCircle();
  return { rabbit: cells[Math.floor(random() * cells.length)], player: null, turn: 1, outcome: null };
}

/**
 * One pounce towards `target`. A pounce that would leave the pit swings to the
 * next nearest direction that stays in; with none, the rabbit stays put.
 */
export function rabbitStep(rabbit: Cell, target: Cell, radius = PIT_RADIUS): Cell {
  const toward = directionToward(rabbit, target);
  if (!toward) return rabbit;
  const index = DIRECTIONS.indexOf(toward);
  const aim = Math.atan2(target.y - rabbit.y, target.x - rabbit.x);
  const neighbours = [DIRECTIONS[(index + 1) % 8], DIRECTIONS[(index + 7) % 8]].sort(
    (a, b) => angleGap(a.angle, aim) - angleGap(b.angle, aim),
  );
  for (const d of [toward, ...neighbours]) {
    const to = step(rabbit, d);
    if (inCircle(to, radius)) return to;
  }
  return rabbit;
}

/** How far apart two headings are, the short way round, in radians. */
function angleGap(degrees: number, radians: number) {
  const gap = Math.abs((degrees * Math.PI) / 180 - radians) % (Math.PI * 2);
  return gap > Math.PI ? Math.PI * 2 - gap : gap;
}

export function canDrop(cell: Cell) {
  return inCircle(cell);
}

export function dropAt(state: ClassicState, cell: Cell): ClassicState {
  if (!canDrop(cell) || state.player) return state;
  return { ...state, player: cell, outcome: same(cell, state.rabbit) ? "squish" : null };
}

export type MoveCheck = { ok: true; to: Cell } | { ok: false; reason: "wall" | "rabbit" };

export function checkMove(state: ClassicState, d: Direction): MoveCheck {
  const to = step(state.player!, d);
  if (!inCircle(to)) return { ok: false, reason: "wall" };
  if (same(to, state.rabbit)) return { ok: false, reason: "rabbit" };
  return { ok: true, to };
}

export function legalMoves(state: ClassicState): Direction[] {
  return DIRECTIONS.filter((d) => checkMove(state, d).ok);
}

/** The rabbit's whole turn after the player stepped to `player`. */
export function rabbitTurn(rabbit: Cell, player: Cell, random: () => number): RabbitTurn {
  const pounces: Pounce[] = [];
  let at = rabbit;
  for (let count = 1; ; count++) {
    const to = rabbitStep(at, player);
    const caught = same(to, player);
    const again = !caught && random() < chainChance(count);
    pounces.push({ from: at, to, direction: directionToward(at, player), again });
    at = to;
    if (caught) return { pounces, caught: true };
    if (!again) return { pounces, caught: false };
  }
}

/** The player steps; the rabbit answers. Returns the new state and what the rabbit did. */
export function playTurn(state: ClassicState, d: Direction, random: () => number): { state: ClassicState; rabbit: RabbitTurn } | null {
  if (state.outcome || !state.player) return null;
  const move = checkMove(state, d);
  if (!move.ok) return null;
  const answer = rabbitTurn(state.rabbit, move.to, random);
  const rabbit = answer.pounces[answer.pounces.length - 1].to;
  const outcome: ClassicOutcome | null = answer.caught ? "crunch" : state.turn === CLASSIC_TURNS ? "released" : null;
  return { state: { rabbit, player: move.to, turn: outcome ? state.turn : state.turn + 1, outcome }, rabbit: answer };
}

/* ---------- A fair start ---------- */

/** No Classic game starts where even the best play would survive less often than this. */
export const FAIR_FLOOR = 0.4;

/**
 * Where the rabbit turns out to be, once you have dropped in blind. As in the
 * original, it is right under you one time in 317 (the squish); otherwise it
 * is anywhere you could still escape from with good play: never so close
 * that the game is lost before it begins. `survival(drop, start)` is the
 * solved chance of lasting from that start (see classicTable).
 */
export function rabbitAfterDrop(drop: Cell, random: () => number, survival: (drop: Cell, start: Cell) => number): Cell {
  const cells = cellsInCircle();
  if (random() < 1 / cells.length) return drop;
  const fair = cells.filter((c) => !same(c, drop) && survival(drop, c) >= FAIR_FLOOR);
  return fair[Math.floor(random() * fair.length)];
}
