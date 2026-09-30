import { originalFor } from "./scores";
import type { ScoreData } from "./types";

/*
 * Score data is large (every note of every part), so each tune's is loaded
 * the first time someone asks for its Original Score. Components follow the
 * loading with useSyncExternalStore(subscribeOriginal, () => originalData(id)).
 */

// One store per page, even if a bundler or test runner loads this module twice.
type Store = { loaded: Map<string, ScoreData>; pending: Map<string, Promise<ScoreData | undefined>>; listeners: Set<() => void> };
const KEY = Symbol.for("anykey.bopbox.originalScores");
const holder = globalThis as unknown as Record<symbol, Store | undefined>;
const store: Store = (holder[KEY] ??= { loaded: new Map(), pending: new Map(), listeners: new Set() });
const { loaded, pending, listeners } = store;

export const hasOriginal = (songId: string) => originalFor(songId) !== undefined;

export const originalData = (songId: string) => loaded.get(songId);

/** True once the Original Score can be played: our own settings are always ready, a composer's score once loaded. */
export function originalReady(songId: string) {
  const score = originalFor(songId);
  return !!score && (score.kind === "ours" || loaded.has(songId));
}

export function loadOriginal(songId: string): Promise<ScoreData | undefined> {
  const score = originalFor(songId);
  if (!score || score.kind !== "composer") return Promise.resolve(undefined);
  const ready = loaded.get(songId);
  if (ready) return Promise.resolve(ready);
  let job = pending.get(songId);
  if (!job) {
    job = score.load().then((data) => {
      loaded.set(songId, data);
      pending.delete(songId);
      for (const listener of listeners) listener();
      return data;
    });
    pending.set(songId, job);
  }
  return job;
}

export function subscribeOriginal(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}


export { ORIGINAL_SCORES, originalFor } from "./scores";
export type { ComposerScore, OriginalScore, OurScore, ScoreData } from "./types";
