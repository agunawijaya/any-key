/*
 * What a finished game changes in the player's progress: the record for
 * that rule set and opponent, the openings that beat the Learner, and the
 * keycaps it earned. Pure: the screens pass the result in and save what
 * comes out.
 */

import { learnFrom, type GameRecord, type LearnerMind } from "./learner";
import { resultOf, type Match } from "./match";
import { withAchievement, type Progress } from "./progress";

export type MatchStory = {
  /** The Learner turned away from a remembered loss during the game. */
  remembered: boolean;
  /** The longest run of extra turns the player earned in one turn. */
  longestChain: number;
  /** The most pits the player captured from in one Oware move. */
  widestCapture: number;
};

export const recordKey = (match: Match) => `${match.config.rules}/${match.config.opponent}`;

/** What happened in a game that the keycaps care about, read from its moves. */
export function storyOf(match: Match, remembered: boolean): MatchStory {
  let longestChain = 0;
  let chain = 0;
  let widestCapture = 0;
  for (const move of match.played) {
    if (move.side !== "south") {
      chain = 0;
      continue;
    }
    chain = move.outcome.extraTurn ? chain + 1 : 0;
    longestChain = Math.max(longestChain, chain);
    for (const c of move.outcome.captures) widestCapture = Math.max(widestCapture, c.from.length);
  }
  return { remembered, longestChain, widestCapture };
}

export function afterMatch(p: Progress, match: Match, story: MatchStory, mind: LearnerMind | null, dateKey: string): { progress: Progress; mind: LearnerMind | null } {
  const { config } = match;
  const result = resultOf(match);
  const won = result.winner === "south";
  const key = recordKey(match);
  const old = p.records[key] ?? { played: 0, won: 0, drawn: 0, lost: 0 };
  let next: Progress = {
    ...p,
    records: {
      ...p.records,
      [key]: { played: old.played + 1, won: old.won + (won ? 1 : 0), drawn: old.drawn + (result.winner === "draw" ? 1 : 0), lost: old.lost + (result.winner === "north" ? 1 : 0) },
    },
  };
  let learned: LearnerMind | null = null;
  if (config.opponent === "learner" && mind) {
    learned = learnFrom(mind, match.game as GameRecord, result.you, result.them, dateKey);
    if (won) {
      const opening = String(match.game.code);
      const times = (next.beatenWith[opening] ?? 0) + 1;
      next = { ...next, beatenWith: { ...next.beatenWith, [opening]: times } };
      next = withAchievement(next, "taught-it");
      if (times >= 2) next = withAchievement(next, "encore");
    }
    if (learned.lessons.length >= 50) next = withAchievement(next, "fifty-lessons");
  }
  // A game against a friend counts in the records only: one person playing both sides could hand themselves every keycap.
  if (config.opponent === "friend") return { progress: next, mind: learned };
  if (won) next = withAchievement(next, "first-harvest");
  if (won && config.opponent === "scholar" && config.level === "hard") next = withAchievement(next, "scholars-bane");
  if (story.remembered) next = withAchievement(next, "it-remembers");
  if (config.rules === "kalah" && story.longestChain >= 3) next = withAchievement(next, "chain-reaction");
  if (config.rules === "oware" && story.widestCapture >= 3) next = withAchievement(next, "grand-haul");
  return { progress: next, mind: learned };
}

/** A Daily Endgame finished: solved or not, and the share text. */
export function afterDaily(p: Progress, key: string, solved: boolean, share: string): Progress {
  const before = p.daily[key];
  // The first attempt of the day is what counts; replays never undo a solve.
  const entry = before ? { ...before, tries: before.tries + 1, solved: before.solved || solved, share: before.solved ? before.share : share } : { solved, tries: 1, share };
  let next: Progress = { ...p, daily: { ...p.daily, [key]: entry } };
  if (Object.values(next.daily).filter((d) => d.solved).length >= 7) next = withAchievement(next, "daily-sower");
  return next;
}
