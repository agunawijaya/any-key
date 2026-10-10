/*
 * One game from start to finish, as plain data: the rule set, who sits
 * north, every position on the way (for undo and for Oware's endless
 * cycles), and the record the Learner keeps of its opening. The screens
 * ask it what is legal, tell it which pit was sown, and read the result.
 */

import { pitsOf, storeOf, type Side } from "./board";
import { newGameRecord, recordSowing, type GameRecord } from "./learner";
import { endByRepetition } from "./rules/oware";
import { RULES, type Ending, type MoveOutcome, type Position, type RuleId } from "./rules";
import type { Difficulty } from "./scholar";

export type Opponent = "learner" | "scholar" | "friend";

export type MatchConfig = {
  rules: RuleId;
  seeds: number;
  opponent: Opponent;
  level: Difficulty;
  /** Who sows first. Against the computer the player always opens. */
  first: Side;
};

export type Played = { side: Side; pit: number; outcome: MoveOutcome };

export type Match = {
  config: MatchConfig;
  position: Position;
  game: GameRecord;
  played: Played[];
  /** Positions before each move, for undo. */
  before: { position: Position; game: GameRecord }[];
  /** Oware: how often each position has been seen, to call an endless cycle. */
  seen: Record<string, number>;
  ending: Ending | null;
};

/** The same position three times in Oware ends the game as an endless cycle. */
export const REPETITIONS = 3;

const repetitionKey = (p: Position) => `${p.board.join(",")}|${p.toMove}`;

/** A new game from the usual start, or from a given position (the Daily Endgame's). */
export function startMatch(config: MatchConfig, from?: Position): Match {
  const rules = RULES[config.rules];
  const position = from ?? rules.start(config.rules === "kalah" ? config.seeds : rules.defaultSeeds, config.first);
  return { config, position, game: newGameRecord(), played: [], before: [], seen: { [repetitionKey(position)]: 1 }, ending: null };
}

export const legalPits = (match: Match) => RULES[match.config.rules].legal(match.position);

export const isOver = (match: Match) => match.position.over;

/** Who is sowing now: "player" for the south seat, otherwise the north seat's occupant. */
export const seatToMove = (match: Match): "player" | Opponent => (match.position.toMove === "south" ? "player" : match.config.opponent);

export function play(match: Match, pit: number): { match: Match; outcome: MoveOutcome } {
  const rules = RULES[match.config.rules];
  if (!rules.legal(match.position).includes(pit)) throw new Error(`Pit ${pit} cannot be sown now`);
  const outcome = rules.play(match.position, pit);
  let position = outcome.next;
  let ending = outcome.ending;
  const seen = { ...match.seen };
  if (match.config.rules === "oware" && !position.over) {
    const key = repetitionKey(position);
    seen[key] = (seen[key] ?? 0) + 1;
    if (seen[key] >= REPETITIONS) {
      const ended = endByRepetition(position);
      outcome.sweep = { south: sideTotal(position, "south"), north: sideTotal(position, "north") };
      outcome.ending = ending = "repetition";
      outcome.next = position = ended;
    }
  }
  return {
    outcome,
    match: {
      ...match,
      position,
      game: recordSowing(match.game, pit),
      played: [...match.played, { side: match.position.toMove, pit, outcome }],
      before: [...match.before, { position: match.position, game: match.game }],
      seen,
      ending,
    },
  };
}

const sideTotal = (p: Position, side: Side) => pitsOf(side).reduce((sum, h) => sum + p.board[h], 0);

/** Undo is for games against the Scholar or a friend; the Learner and the Daily do not take moves back. */
export const undoAllowed = (match: Match) => match.config.opponent !== "learner" && match.played.length > 0;

/**
 * Takes back the player's last move and everything the opponent did after
 * it (against a friend, just the last move).
 */
export function undo(match: Match): Match {
  if (!undoAllowed(match)) return match;
  let back = match.played.length - 1;
  if (match.config.opponent !== "friend") {
    while (back > 0 && match.played[back].side !== "south") back -= 1;
    if (match.played[back].side !== "south") return match;
  }
  const restored = match.before[back];
  const seen = { ...match.seen };
  for (const p of match.before.slice(back + 1).map((b) => b.position).concat(match.position)) {
    const key = repetitionKey(p);
    if (seen[key]) seen[key] -= 1;
  }
  return {
    ...match,
    position: restored.position,
    game: restored.game,
    played: match.played.slice(0, back),
    before: match.before.slice(0, back),
    seen,
    ending: null,
  };
}

export type MatchResult = { you: number; them: number; winner: Side | "draw" };

export function resultOf(match: Match): MatchResult {
  const you = match.position.board[storeOf("south")];
  const them = match.position.board[storeOf("north")];
  return { you, them, winner: you > them ? "south" : them > you ? "north" : "draw" };
}
