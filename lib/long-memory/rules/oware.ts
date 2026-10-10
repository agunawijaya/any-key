/*
 * Oware, as the Abapa rules play it (the form used in international play):
 *
 * - four seeds in each of the twelve pits; the stores only hold captures;
 * - seeds go round counter-clockwise, one a pit; a pit sown with twelve or
 *   more skips itself on the way round;
 * - if the last seed makes a pit on the opponent's side hold two or three,
 *   those seeds are captured, and so are the pits just before it, going
 *   back, while they also hold two or three and are on the opponent's side;
 * - a move that would capture every seed the opponent has captures nothing
 *   (the grand slam rule);
 * - when the opponent's row is empty you must sow seeds into it if you can;
 *   if you cannot, you keep the seeds on your side and the game ends;
 * - more than half the seeds (25 of 48) wins; 24 each is a draw.
 *
 * Endless cycles near the end are a match-level matter: see `endByRepetition`.
 */

import { HOLES, NORTH_STORE, pitsOf, sideOf, SOUTH_STORE, storeOf, type Side } from "../board";
import { other, type Capture, type MoveOutcome, type Position, type Rules } from "./types";

const isPit = (hole: number) => hole !== SOUTH_STORE && hole !== NORTH_STORE;
const nextPit = (hole: number) => {
  let h = (hole + 1) % HOLES;
  while (!isPit(h)) h = (h + 1) % HOLES;
  return h;
};
const previousPit = (hole: number) => {
  let h = (hole + HOLES - 1) % HOLES;
  while (!isPit(h)) h = (h + HOLES - 1) % HOLES;
  return h;
};
const rowTotal = (board: readonly number[], side: Side) => pitsOf(side).reduce((sum, p) => sum + board[p], 0);

function sow(board: number[], pit: number) {
  const path: number[] = [];
  let seeds = board[pit];
  board[pit] = 0;
  let hole = pit;
  while (seeds > 0) {
    hole = nextPit(hole);
    if (hole === pit) continue;
    board[hole] += 1;
    path.push(hole);
    seeds -= 1;
  }
  return path;
}

/** Does sowing this pit drop at least one seed on the other side? */
function feeds(board: readonly number[], pit: number, mover: Side) {
  const trial = [...board];
  return sow(trial, pit).some((h) => sideOf(h) !== mover);
}

function legal(position: Position) {
  if (position.over) return [];
  const mover = position.toMove;
  const own = pitsOf(mover).filter((p) => position.board[p] > 0);
  if (rowTotal(position.board, other(mover)) > 0) return own;
  return own.filter((p) => feeds(position.board, p, mover));
}

function play(position: Position, pit: number): MoveOutcome {
  const board = [...position.board];
  const mover = position.toMove;
  const store = storeOf(mover);
  const path = sow(board, pit);
  const last = path[path.length - 1];

  const captures: Capture[] = [];
  let grandSlamForfeit = false;
  if (sideOf(last) !== mover && (board[last] === 2 || board[last] === 3)) {
    const taken: number[] = [];
    let hole = last;
    while (isPit(hole) && sideOf(hole) !== mover && (board[hole] === 2 || board[hole] === 3)) {
      taken.push(hole);
      hole = previousPit(hole);
    }
    const seeds = taken.reduce((sum, h) => sum + board[h], 0);
    if (seeds === rowTotal(board, other(mover))) grandSlamForfeit = true;
    else {
      for (const h of taken) board[h] = 0;
      board[store] += seeds;
      captures.push({ from: taken, to: store, seeds });
    }
  }

  const next: Position = { board, toMove: other(mover), extraUsed: false, plies: position.plies + 1, over: false };
  let ending: MoveOutcome["ending"] = null;
  let sweep = null;
  if (board[SOUTH_STORE] > 24 || board[NORTH_STORE] > 24 || (board[SOUTH_STORE] === 24 && board[NORTH_STORE] === 24)) {
    ending = "majority";
  } else if (legal(next).length === 0) {
    // The next player cannot give the mover any seeds: they keep what lies on their side, and the game ends.
    ending = "cannot-feed";
    const keeper = next.toMove;
    const kept = rowTotal(board, keeper);
    for (const p of pitsOf(keeper)) board[p] = 0;
    board[storeOf(keeper)] += kept;
    sweep = keeper === "south" ? { south: kept, north: 0 } : { south: 0, north: kept };
  }
  next.over = ending !== null;
  return { pit, path, captures, grandSlamForfeit, sweep, extraTurn: false, ending, next };
}

/** Ends a game that has gone round in circles: each player keeps the seeds on their own side. */
export function endByRepetition(position: Position): Position {
  const board = [...position.board];
  for (const side of ["south", "north"] as const) {
    const kept = rowTotal(board, side);
    for (const p of pitsOf(side)) board[p] = 0;
    board[storeOf(side)] += kept;
  }
  return { ...position, board, over: true };
}

export const oware: Rules = {
  id: "oware",
  title: "Oware",
  defaultSeeds: 4,
  seedChoices: [4],
  start(seedsPerPit = 4, first: Side = "south") {
    const board = Array.from({ length: HOLES }, (_, hole) => (isPit(hole) ? seedsPerPit : 0));
    return { board, toMove: first, extraUsed: false, plies: 0, over: false };
  },
  legal,
  play,
};
