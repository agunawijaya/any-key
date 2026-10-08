/*
 * Plays, wins, streaks and best scores per game, in one store, so the Hall
 * and the Keyring can show them without loading a game. Games report each
 * finished round with `recordPlay`.
 */

import { localDateKey } from "./daily";
import { createStore } from "./save";

export type GameStats = {
  plays: number;
  wins: number;
  /** Wins in a row, and the longest run so far. */
  streak: number;
  bestStreak: number;
  /** Best score per board ("time:normal", "score"), as the game defines it. */
  best: Record<string, number>;
  /** Local date of the last finished round. */
  lastPlayed: string | null;
};

export const EMPTY_STATS: GameStats = { plays: 0, wins: 0, streak: 0, bestStreak: 0, best: {}, lastPlayed: null };

type StatsData = Record<string, GameStats>;

export const statsStore = createStore<StatsData>("stats", { version: 1, defaults: {}, normalise: (data) => ({ ...data }) });

export const statsFor = (gameId: string, data = statsStore.get()): GameStats => data[gameId] ?? EMPTY_STATS;

export type Score = { value: number; better: "higher" | "lower" };

export type Play = {
  /** Leave out for rounds that have no winner (a tune played, a Versus game). */
  won?: boolean;
  scores?: Record<string, Score>;
  date?: Date;
};

export function recordPlay(gameId: string, { won, scores = {}, date = new Date() }: Play): GameStats {
  const before = statsFor(gameId);
  const best = { ...before.best };
  for (const [board, { value, better }] of Object.entries(scores)) {
    const old = best[board];
    if (old === undefined || (better === "higher" ? value > old : value < old)) best[board] = value;
  }
  const streak = won === undefined ? before.streak : won ? before.streak + 1 : 0;
  const next: GameStats = {
    plays: before.plays + 1,
    wins: before.wins + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(before.bestStreak, streak),
    best,
    lastPlayed: localDateKey(date),
  };
  statsStore.set((data) => ({ ...data, [gameId]: next }));
  return next;
}

/** Carries over counters a game kept before the kit; does nothing once the game has stats. */
export function seedStats(gameId: string, seed: Partial<GameStats>) {
  if (statsStore.get()[gameId]) return;
  statsStore.set((data) => ({ ...data, [gameId]: { ...EMPTY_STATS, ...seed } }));
}

export function forgetStats(gameId: string) {
  statsStore.set((data) => {
    const next = { ...data };
    delete next[gameId];
    return next;
  });
}
