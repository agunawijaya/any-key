/*
 * 1978 Awari, exactly as the program played it:
 *
 * - three seeds in every pit, stores empty, the player sows first;
 * - seeds go into every hole in turn, both stores included, so a long
 *   sowing can drop seeds into the opponent's store;
 * - a last seed in an empty pit (on either side) captures the pit opposite,
 *   if that pit has seeds, together with the capturing seed;
 * - a last seed in your own store earns one extra move, never a second;
 * - the game stops the moment either row of pits is empty, and seeds still
 *   in the pits stay there: only the stores count.
 */

import { HOLES, NORTH_STORE, oppositeOf, pitsOf, SOUTH_STORE, storeOf, type Side } from "../board";
import { other, type MoveOutcome, type Position, type Rules } from "./types";

/** Drops the seeds of `pit` one by one into the holes after it, all fourteen in turn. */
export function sowAll(board: number[], pit: number) {
  const path: number[] = [];
  let seeds = board[pit];
  board[pit] = 0;
  let hole = pit;
  while (seeds > 0) {
    hole = (hole + 1) % HOLES;
    board[hole] += 1;
    path.push(hole);
    seeds -= 1;
  }
  return path;
}

const rowEmpty = (board: number[], side: Side) => pitsOf(side).every((p) => board[p] === 0);

function play(position: Position, pit: number): MoveOutcome {
  const board = [...position.board];
  const mover = position.toMove;
  const store = storeOf(mover);
  const path = sowAll(board, pit);
  const last = path[path.length - 1];

  const captures = [];
  const across = oppositeOf(last);
  if (board[last] === 1 && last !== SOUTH_STORE && last !== NORTH_STORE && board[across] !== 0) {
    const seeds = board[across] + 1;
    board[store] += seeds;
    board[last] = 0;
    board[across] = 0;
    captures.push({ from: [across, last], to: store, seeds });
  }

  const over = rowEmpty(board, "south") || rowEmpty(board, "north");
  const extraTurn = !over && last === store && !position.extraUsed;
  const next: Position = {
    board,
    toMove: extraTurn ? mover : other(mover),
    extraUsed: extraTurn,
    plies: position.plies + 1,
    over,
  };
  return { pit, path, captures, grandSlamForfeit: false, sweep: null, extraTurn, ending: over ? "side-empty" : null, next };
}

export const awari1978: Rules = {
  id: "awari1978",
  title: "1978 Awari",
  defaultSeeds: 3,
  seedChoices: [3],
  start(seedsPerPit = 3, first: Side = "south") {
    const board = Array.from({ length: HOLES }, (_, hole) => (hole === SOUTH_STORE || hole === NORTH_STORE ? 0 : seedsPerPit));
    return { board, toMove: first, extraUsed: false, plies: 0, over: false };
  },
  legal(position) {
    if (position.over) return [];
    return pitsOf(position.toMove).filter((p) => position.board[p] > 0);
  },
  play,
};
