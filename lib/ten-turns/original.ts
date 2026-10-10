/*
 * The 1970s program, rule for rule. Every number it computes is computed the
 * same way here: its rough pi, angles cut to whole degrees before rounding,
 * the player's position trimmed to three decimals and rounded, and the slip
 * that pulls the player back to the middle rows. Each of its three quirks can
 * be switched off, so the checks can measure what each one does to the game.
 *
 * The 1970s terminal plays from this module; the words it prints are ours.
 */

import { type Cell, PIT_RADIUS } from "./geometry";

export type Quirks = {
  /** The player's new y is worked out from y + 1000 instead of y * 1000, which drags it to 0, 1 or 2. */
  middleRowPull: boolean;
  /** With the player straight north of it, the rabbit's move is skipped. */
  frozenNorth: boolean;
  /** A landing on the player is only noticed when the next turn starts, and after turn ten there is none. */
  lastTurnLoophole: boolean;
};

export const AS_WRITTEN: Quirks = { middleRowPull: true, frozenNorth: true, lastTurnLoophole: true };
export const ALL_FIXED: Quirks = { middleRowPull: false, frozenNorth: false, lastTurnLoophole: false };

/** The program's own pi, and degrees in its radians. */
export const OLD_PI = 3.14159;
const DEGREE = OLD_PI / 180;

export const TURNS = 10;

export type Point = { x: number; y: number };

export type OriginalOutcome = "squish" | "crunch" | "ran-into" | "released";

export type OriginalGame = {
  quirks: Quirks;
  /** Always whole numbers; nothing keeps it inside the pit. */
  rabbit: Cell;
  /** The player's position: whatever was typed at the drop, whole numbers after the first run. */
  player: Point;
  /** 1 to 10. */
  turn: number;
  /** The pounce count the chance of another pounce is worked from (1 in `chain`). */
  chain: number;
  dropped: boolean;
  outcome: OriginalOutcome | null;
};

/** What happened, in order, for the terminal to print and the tests to check. */
export type OriginalEvent =
  | { kind: "drop-outside" }
  | { kind: "squish" }
  | { kind: "turn"; turn: number; rabbit: Cell; distance: number; player: Point }
  | { kind: "bad-angle" }
  | { kind: "wall" }
  | { kind: "ran"; player: Point }
  | { kind: "ran-into" }
  | { kind: "pounce"; angle: number | null; rabbit: Cell }
  | { kind: "crunch" }
  | { kind: "released" };

const floor = Math.floor;

/** Where the rabbit starts: whole numbers from -10 to 10 each way, drawn again until inside the pit. */
export function rabbitStart(random: () => number): Cell {
  for (;;) {
    const x = floor(21 * random() - 10);
    const y = floor(21 * random() - 10);
    if (Math.sqrt(x * x + y * y) <= PIT_RADIUS) return { x, y };
  }
}

export function newGame(rabbit: Cell, quirks: Quirks = AS_WRITTEN): OriginalGame {
  return { quirks, rabbit, player: { x: 0, y: 0 }, turn: 1, chain: 1, dropped: false, outcome: null };
}

const distanceTo = (game: OriginalGame) => Math.sqrt((game.rabbit.x - game.player.x) ** 2 + (game.rabbit.y - game.player.y) ** 2);

function turnReport(game: OriginalGame): OriginalEvent {
  return { kind: "turn", turn: game.turn, rabbit: { ...game.rabbit }, distance: distanceTo(game), player: { ...game.player } };
}

/** The drop: a point inside the pit; landing exactly on the rabbit squashes it. */
export function drop(game: OriginalGame, x: number, y: number): OriginalEvent[] {
  if (Math.sqrt(x * x + y * y) > PIT_RADIUS) return [{ kind: "drop-outside" }];
  game.player = { x, y };
  game.dropped = true;
  if (x === game.rabbit.x && y === game.rabbit.y) {
    game.outcome = "squish";
    return [{ kind: "squish" }];
  }
  return [turnReport(game)];
}

/** The size of a step at an angle: 1, or the square root of two on the diagonals. */
export function playerStepLength(angle: number) {
  return Math.abs(floor(angle / 10) * 10 - angle) === 5 ? Math.SQRT2 : 1;
}

/** Where a run at `angle` would end, or why it can't be run. */
export function runTarget(game: OriginalGame, angle: number): { ok: true; to: Point } | { ok: false; reason: "bad-angle" | "wall" } {
  if (angle / 45 !== floor(angle / 45)) return { ok: false, reason: "bad-angle" };
  const m = playerStepLength(angle);
  const dx = m * Math.cos(angle * DEGREE);
  const dy = m * Math.sin(angle * DEGREE);
  const { x, y } = game.player;
  if (Math.sqrt((x + dx) ** 2 + (y + dy) ** 2) > PIT_RADIUS) return { ok: false, reason: "wall" };
  const nx = floor(x * 1000) / 1000 + dx;
  // The slip: the y + 1000 below should have been y * 1000. INT(y + 1000) / 1000 is about 1, whatever y was.
  const ny = (game.quirks.middleRowPull ? floor(y + 1000) / 1000 : floor(y * 1000) / 1000) + dy;
  return { ok: true, to: { x: floor(nx + 0.5), y: floor(ny + 0.5) } };
}

/**
 * The rabbit's direction to the player in whole degrees, the way the program
 * works it out: the angle off the x axis cut to whole degrees, then put in its
 * quarter of the circle. `null` when the rabbit stays put: straight south of
 * the player with the quirk on.
 */
export function pounceAngle(rabbit: Cell, player: Point, quirks: Quirks): number | null {
  const dx = player.x - rabbit.x;
  const dy = player.y - rabbit.y;
  let b: number;
  if (dx === 0) {
    if (dy < 0) b = 270;
    else if (quirks.frozenNorth) return null;
    else b = 90;
  } else if (dy === 0) {
    // The program writes 1 for due east; rounding to 45 degrees turns it into 0.
    b = dx < 0 ? 180 : 1;
  } else {
    b = floor(Math.atan(Math.abs(dy / dx)) / DEGREE);
    if (dx < 0) b = dy < 0 ? b + 180 : 180 - b;
    else if (dy < 0) b = 360 - b;
  }
  return floor(b / 45 + 0.5) * 45;
}

/** One pounce: 1 along the axes, 1.5 on the diagonals, rounded to whole numbers. */
export function pounceFrom(rabbit: Cell, angle: number): Cell {
  const m = Math.abs(floor(angle / 10) * 10 - angle) === 5 ? 1.5 : 1;
  return { x: floor(rabbit.x + m * Math.cos(angle * DEGREE) + 0.5), y: floor(rabbit.y + m * Math.sin(angle * DEGREE) + 0.5) };
}

/**
 * The player runs at `angle`, then the rabbit takes its turn: it pounces,
 * and keeps pouncing while the dice allow, unless it lands on the player.
 */
export function run(game: OriginalGame, angle: number, random: () => number): OriginalEvent[] {
  if (game.outcome || !game.dropped) return [];
  const target = runTarget(game, angle);
  if (!target.ok) return [{ kind: target.reason }];
  game.player = target.to;
  const events: OriginalEvent[] = [{ kind: "ran", player: { ...game.player } }];
  if (game.player.x === game.rabbit.x && game.player.y === game.rabbit.y) {
    game.outcome = "ran-into";
    return [...events, { kind: "ran-into" }];
  }

  game.chain = 1;
  for (;;) {
    game.chain += 1;
    const pounceAt = pounceAngle(game.rabbit, game.player, game.quirks);
    if (pounceAt !== null) game.rabbit = pounceFrom(game.rabbit, pounceAt);
    events.push({ kind: "pounce", angle: pounceAt, rabbit: { ...game.rabbit } });
    if (distanceTo(game) === 0) break;
    // P = INT(P1 * RND + 1): another pounce when P comes up 1, a chance of 1 in P1.
    if (floor(game.chain * random() + 1) !== 1) break;
  }

  if (game.turn === TURNS) {
    if (!game.quirks.lastTurnLoophole && distanceTo(game) === 0) {
      game.outcome = "crunch";
      return [...events, { kind: "crunch" }];
    }
    game.outcome = "released";
    return [...events, { kind: "released" }];
  }
  game.turn += 1;
  events.push(turnReport(game));
  if (distanceTo(game) === 0) {
    game.outcome = "crunch";
    events.push({ kind: "crunch" });
  }
  return events;
}
