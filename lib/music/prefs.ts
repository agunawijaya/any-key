"use client";

import { useSyncExternalStore } from "react";
import { LEGACY_SAVES, LEGACY_VERSION } from "@/lib/kit/legacy";
import { createStore } from "@/lib/kit/save";
import { musicManifest } from "./manifest";
import type { SongVersion } from "./score";

/** What Bop Box remembers between visits, in this browser only, in the kit store `anykey.music.save`. */

export type BopPrefs = {
  /** The 1981 excerpt or the whole piece. */
  version: SongVersion;
  /** Tune ids played at least once, style ids tried, and full-length pieces heard to the end. */
  tunesPlayed: string[];
  stylesTried: string[];
  fullHeard: string[];
};

const DEFAULTS: BopPrefs = { version: "short", tunesPlayed: [], stylesTried: [], fullHeard: [] };

export const bopStore = createStore<BopPrefs>(musicManifest.id, {
  version: 2,
  defaults: DEFAULTS,
  // Version 1 (the old key) only knew the length switch; the lists start empty.
  legacy: { key: LEGACY_SAVES[musicManifest.id], version: LEGACY_VERSION },
  normalise: (saved) => ({ ...DEFAULTS, ...saved, version: saved.version === "full" ? "full" : "short" }),
});

export function setBopPrefs(change: Partial<BopPrefs>) {
  bopStore.set((current) => ({ ...current, ...change }));
}

export function useBopPrefs() {
  return useSyncExternalStore(bopStore.subscribe, bopStore.get, () => DEFAULTS);
}
