/*
 * What every rule set provides. A position is plain data; playing a pit
 * returns the next position together with everything the board needs to
 * animate the move: where each seed went, what was captured, whether the
 * same player moves again, and how the game ended.
 */

import type { Board, Side } from "../board";

export type RuleId = "awari1978" | "oware" | "kalah";

export type Position = {
  board: Board;
  toMove: Side;
  /** 1978 Awari only: the player to move is already on their one extra move. */
  extraUsed: boolean;
  /** Sowings made so far, both players, extra moves included. */
  plies: number;
  over: boolean;
};

export type Capture = {
  /** The holes emptied, in the order they are taken. */
  from: number[];
  /** The store they go to. */
  to: number;
  seeds: number;
};

export type Ending =
  /** One side's pits are empty. */
  | "side-empty"
  /** Oware: someone has more than half the seeds. */
  | "majority"
  /** Oware: the player to move cannot give the empty side any seeds, and keeps their own. */
  | "cannot-feed"
  /** Oware: the same position kept coming back; each side keeps what is on its side. */
  | "repetition";

export type MoveOutcome = {
  pit: number;
  /** Every hole a seed was dropped into, in order. */
  path: number[];
  captures: Capture[];
  /** Oware: the move would have taken every seed the opponent had, so it captures nothing. */
  grandSlamForfeit: boolean;
  /** Seeds swept into the stores when the game ended (Kalah, and Oware's endings). */
  sweep: { south: number; north: number } | null;
  /** The same player sows again. */
  extraTurn: boolean;
  ending: Ending | null;
  next: Position;
};

export type Rules = {
  id: RuleId;
  /** The rule set's name as the game shows it. */
  title: string;
  defaultSeeds: number;
  /** Seeds per pit the player may choose from (Kalah allows 3 to 6). */
  seedChoices: number[];
  start(seedsPerPit?: number, first?: Side): Position;
  /** Pits the player to move may sow from. */
  legal(position: Position): number[];
  play(position: Position, pit: number): MoveOutcome;
};

export function score(position: Position) {
  return { south: position.board[6], north: position.board[13] };
}

/** South's margin over north in the stores: positive when the player is ahead. */
export const margin = (position: Position) => position.board[6] - position.board[13];

export function winner(position: Position): Side | "draw" {
  const m = margin(position);
  return m > 0 ? "south" : m < 0 ? "north" : "draw";
}

export const other = (side: Side): Side => (side === "south" ? "north" : "south");
