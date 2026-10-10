/*
 * The Learner as the game plays it: the 1978 program's own way of choosing
 * a move (`chooseMove1978`, quirks and all), with one change. Its memory is
 * kept between visits in the player's save and has no limit, instead of
 * vanishing when the program stops and running out after 51 lessons.
 *
 * A lesson is the opening of a game the Learner did not win: up to eight
 * moves, both players, extra moves included, exactly what the 1978 program
 * wrote down. The Memory Book shows each one with the day it was learned.
 */

import { chooseMove1978, recordMove, type Decision, type ForLoops } from "./original";

export type Lesson = {
  /** The opening as the 1978 program stored it: up to eight moves as one base-6 number. */
  code: number;
  /** The same opening, hole by hole: 0–5 are the player's pits, 7–12 the Learner's. */
  opening: number[];
  /** Local date key ("2026-10-09") of the game it came from. */
  learned: string;
  /** The final stores of that game. */
  you: number;
  learner: number;
};

export type LearnerMind = {
  lessons: Lesson[];
  /** The two values the 1978 program never resets (see original.ts). */
  q: number;
  a: number;
};

export const freshMind = (): LearnerMind => ({ lessons: [], q: 0, a: 0 });

/** The current game as the Learner counts it: its code so far and how many moves are in it. */
export type GameRecord = { code: number; moves: number; opening: number[] };

export const newGameRecord = (): GameRecord => ({ code: 0, moves: 0, opening: [] });

/** Writes one sowing (either player's, extra moves included) into the record. */
export function recordSowing(game: GameRecord, pit: number): GameRecord {
  const { game: code, moves } = recordMove(game.code, game.moves, pit);
  return { code, moves, opening: game.opening.length < 8 ? [...game.opening, pit] : game.opening };
}

export type LearnerChoice = Decision & {
  /**
   * The pit it would have played if it remembered nothing, when that is not
   * the pit it plays, and the lessons (by place in the book) that turned it away.
   */
  avoided: { pit: number; lessons: number[] } | null;
};

/** The Learner's move, and its mind afterwards (Q and A move on with every decision). */
export function learnerMove(board: readonly number[], game: GameRecord, mind: LearnerMind, forLoops: ForLoops = "run-once") {
  const globals = { q: mind.q, a: mind.a };
  const decision = chooseMove1978(
    board,
    mind.lessons.map((l) => l.code),
    game.code,
    game.moves,
    globals,
    forLoops,
  );
  const turnedAway = decision.withoutMemory !== decision.pit ? decision.candidates.find((c) => c.pit === decision.withoutMemory) : undefined;
  const avoided = turnedAway ? { pit: turnedAway.pit, lessons: turnedAway.remembered.filter((i) => i >= 0) } : null;
  const choice: LearnerChoice = { ...decision, avoided };
  return { choice, mind: { ...mind, q: globals.q, a: globals.a } };
}

/** After a game: a game the Learner did not win becomes a lesson. */
export function learnFrom(mind: LearnerMind, game: GameRecord, you: number, learner: number, learned: string): LearnerMind {
  if (learner > you) return mind;
  return { ...mind, lessons: [...mind.lessons, { code: game.code, opening: game.opening, learned, you, learner }] };
}

/** Lessons whose opening matches this game so far: the ones the Learner is reading now. */
export function lessonsInPlay(mind: LearnerMind, game: GameRecord) {
  if (game.moves >= 8) return [];
  return mind.lessons.map((lesson, i) => ({ lesson, i })).filter(({ lesson }) => game.opening.every((pit, k) => lesson.opening[k] === pit) && lesson.opening.length > game.opening.length);
}
