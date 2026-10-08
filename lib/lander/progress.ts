"use client";

import { useSyncExternalStore } from "react";
import { forgetGame } from "@/lib/kit/forget";
import { LEGACY_SAVES, LEGACY_VERSION } from "@/lib/kit/legacy";
import { createProgress, withoutAchievements } from "@/lib/kit/progress";
import { createStore } from "@/lib/kit/save";
import type { Difficulty } from "./difficulty";
import { EMBLEM_FROM_EMOJI, emblemById } from "./emblems";
import { DEFAULT_FLAG, type FlagDesign } from "./flags";
import type { FreeStart } from "./freeflight";
import type { GradeId } from "./grades";
import { landerManifest } from "./manifest";
import type { WorldId } from "./worlds";

/** Everything Don't Crater remembers lives in this browser only, in the kit store `anykey.lander.save`. */

export type Progress = {
  flights: number;
  landings: number;
  craters: number;
  /** Best (slowest) touchdown per world, km/h. */
  best: Partial<Record<WorldId, number>>;
  landed: WorldId[];
  flagged: WorldId[];
  /** Mission id → stars (1–3); present once cleared. */
  missions: Record<number, number>;
  daily: Record<string, { speed: number; grade: GradeId; share: string }>;
  dailyLandings: number;
  achievements: string[];
  flag: FlagDesign;
  guide: boolean;
  /** Landing assist: the soft (5 km/h) and limit (20 km/h) lines. */
  assist: boolean;
  world: WorldId;
  /** Fuel difficulty for every mode but 1979 mode. */
  difficulty: Difficulty;
  /** Free Flight: the scan assist, the last start chosen, the last seed flown, and the named sites' best results. */
  scan: boolean;
  freeStart: FreeStart;
  freeSeed: number;
  sites: Record<string, SiteBest>;
};

/** A named site's best: stars from the landing grade, and the precision bonuses earned there. */
export type SiteBest = { stars: number; speed: number; narrow: boolean; centre: boolean };

const EMPTY: Progress = {
  flights: 0,
  landings: 0,
  craters: 0,
  best: {},
  landed: [],
  flagged: [],
  missions: {},
  daily: {},
  dailyLandings: 0,
  achievements: [],
  flag: DEFAULT_FLAG,
  guide: true,
  assist: false,
  world: "moon",
  difficulty: "standard",
  scan: false,
  freeStart: "final",
  freeSeed: 0,
  sites: {},
};

type Saved = Omit<Progress, "achievements">;

export const landerStore = createStore<Saved>(landerManifest.id, {
  version: 3,
  defaults: withoutAchievements(EMPTY),
  legacy: { key: LEGACY_SAVES[landerManifest.id], version: LEGACY_VERSION },
  migrations: {
    // Version 2 moved the achievements into the Keyring, which imports them from the old save itself.
    2: (old) => withoutAchievements(old as Progress),
    // Version 3 draws flag emblems instead of printing emoji: the saved emoji becomes the emblem's id.
    3: (old) => {
      const saved = old as Saved;
      const emblem = saved.flag ? (EMBLEM_FROM_EMOJI[saved.flag.emblem] ?? (emblemById(saved.flag.emblem).id || "star")) : DEFAULT_FLAG.emblem;
      return saved.flag ? { ...saved, flag: { ...saved.flag, emblem } } : saved;
    },
  },
});

const progress = createProgress<Progress>(landerManifest.id, landerStore, {
  dailies: (p) => p.daily,
  play: (before, after) => (after.flights > before.flights ? { won: after.landings > before.landings } : null),
  seed: (p) => ({ plays: p.flights, wins: p.landings }),
});

export const getProgress = progress.get;

/** Updates progress; returns the achievements this update unlocked. */
export const updateProgress = progress.update;

/** Forgets everything Don't Crater remembers, its keycaps included, but keeps the flag you designed. */
export function resetProgress() {
  const { flag } = progress.get();
  forgetGame(landerManifest.id);
  landerStore.set((p) => ({ ...p, flag }));
}

export function useProgress() {
  return useSyncExternalStore(progress.subscribe, progress.get, () => progress.empty);
}

export const withAchievement = (p: Progress, id: string): Progress =>
  p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] };

export const addOnce = <T,>(list: T[], item: T) => (list.includes(item) ? list : [...list, item]);
