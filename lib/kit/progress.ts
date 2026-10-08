/*
 * The bridge between a game's own progress and the collection.
 *
 * Games keep updating their progress the way they always have: a pure
 * function from the old progress to the new one, adding achievement ids to
 * `achievements` and dated entries to `daily`. This bridge notices what
 * changed and tells the kit: new achievement ids are unlocked in the Keyring,
 * new daily dates count towards the streak, and a finished round is recorded
 * in the stats. The achievement list itself lives only in the Keyring; the
 * game sees it merged into its progress, so its rules read as before.
 */

import { unlock } from "./achievements";
import { completeDailyOn, keyringStore } from "./keyring";
import type { Store } from "./save";
import { recordPlay, seedStats, type Play } from "./stats";

export type WithAchievements = { achievements: string[] };

export type ProgressOptions<T extends WithAchievements> = {
  /** Where finished dailies are kept, if the game has a daily: date key → anything. */
  dailies?: (progress: T) => Record<string, unknown>;
  /** What one update means for the stats: a finished round, or nothing. */
  play?: (before: T, after: T) => Play | null;
  /** Counters the game kept before the kit, carried into the stats once. */
  seed?: (progress: T) => { plays: number; wins: number; streak?: number; bestStreak?: number };
};

export type Progress<T extends WithAchievements> = {
  get(): T;
  /** Applies `change`; returns the achievement ids it unlocked. */
  update(change: (current: T) => T): string[];
  subscribe(listener: () => void): () => void;
  /** What the server and the first render see. */
  readonly empty: T;
  /** Back to a fresh start for this game (keeps the Keyring's other games). */
  reset(keep?: (current: T) => Partial<T>): void;
};

/** A game's progress as it is saved: everything but the achievements, which the Keyring keeps. */
export const withoutAchievements = <T extends WithAchievements>(progress: T): Omit<T, "achievements"> => {
  const rest: Partial<T> = { ...progress };
  delete rest.achievements;
  return rest as Omit<T, "achievements">;
};

export function createProgress<T extends WithAchievements>(
  gameId: string,
  store: Store<Omit<T, "achievements">>,
  options: ProgressOptions<T> = {},
): Progress<T> {
  const empty = { ...store.defaults, achievements: [] } as unknown as T;
  let cache: { data: Omit<T, "achievements">; unlocked: Record<string, number> | undefined; merged: T } | null = null;
  let seeded = false;

  function get(): T {
    const data = store.get();
    const unlocked = keyringStore.get().unlocked[gameId];
    if (!cache || cache.data !== data || cache.unlocked !== unlocked) {
      cache = { data, unlocked, merged: { ...data, achievements: Object.keys(unlocked ?? {}) } as unknown as T };
    }
    if (!seeded && options.seed && typeof window !== "undefined") {
      seeded = true;
      const counters = options.seed(cache.merged);
      // get() runs while React renders; writing another store must wait until the render is over.
      queueMicrotask(() => seedStats(gameId, counters));
    }
    return cache.merged;
  }

  function update(change: (current: T) => T): string[] {
    const before = get();
    const after = change(before);
    store.set(withoutAchievements(after));
    const unlocked = unlock(gameId, after.achievements.filter((id) => !before.achievements.includes(id)));

    if (options.dailies) {
      const had = options.dailies(before);
      for (const key of Object.keys(options.dailies(after))) if (!(key in had)) completeDailyOn(gameId, key);
    }
    const play = options.play?.(before, after);
    if (play) recordPlay(gameId, play);
    return unlocked;
  }

  function subscribe(listener: () => void) {
    const stopGame = store.subscribe(listener);
    const stopKeyring = keyringStore.subscribe(listener);
    return () => {
      stopGame();
      stopKeyring();
    };
  }

  function reset(keep?: (current: T) => Partial<T>) {
    const kept = keep ? keep(get()) : {};
    store.set({ ...store.defaults, ...withoutAchievements({ ...empty, ...kept } as T) });
  }

  return { get, update, subscribe, empty, reset };
}
