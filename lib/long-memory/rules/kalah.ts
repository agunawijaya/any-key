/*
 * Kalah, the rules William Julius Champion Jr. sold in the United States:
 *
 * - three to six seeds a pit (four is the usual game);
 * - seeds go round counter-clockwise into your own store but never into
 *   your opponent's;
 * - a last seed in your own store earns another move, as many as you can chain;
 * - a last seed in an empty pit on your own side captures the pit opposite,
 *   if it has seeds, together with the capturing seed;
 * - when either row is empty the game ends, and each side sweeps the seeds
 *   left in its own pits into its own store.
 */

import { HOLES, NORTH_STORE, oppositeOf, pitsOf, sideOf, SOUTH_STORE, storeOf, type Side } from "../board";
import { other, type MoveOutcome, type Position, type Rules } from "./types";

function sow(board: number[], pit: number, mover: Side) {
  const skip = storeOf(other(mover));
  const path: number[] = [];
  let seeds = board[pit];
  board[pit] = 0;
  let hole = pit;
  while (seeds > 0) {
    hole = (hole + 1) % HOLES;
    if (hole === skip) continue;
    board[hole] += 1;
    path.push(hole);
    seeds -= 1;
  }
  return path;
}

const rowTotal = (board: number[], side: Side) => pitsOf(side).reduce((sum, p) => sum + board[p], 0);

function play(position: Position, pit: number): MoveOutcome {
  const board = [...position.board];
  const mover = position.toMove;
  const store = storeOf(mover);
  const path = sow(board, pit, mover);
  const last = path[path.length - 1];

  const captures = [];
  if (last !== SOUTH_STORE && last !== NORTH_STORE && sideOf(last) === mover && board[last] === 1 && board[oppositeOf(last)] > 0) {
    const across = oppositeOf(last);
    const seeds = board[across] + 1;
    board[store] += seeds;
    board[last] = 0;
    board[across] = 0;
    captures.push({ from: [across, last], to: store, seeds });
  }

  let sweep = null;
  const over = rowTotal(board, "south") === 0 || rowTotal(board, "north") === 0;
  if (over) {
    sweep = { south: rowTotal(board, "south"), north: rowTotal(board, "north") };
    for (const side of ["south", "north"] as const) {
      for (const p of pitsOf(side)) board[p] = 0;
    }
    board[SOUTH_STORE] += sweep.south;
    board[NORTH_STORE] += sweep.north;
  }
  const extraTurn = !over && last === store;
  const next: Position = { board, toMove: extraTurn ? mover : other(mover), extraUsed: false, plies: position.plies + 1, over };
  return { pit, path, captures, grandSlamForfeit: false, sweep, extraTurn, ending: over ? "side-empty" : null, next };
}

export const kalah: Rules = {
  id: "kalah",
  title: "Kalah",
  defaultSeeds: 4,
  seedChoices: [3, 4, 5, 6],
  start(seedsPerPit = 4, first: Side = "south") {
    const board = Array.from({ length: HOLES }, (_, hole) => (hole === SOUTH_STORE || hole === NORTH_STORE ? 0 : seedsPerPit));
    return { board, toMove: first, extraUsed: false, plies: 0, over: false };
  },
  legal(position) {
    if (position.over) return [];
    return pitsOf(position.toMove).filter((p) => position.board[p] > 0);
  },
  play,
};
