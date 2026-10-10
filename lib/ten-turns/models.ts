/*
 * The two turn-by-turn rule sets as solver models: the 1970s program as
 * written (with any of its quirks switched off), and Classic.
 */

import { CLASSIC_TURNS, rabbitStep } from "./classic";
import { cellsInCircle, type Cell, DIRECTIONS, step, inCircle } from "./geometry";
import { AS_WRITTEN, newGame, pounceAngle, pounceFrom, type Quirks, runTarget, TURNS } from "./original";
import { type Model, rabbitReach } from "./solver";

/** The eight angles the 1970s player could type that mean different things (360 is 0 again). */
export const ORIGINAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** One pounce of the 1970s rabbit, frozen when the player is due north and the quirk is on. */
export function originalPounce(rabbit: Cell, player: Cell, quirks: Quirks): Cell {
  const angle = pounceAngle(rabbit, player, quirks);
  return angle === null ? rabbit : pounceFrom(rabbit, angle);
}

/** Where each of the eight angles takes a 1970s player standing on a whole-number cell; null into a wall. */
export function originalMoves(player: Cell, quirks: Quirks): (Cell | null)[] {
  const game = newGame({ x: 99, y: 99 }, quirks);
  game.player = { ...player };
  return ORIGINAL_ANGLES.map((angle) => {
    const target = runTarget(game, angle);
    return target.ok ? target.to : null;
  });
}

/**
 * Every cell a 1970s player can stand on. Not only the pit: the wall check
 * looks at where the player would be before the slip moves them, so the slip
 * can carry them a step past the wall.
 */
export function originalPlayerReach(quirks: Quirks): Cell[] {
  const seen = new Map(cellsInCircle().map((c) => [`${c.x},${c.y}`, c]));
  const queue = [...seen.values()];
  while (queue.length) {
    const from = queue.pop()!;
    for (const to of originalMoves(from, quirks)) {
      if (!to || seen.has(`${to.x},${to.y}`)) continue;
      seen.set(`${to.x},${to.y}`, to);
      queue.push(to);
    }
  }
  return [...seen.values()];
}

export function originalModel(quirks: Quirks = AS_WRITTEN): Model {
  const players = originalPlayerReach(quirks);
  const pounce = (r: Cell, p: Cell) => originalPounce(r, p, quirks);
  return {
    players,
    rabbits: rabbitReach(cellsInCircle(), players, pounce),
    turns: TURNS,
    moves: (player) => originalMoves(player, quirks).filter((to): to is Cell => to !== null),
    pounce,
    landingCatches: (turn) => !(quirks.lastTurnLoophole && turn === TURNS),
  };
}

export function classicModel(): Model {
  const cells = cellsInCircle();
  return {
    players: cells,
    rabbits: cells,
    turns: CLASSIC_TURNS,
    moves: (player) => DIRECTIONS.map((d) => step(player, d)).filter((to) => inCircle(to)),
    pounce: (r, p) => rabbitStep(r, p),
    landingCatches: () => true,
  };
}
